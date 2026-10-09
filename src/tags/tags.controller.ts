import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { ListTagsDto } from './dto/list-tags.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminGuard } from 'src/admin/guards/admin.guard';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';

interface AuthenticatedRequest extends Request {
  user: { userId: string };
}

@Controller('tags')
export class TagsController {
  constructor(private readonly tagService: TagsService) { }

  @Get()
  async list(@Query() dto: ListTagsDto) {
    return this.tagService.list(dto);
  }

  // Community members may create a topic while composing a post.
  // Keep this separate from the admin taxonomy-management endpoint.
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('community')
  async createForCommunity(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTagDto,
  ) {
    return this.tagService.createForCommunity(request.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  async create(@Body() dto: CreateTagDto) {
    return this.tagService.create(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.tagService.archive(id);
  }
}