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

import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ListCommentsDto } from './dto/list-comments.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('comments')
export class CommentController {
  constructor(
    private readonly commentService: CommentService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.create(request.user.userId, dto);
  }

  @Get()
  async list(@Query() dto: ListCommentsDto) {
    return this.commentService.list(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentService.update(
      request.user.userId,
      id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.commentService.remove(
      request.user.userId,
      id,
    );
  }
}