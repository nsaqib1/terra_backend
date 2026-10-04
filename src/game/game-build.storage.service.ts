import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream, mkdirSync } from 'fs';
import {
  copyFile,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  unlink,
} from 'fs/promises';
import { randomUUID } from 'crypto';
import { join, normalize, relative, sep } from 'path';
import * as unzipper from 'unzipper';

export interface StagedGameBuild {
  buildPath: string;
  absolutePath: string;
}

@Injectable()
export class GameBuildStorageService {
  private readonly stagedPrefix = '__staged__';

  constructor(
    private readonly configService: ConfigService,
  ) { }

  private getStoragePath(): string {
    const configured = this.configService.get<string>(
      'GAME_STORAGE_PATH',
    );

    if (configured) {
      mkdirSync(configured, { recursive: true });
      return configured;
    }

    const fallback = join(
      process.cwd(),
      'storage',
      'games',
    );

    mkdirSync(fallback, { recursive: true });

    return fallback;
  }

  private getTempPath(): string {
    const configured = this.configService.get<string>(
      'GAME_TEMP_PATH',
    );

    if (configured) {
      mkdirSync(configured, { recursive: true });
      return configured;
    }

    const fallback = join(
      process.cwd(),
      'storage',
      'game-temp',
    );

    mkdirSync(fallback, { recursive: true });

    return fallback;
  }

  private getMaxExtractedSize(): number {
    return (
      this.configService.get<number>(
        'GAME_MAX_EXTRACTED_SIZE',
      ) ?? 262144000
    );
  }

  private getMaxBuildFiles(): number {
    return (
      this.configService.get<number>(
        'GAME_MAX_BUILD_FILES',
      ) ?? 5000
    );
  }

  private getStagedPath(
    gameId: string,
    versionId: string,
  ): string {
    return join(
      this.getTempPath(),
      'staged',
      gameId,
      versionId,
    );
  }

  private getLivePath(slug: string): string {
    return join(
      this.getStoragePath(),
      slug,
    );
  }

  /**
   * Upload and validate a build without making it live.
   *
   * The extracted build stays in GAME_TEMP_PATH until
   * the corresponding version is published.
   */
  async storeBuild(
    tempZipPath: string,
    gameId: string,
    versionId: string,
  ): Promise<StagedGameBuild> {
    const stagedPath = this.getStagedPath(
      gameId,
      versionId,
    );

    const extractionPath = join(
      this.getTempPath(),
      `extract-${gameId}-${versionId}-${randomUUID()}`,
    );

    await mkdir(extractionPath, {
      recursive: true,
    });

    try {
      await this.extractZipSafely(
        tempZipPath,
        extractionPath,
      );

      await this.assertValidBuild(
        extractionPath,
      );

      // A version can only have one staged build.
      await rm(stagedPath, {
        recursive: true,
        force: true,
      });

      await mkdir(
        join(
          this.getTempPath(),
          'staged',
          gameId,
        ),
        {
          recursive: true,
        },
      );

      try {
        await rename(
          extractionPath,
          stagedPath,
        );
      } catch {
        // GAME_TEMP_PATH and extractionPath normally
        // live on the same filesystem, but keep a
        // cross-device fallback.
        await this.copyDirectory(
          extractionPath,
          stagedPath,
        );

        await rm(
          extractionPath,
          {
            recursive: true,
            force: true,
          },
        );
      }

      return {
        buildPath: this.getStagedBuildPath(
          gameId,
          versionId,
        ),
        absolutePath: stagedPath,
      };
    } catch (error) {
      await rm(
        extractionPath,
        {
          recursive: true,
          force: true,
        },
      ).catch(() => { });

      throw error;
    } finally {
      await unlink(tempZipPath).catch(() => { });
    }
  }

  /**
   * Converts a database buildPath into the actual
   * staged build directory.
   */
  private getStagedAbsolutePath(
    buildPath: string,
  ): string | null {
    const prefix = `${this.stagedPrefix}/`;

    if (!buildPath.startsWith(prefix)) {
      return null;
    }

    const relativePath = buildPath.slice(
      prefix.length,
    );

    const absolutePath = join(
      this.getTempPath(),
      'staged',
      relativePath,
    );

    const relativePathCheck = relative(
      join(
        this.getTempPath(),
        'staged',
      ),
      absolutePath,
    );

    if (
      relativePathCheck === '..' ||
      relativePathCheck.startsWith(
        `..${sep}`,
      ) ||
      relativePathCheck.startsWith('/') ||
      /^[A-Za-z]:/.test(
        relativePathCheck,
      )
    ) {
      throw new BadRequestException(
        'Invalid staged game build path',
      );
    }

    return absolutePath;
  }

  private getStagedBuildPath(
    gameId: string,
    versionId: string,
  ): string {
    return join(
      this.stagedPrefix,
      gameId,
      versionId,
    ).replace(/\\/g, '/');
  }

  /**
   * Publishes a staged build to:
   *
   * GAME_STORAGE_PATH/<slug>/
   *
   * Returns information needed to roll back the
   * filesystem operation if the database update fails.
   */
  async publishBuild(
    slug: string,
    stagedBuildPath: string,
  ) {
    const stagedPath =
      this.getStagedAbsolutePath(
        stagedBuildPath,
      );

    if (!stagedPath) {
      throw new BadRequestException(
        'The game version does not contain a staged build',
      );
    }

    await this.assertValidBuild(
      stagedPath,
    );

    const livePath =
      this.getLivePath(slug);

    const backupPath = join(
      this.getTempPath(),
      `previous-${slug}-${randomUUID()}`,
    );

    let previousBuildMoved = false;
    let newBuildMoved = false;

    try {
      await mkdir(
        this.getStoragePath(),
        {
          recursive: true,
        },
      );

      /*
       * Move the currently live build out of the way.
       *
       * This keeps the old build available until the
       * new build has successfully taken its place.
       */
      try {
        await rename(
          livePath,
          backupPath,
        );

        previousBuildMoved = true;
      } catch {
        // No currently published build.
      }

      /*
       * Move the staged build into its public slug path.
       */
      try {
        await rename(
          stagedPath,
          livePath,
        );

        newBuildMoved = true;
      } catch {
        // Cross-device fallback.
        await this.copyDirectory(
          stagedPath,
          livePath,
        );

        await rm(
          stagedPath,
          {
            recursive: true,
            force: true,
          },
        );

        newBuildMoved = true;
      }

      return {
        buildPath: slug,
        livePath,
        backupPath:
          previousBuildMoved
            ? backupPath
            : null,
        previousBuildMoved,
        newBuildMoved,
      };
    } catch (error) {
      /*
       * Restore the previous live build if the
       * replacement failed.
       */
      if (newBuildMoved) {
        await rm(
          livePath,
          {
            recursive: true,
            force: true,
          },
        ).catch(() => { });
      }

      if (previousBuildMoved) {
        await rename(
          backupPath,
          livePath,
        ).catch(() => { });
      }

      throw error;
    }
  }

  /**
   * Final cleanup after the database transaction
   * has successfully committed.
   */
  async finalizePublishedBuild(
    promotion: {
      backupPath: string | null;
    },
  ) {
    if (!promotion.backupPath) {
      return;
    }

    await rm(
      promotion.backupPath,
      {
        recursive: true,
        force: true,
      },
    );
  }

  /**
   * Roll back a filesystem promotion when the
   * database transaction fails.
   */
  async rollbackPublishedBuild(
    promotion: {
      livePath: string;
      backupPath: string | null;
      previousBuildMoved: boolean;
    },
  ) {
    await rm(
      promotion.livePath,
      {
        recursive: true,
        force: true,
      },
    ).catch(() => { });

    if (
      promotion.previousBuildMoved &&
      promotion.backupPath
    ) {
      await rename(
        promotion.backupPath,
        promotion.livePath,
      ).catch(() => { });
    }
  }

  /**
   * Deletes either a staged build or a live build.
   */
  async deleteBuild(
    buildPath: string | null,
    slug?: string,
  ) {
    if (!buildPath) {
      return;
    }

    const stagedPath =
      this.getStagedAbsolutePath(
        buildPath,
      );

    if (stagedPath) {
      await rm(
        stagedPath,
        {
          recursive: true,
          force: true,
        },
      );

      return;
    }

    /*
     * Published build paths are represented by
     * the game slug.
     */
    if (slug) {
      const livePath =
        this.getLivePath(slug);

      await rm(
        livePath,
        {
          recursive: true,
          force: true,
        },
      );
    }
  }

  getBuildPath(
    slug: string,
  ) {
    return this.getLivePath(slug);
  }

  private async assertValidBuild(
    buildPath: string,
  ) {
    const indexPath = join(
      buildPath,
      'index.html',
    );

    try {
      const indexStat =
        await stat(indexPath);

      if (!indexStat.isFile()) {
        throw new Error(
          'index.html is not a file',
        );
      }
    } catch {
      throw new BadRequestException(
        'Game build must contain an index.html file at the ZIP root',
      );
    }
  }

  private async extractZipSafely(
    zipPath: string,
    destination: string,
  ) {
    const directory =
      await unzipper.Open.file(zipPath);

    const maxExtractedSize =
      this.getMaxExtractedSize();

    const maxBuildFiles =
      this.getMaxBuildFiles();

    if (
      directory.files.length >
      maxBuildFiles
    ) {
      throw new BadRequestException(
        `Game build contains too many files. Maximum allowed is ${maxBuildFiles}.`,
      );
    }

    let extractedSize = 0;

    for (
      const entry of directory.files
    ) {
      const entryPath =
        entry.path;

      if (
        !entryPath ||
        entryPath.includes('\0')
      ) {
        throw new BadRequestException(
          'Invalid ZIP entry',
        );
      }

      const normalizedEntry =
        normalize(
          entryPath.replace(
            /\\/g,
            '/',
          ),
        );

      if (
        normalizedEntry === '..' ||
        normalizedEntry.startsWith(
          `..${sep}`,
        ) ||
        normalizedEntry.startsWith('/') ||
        /^[A-Za-z]:/.test(
          normalizedEntry,
        )
      ) {
        throw new BadRequestException(
          'Game build contains an unsafe ZIP path',
        );
      }

      const outputPath =
        join(
          destination,
          normalizedEntry,
        );

      const relativePath =
        relative(
          destination,
          outputPath,
        );

      if (
        relativePath === '..' ||
        relativePath.startsWith(
          `..${sep}`,
        ) ||
        relativePath.startsWith('/') ||
        /^[A-Za-z]:/.test(
          relativePath,
        )
      ) {
        throw new BadRequestException(
          'Game build contains an unsafe ZIP path',
        );
      }

      if (
        entry.type !== 'File' &&
        entry.type !== 'Directory'
      ) {
        throw new BadRequestException(
          'Game build contains an unsupported ZIP entry type',
        );
      }

      extractedSize +=
        entry.uncompressedSize ?? 0;

      if (
        extractedSize >
        maxExtractedSize
      ) {
        throw new BadRequestException(
          `Game build exceeds the maximum extracted size of ${Math.floor(
            maxExtractedSize /
            1024 /
            1024,
          )} MB.`,
        );
      }

      if (
        entry.type === 'Directory'
      ) {
        await mkdir(
          outputPath,
          {
            recursive: true,
          },
        );

        continue;
      }

      await mkdir(
        join(
          outputPath,
          '..',
        ),
        {
          recursive: true,
        },
      );

      await new Promise<void>(
        (
          resolve,
          reject,
        ) => {
          const stream =
            entry.stream();

          const output =
            createWriteStream(
              outputPath,
            );

          stream.on(
            'error',
            reject,
          );

          output.on(
            'error',
            reject,
          );

          output.on(
            'finish',
            resolve,
          );

          stream.pipe(output);
        },
      );
    }
  }

  private async copyDirectory(
    source: string,
    destination: string,
  ) {
    await mkdir(
      destination,
      {
        recursive: true,
      },
    );

    const entries =
      await readdir(
        source,
        {
          withFileTypes: true,
        },
      );

    for (
      const entry of entries
    ) {
      const sourcePath =
        join(
          source,
          entry.name,
        );

      const destinationPath =
        join(
          destination,
          entry.name,
        );

      if (
        entry.isDirectory()
      ) {
        await this.copyDirectory(
          sourcePath,
          destinationPath,
        );
      } else if (
        entry.isFile()
      ) {
        await copyFile(
          sourcePath,
          destinationPath,
        );
      } else {
        throw new BadRequestException(
          'Game build contains an unsupported file type',
        );
      }
    }
  }
}