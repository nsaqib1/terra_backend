import {
  Body,
  Controller,
  Get,
  Param,
  Post as HttpPost,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';

import { PostsService } from './posts.service';

import { CreatePostDto } from './dto/create-post.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetPostsQueryDto } from './dto/get-post-query.dto';

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
}