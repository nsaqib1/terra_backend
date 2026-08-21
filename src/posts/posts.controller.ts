import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post as HttpPost,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PostsService } from './posts.service';

import { CreatePostDto } from './dto/create-post.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetPostsQueryDto } from './dto/get-post-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @HttpPost()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.create(
      request.user.userId,
      dto,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
  ) {
    return this.postsService.findOne(id);
  }

  @Get()
  async findMany(
    @Query() query: GetPostsQueryDto,
  ) {
    return this.postsService.findMany(query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(
      request.user.userId,
      id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.postsService.remove(
      request.user.userId,
      id,
    );
  }
}