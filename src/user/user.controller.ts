import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserPostsQueryDto } from './dto/user-posts-query.dto';
import { UserCommunitiesQueryDto } from './dto/user-communities-query.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Patch('me')
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(req.user.userId, dto);
  }

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    return this.userService.getProfile(id);
  }

  @Get(':id/posts')
  async getUserPosts(
    @Param('id') id: string,
    @Query() query: UserPostsQueryDto,
  ) {
    return this.userService.getUserPosts(id, query);
  }

  @Get(':id/communities')
  async getUserCommunities(
    @Param('id') id: string,
    @Query() query: UserCommunitiesQueryDto,
  ) {
    return this.userService.getUserCommunities(id, query);
  }
}
