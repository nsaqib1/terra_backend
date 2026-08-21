import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import sharp from 'sharp';

@Injectable()
export class MediaImageService {
  private readonly maxWidth =
    Number(
      process.env.MEDIA_MAX_IMAGE_WIDTH ||
      2400,
    );

  private readonly maxHeight =
    Number(
      process.env.MEDIA_MAX_IMAGE_HEIGHT ||
      2400,
    );

  async process(
    buffer: Buffer,
  ) {
    let image;

    try {
      image =
        sharp(buffer, {
          failOn: 'error',
        });

      const metadata =
        await image.metadata();

      if (!metadata.format) {
        throw new BadRequestException(
          'Invalid image',
        );
      }

      const allowedFormats = [
        'jpeg',
        'png',
        'webp',
      ];

      if (
        !allowedFormats.includes(
          metadata.format,
        )
      ) {
        throw new BadRequestException(
          'Unsupported image format',
        );
      }

      const processed =
        await image
          .rotate()
          .resize({
            width: this.maxWidth,
            height: this.maxHeight,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({
            quality: 82,
          })
          .toBuffer();

      const outputMetadata =
        await sharp(processed)
          .metadata();

      return {
        buffer: processed,

        mimeType: 'image/webp',

        width:
          outputMetadata.width ?? null,

        height:
          outputMetadata.height ?? null,

        size: processed.length,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException(
        'Unable to process image',
      );
    }
  }
}