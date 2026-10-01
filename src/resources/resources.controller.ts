import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ResourcesService } from './resources.service';
import { ResourceTagsService } from './resource-tags.service';
import { ListResourcesDto } from './dto/list-resources.dto';

@Controller('resources')
export class ResourcesController {
  constructor(
    private readonly resources: ResourcesService,
    private readonly resourceTags: ResourceTagsService,
  ) {}

  @Get()
  list(@Query() dto: ListResourcesDto) {
    return this.resources.list(dto);
  }

  @Get('tags')
  tags(@Query('communityId') communityId: string, @Query('q') q?: string) {
    if (!communityId) {
      throw new BadRequestException('communityId is required');
    }
    return this.resourceTags.list(communityId, q);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.resources.getById(id);
  }

  @Get(':id/file')
  async file(
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const increment = download === 'true' || download === '1';
    const result = await this.resources.getFile(id, increment);

    response.set({
      'Content-Type': result.resource.mimeType,
      'Content-Length': result.resource.size.toString(),
      'Content-Disposition': increment || result.resource.mimeType !== 'application/pdf'
        ? `attachment; filename*=UTF-8''${encodeURIComponent(result.resource.originalFilename)}`
        : 'inline',
      'Cache-Control': 'public, max-age=3600',
    });

    return new StreamableFile(result.stream);
  }
}
