import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { ResourceStorageService } from './resource.storage.service';
import { ResourceTagsService } from './resource-tags.service';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService, ResourceStorageService, ResourceTagsService],
  exports: [ResourcesService, ResourceTagsService],
})
export class ResourcesModule {}
