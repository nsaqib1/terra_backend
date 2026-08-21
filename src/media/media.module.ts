import { Module } from '@nestjs/common';

import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaStorageService } from './media.storage.service';
import { MediaImageService } from './media.image.service';


@Module({
  controllers: [MediaController],

  providers: [
    MediaService,
    MediaStorageService,
    MediaImageService,
  ],

  exports: [
    MediaService,
  ],
})
export class MediaModule { }