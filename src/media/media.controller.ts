import {
  BadRequestException,
  Controller,
  Req,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Get,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';

import {
  FileInterceptor,
} from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { MediaService } from './media.service';
import type { Response } from 'express';

const maxMediaFileSize = Number(process.env.MEDIA_MAX_FILE_SIZE || 10485760);

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
  ) { }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: maxMediaFileSize,
      },
    }),
  )
  async upload(
    @Req() request: AuthenticatedRequest,

    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: maxMediaFileSize,
          }),

          new FileTypeValidator({
            fileType:
              /^image\/(jpeg|png|webp)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'File is required',
      );
    }

    return this.mediaService.upload(
      request.user.userId,
      file,
    );
  }
  @Get(':id')
  async getMedia(
    @Param('id') id: string,
    @Res({ passthrough: true })
    response: Response,
  ) {
    const result =
      await this.mediaService.getFile(id);

    response.set({
      'Content-Type':
        result.media.mimeType,

      'Content-Length':
        result.media.size?.toString(),

      'Cache-Control':
        'public, max-age=31536000, immutable',
    });

    return new StreamableFile(
      result.stream,
    );
  }
}