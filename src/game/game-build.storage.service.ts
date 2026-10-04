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

@Injectable()
export class GameBuildStorageService {
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
    return this.configService.get<number>(
      'GAME_MAX_EXTRACTED_SIZE',
      262144000,
    );
  }

  private getMaxBuildFiles(): number {
    return this.configService.get<number>(
      'GAME_MAX_BUILD_FILES',
      5000,
    );
  }

  async storeBuild(
    tempZipPath: string,
    gameId: string,
    versionId: string,
  ) {
    const storageRoot = this.getStoragePath();

    const finalRelativePath = join(
      gameId,
      versionId,
    );

    const finalPath = join(
      storageRoot,
      finalRelativePath,
    );

    const extractionPath = join(
      this.getTempPath(),
      `${gameId}-${versionId}-${randomUUID()}`,
    );

    await mkdir(extractionPath, {
      recursive: true,
    });

    try {
      await this.extractZipSafely(
        tempZipPath,
        extractionPath,
      );

      const indexPath = join(
        extractionPath,
        'index.html',
      );

      try {
        const indexStat = await stat(indexPath);

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

      await mkdir(
        join(storageRoot, gameId),
        { recursive: true },
      );

      // Never overwrite an existing build.
      try {
        await stat(finalPath);

        throw new BadRequestException(
          'This game version already has a build',
        );
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }

        // ENOENT is expected here.
      }

      try {
        await rename(
          extractionPath,
          finalPath,
        );
      } catch {
        // Fallback for cross-device moves.
        await this.copyDirectory(
          extractionPath,
          finalPath,
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
        buildPath: finalRelativePath,
        absolutePath: finalPath,
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

  async deleteBuild(
    buildPath: string | null,
  ) {
    if (!buildPath) {
      return;
    }

    const storageRoot =
      this.getStoragePath();

    const absolutePath = join(
      storageRoot,
      buildPath,
    );

    await rm(
      absolutePath,
      {
        recursive: true,
        force: true,
      },
    );
  }

  getBuildPath(
    buildPath: string,
  ) {
    return join(
      this.getStoragePath(),
      buildPath,
    );
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
      const entryPath = entry.path;

      if (
        !entryPath ||
        entryPath.includes('\0')
      ) {
        throw new BadRequestException(
          'Invalid ZIP entry',
        );
      }

      /*
       * ZIP paths use forward slashes,
       * regardless of the operating system.
       */
      const normalizedEntry =
        normalize(
          entryPath.replace(
            /\\/g,
            '/',
          ),
        );

      /*
       * Prevent path traversal and
       * absolute paths.
       */
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

      const outputPath = join(
        destination,
        normalizedEntry,
      );

      const relativePath = relative(
        destination,
        outputPath,
      );

      /*
       * Second path traversal check
       * after path normalization.
       */
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

      /*
       * Only normal files and directories
       * are allowed.
       *
       * This rejects symlinks and other
       * special ZIP entry types.
       */
      if (
        entry.type !== 'File' &&
        entry.type !== 'Directory'
      ) {
        throw new BadRequestException(
          'Game build contains an unsupported ZIP entry type',
        );
      }

      /*
       * Track the uncompressed size before
       * actually extracting the file.
       */
      extractedSize +=
        entry.uncompressedSize ?? 0;

      if (
        extractedSize >
        maxExtractedSize
      ) {
        throw new BadRequestException(
          `Game build exceeds the maximum extracted size of ${Math.floor(
            maxExtractedSize / 1024 / 1024,
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
        join(outputPath, '..'),
        {
          recursive: true,
        },
      );

      await new Promise<void>(
        (resolve, reject) => {
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