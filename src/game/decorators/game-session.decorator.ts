import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import type { GameSessionContext } from '../types/game-session.types';

export const GameSession = createParamDecorator(
  (
    _data: unknown,
    ctx: ExecutionContext,
  ): GameSessionContext => {
    const request = ctx
      .switchToHttp()
      .getRequest<{
        gameSession?: GameSessionContext;
      }>();

    if (!request.gameSession) {
      throw new UnauthorizedException(
        'Game session is not available',
      );
    }

    return request.gameSession;
  },
);