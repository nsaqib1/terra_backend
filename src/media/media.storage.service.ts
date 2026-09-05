import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import {
  mkdir,
  unlink,
  writeFile,
} from 'fs/promises';

import {
  createReadStream,
} from 'fs';

import {
  stat,
} from 'fs/promises';

import { join } from 'path';

import { randomUUID } from 'crypto';

@Injectable()
export class MediaStorageService {
  private readonly basePath =
    process.env.MEDIA_STORAGE_PATH ||
    '/app/storage/media';

  async save(
    buffer: Buffer,
    extension: string,
  ) {
    const now = new Date();

    const year =
      now.getUTCFullYear().toString();

    const month =
      String(now.getUTCMonth() + 1)
        .padStart(2, '0');

    const day =
      String(now.getUTCDate())
        .padStart(2, '0');

    const directory = join(
      this.basePath,
      year,
      month,
      day,
    );

    await mkdir(directory, {
      recursive: true,
    });

    const filename =
      `${randomUUID()}.${extension}`;

    const storageKey =
      `${year}/${month}/${day}/${filename}`;

    const absolutePath =
      join(this.basePath, storageKey);

    try {
      await writeFile(
        absolutePath,
        buffer,
      );
    } catch {
      throw new InternalServerErrorException(
        'Failed to store media',
      );
    }

    return {
      storageKey,
      absolutePath,
    };
  }

  async delete(
    storageKey: string,
  ) {
    const absolutePath =
      join(
        this.basePath,
        storageKey,
      );

    try {
      await unlink(absolutePath);
    } catch {
      // File may already be gone.
    }
  }

  getPath(
    storageKey: string,
  ) {
    return join(
      this.basePath,
      storageKey,
    );
  }

  async getFile(
    storageKey: string,
  ) {
    const absolutePath =
      this.getPath(storageKey);

    try {
      const fileStat =
        await stat(absolutePath);

      return {
        stream:
          createReadStream(absolutePath),

        size:
          fileStat.size,
      };
    } catch {
      return null;
    }
  }
}