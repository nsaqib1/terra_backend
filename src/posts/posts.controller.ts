import {
  Body,
  Controller,
  Post as HttpPost,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PostsService } from './posts.service';

import { CreatePostDto } from './dto/create-post.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}