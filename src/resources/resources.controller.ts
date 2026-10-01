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
  ) { }

  @Get()
  list(@Query() dto: ListResourcesDto) {
    return this.resources.list(dto);
  }

  @Get('tags')
  tags(
    @Query('communityId') communityId: string,
    @Query('q') q?: string,
  ) {
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

    const isPdf = result.resource.mimeType === 'application/pdf';
    const isInline = !increment && isPdf;

    // PDFs are intentionally allowed to be embedded by the frontend.
    // Helmet normally adds X-Frame-Options: SAMEORIGIN, which blocks
    // localhost:3000 from embedding a PDF served by localhost:3001.
    if (isInline) {
      response.removeHeader('X-Frame-Options');
      response.removeHeader('Content-Security-Policy');
    }

    response.set({
      'Content-Type': result.resource.mimeType,
      'Content-Length': result.resource.size.toString(),

      'Content-Disposition': isInline
        ? 'inline'
        : `attachment; filename*=UTF-8''${encodeURIComponent(
          result.resource.originalFilename,
        )}`,

      'Cache-Control': 'public, max-age=3600',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });

    return new StreamableFile(result.stream);
  }
}