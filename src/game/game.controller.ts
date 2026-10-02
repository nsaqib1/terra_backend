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

import { GameSessionGuard } from './guards/game-session.guard';
import type { GameSessionContext } from './types/game-session.types';
import { GameSession } from './decorators/game-session.decorator';

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

  @Post('session/end')
  @UseGuards(GameSessionGuard)
  async endSession(
    @GameSession() session: GameSessionContext,
  ) {
    return this.gameService.endSession(session.sessionId);
  }

  @Get('session/current')
  @UseGuards(GameSessionGuard)
  async getCurrentSession(
    @GameSession() session: GameSessionContext,
  ) {
    return {
      sessionId: session.sessionId,
      gameId: session.gameId,
      gameVersionId: session.gameVersionId,
      userId: session.userId,
      expiresAt: session.expiresAt,
    };
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

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.gameService.findBySlug(slug);
  }
}