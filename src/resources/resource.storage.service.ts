import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { createReadStream, mkdirSync } from 'fs';
import { copyFile, mkdir, rename, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class ResourceStorageService {
  private getBasePath(): string {
    const configuredPath = process.env.RESOURCE_STORAGE_PATH;
    if (configuredPath) {
      try {
        mkdirSync(configuredPath, { recursive: true });
        return configuredPath;
      } catch {
        // Fallback to local directory if configured path (e.g. /app/storage/resources) is not writable
      }
    }
    const fallbackPath = join(process.cwd(), 'storage', 'resources');
    mkdirSync(fallbackPath, { recursive: true });
    return fallbackPath;
  }

  async saveFromTempFile(tempPath: string, extension: string) {
    const basePath = this.getBasePath();
    const now = new Date();
    const year = now.getUTCFullYear().toString();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const directory = join(basePath, year, month, day);

    await mkdir(directory, { recursive: true });

    const filename = `${randomUUID()}${extension ? `.${extension}` : ''}`;
    const storageKey = `${year}/${month}/${day}/${filename}`;
    const absolutePath = join(basePath, storageKey);

    try {
      try {
        await rename(tempPath, absolutePath);
      } catch {
        // Cross-device fallback (e.g. EXDEV when temp directory is on a different filesystem or mount)
        await copyFile(tempPath, absolutePath);
        await unlink(tempPath).catch(() => {});
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(`Failed to store resource: ${msg}`);
    }

    return { storageKey, absolutePath };
  }

  async deleteTempFile(filePath: string) {
    try {
      await unlink(filePath);
    } catch {
      // The temporary file may already have been moved or removed.
    }
  }

  async delete(storageKey: string) {
    try {
      await unlink(join(this.getBasePath(), storageKey));
    } catch {
      // The file may already be gone.
    }
  }

  getPath(storageKey: string) {
    return join(this.getBasePath(), storageKey);
  }

  async getFile(storageKey: string) {
    const absolutePath = this.getPath(storageKey);
    try {
      const fileStat = await stat(absolutePath);
      return { stream: createReadStream(absolutePath), size: fileStat.size };
    } catch {
      return null;
    }
  }
}

