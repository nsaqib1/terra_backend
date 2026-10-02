import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import { PrismaService } from '../../database/prisma.service';
import {
  GameSessionContext,
  GameSessionTokenPayload,
} from '../types/game-session.types';

interface GameSessionRequest extends Request {
  gameSession?: GameSessionContext;
}

@Injectable()
export class GameSessionGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) { }

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<GameSessionRequest>();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Game session token is required',
      );
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      throw new UnauthorizedException(
        'Game session token is required',
      );
    }

    let payload: GameSessionTokenPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<GameSessionTokenPayload>(
          token,
        );
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired game session token',
      );
    }

    if (
      payload.type !== 'game-session' ||
      !payload.sub ||
      !payload.gameId ||
      !payload.gameVersionId
    ) {
      throw new UnauthorizedException(
        'Invalid game session token',
      );
    }

    const session =
      await this.prisma.gameSession.findUnique({
        where: {
          id: payload.sub,
        },
        select: {
          id: true,
          gameId: true,
          gameVersionId: true,
          userId: true,
          expiresAt: true,
          status: true,
        },
      });

    if (!session) {
      throw new UnauthorizedException(
        'Game session not found',
      );
    }

    if (session.gameId !== payload.gameId) {
      throw new UnauthorizedException(
        'Game session does not belong to this game',
      );
    }

    if (
      session.gameVersionId !== payload.gameVersionId
    ) {
      throw new UnauthorizedException(
        'Game session version mismatch',
      );
    }

    if (
      payload.userId !== undefined &&
      session.userId !== payload.userId
    ) {
      throw new UnauthorizedException(
        'Game session user mismatch',
      );
    }

    if (
      session.userId === null &&
      payload.userId !== undefined
    ) {
      throw new UnauthorizedException(
        'Invalid guest game session',
      );
    }

    if (
      session.userId !== null &&
      payload.userId === undefined
    ) {
      throw new UnauthorizedException(
        'Invalid authenticated game session',
      );
    }

    if (session.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Game session is no longer active',
      );
    }

    if (session.expiresAt <= new Date()) {
      await this.prisma.gameSession.update({
        where: {
          id: session.id,
        },
        data: {
          status: 'EXPIRED',
        },
      });

      throw new UnauthorizedException(
        'Game session has expired',
      );
    }

    request.gameSession = {
      sessionId: session.id,
      gameId: session.gameId,
      gameVersionId: session.gameVersionId,
      userId: session.userId,
      expiresAt: session.expiresAt,
    };

    return true;
  }
}