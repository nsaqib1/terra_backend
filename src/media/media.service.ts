import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';


import { MediaImageService } from './media.image.service';
import { MediaStorageService } from './media.storage.service';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly imageService:
      MediaImageService,

    private readonly storageService:
      MediaStorageService,
  ) { }

  async upload(
    userId: string,
    file: Express.Multer.File,
  ) {
    if (!userId) {
      throw new BadRequestException(
        'User is required',
      );
    }

    const processed =
      await this.imageService.process(
        file.buffer,
      );

    const stored =
      await this.storageService.save(
        processed.buffer,
        'webp',
      );

    try {
      const media =
        await this.prisma.media.create({
          data: {
            uploadedById: userId,

            status: 'TEMPORARY',

            type: 'IMAGE',

            storageKey:
              stored.storageKey,

            mimeType:
              processed.mimeType,

            width:
              processed.width,

            height:
              processed.height,

            size:
              processed.size,

            originalFilename:
              file.originalname,
          },

          select: {
            id: true,
            type: true,
            status: true,
            mimeType: true,
            width: true,
            height: true,
            size: true,
            originalFilename: true,
            createdAt: true,
          },
        });

      return {
        ...media,

        storageKey:
          stored.storageKey,
      };
    } catch (error) {
      // Database creation failed.
      // Do not leave an orphaned file.
      await this.storageService.delete(
        stored.storageKey,
      );

      throw error;
    }
  }
}