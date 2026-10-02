import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { GameService } from './game.service';
import { ListGamesDto } from './dto/list-games.dto';

interface OptionalAuthenticatedRequest extends Request {
  user?: {
    userId: string;
  };
}

@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) { }

  @Get()
  async list(@Query() dto: ListGamesDto) {
    return this.gameService.list(dto);
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.gameService.findBySlug(slug);
  }

  @Post(':slug/session')
  @UseGuards(OptionalJwtAuthGuard)
  async startSession(
    @Param('slug') slug: string,
    @Req() request: OptionalAuthenticatedRequest,
  ) {
    return this.gameService.startSession(
      slug,
      request.user?.userId,
    );
  }
}