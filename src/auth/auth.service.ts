import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { InvitesService } from '../invites/invites.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { hashToken } from './auth-token.util';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly invitesService: InvitesService,
  ) { }

  async register(dto: RegisterDto) {
    const isInviteOnly = this.invitesService.isInviteOnlyEnabled();

    if (isInviteOnly && !dto.inviteCode?.trim()) {
      throw new BadRequestException(
        'An invite code is required to sign up during the beta testing phase.',
      );
    }

    if (dto.inviteCode?.trim()) {
      await this.invitesService.validateInviteCode(dto.inviteCode.trim());
    }

    const username = dto.username.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new ConflictException('Username is already taken');
      }

      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username,
          displayName: dto.displayName.trim(),
          email,
          passwordHash,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          points: true,
          role: true,
          createdAt: true,
        },
      });

      if (dto.inviteCode?.trim()) {
        await this.invitesService.redeemInviteInTransaction(
          dto.inviteCode.trim(),
          newUser.id,
          tx,
        );
      }

      return newUser;
    });

    const tokens = await this.createTokenPair(user.id);

    return {
      user,
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            username: identifier,
          },
          {
            email: identifier,
          },
        ],
        deletedAt: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.createTokenPair(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        points: user.points,
        role: user.role,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.refreshSession.findUnique({
      where: {
        id: payload.sid,
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh session is invalid');
    }

    const tokenMatches = hashToken(refreshToken) === session.tokenHash;

    if (!tokenMatches) {
      await this.prisma.refreshSession.update({
        where: {
          id: session.id,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      throw new UnauthorizedException('Refresh session is invalid');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: session.userId,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        points: true,
        role: true,
        status: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is not active');
    }

    await this.prisma.refreshSession.update({
      where: {
        id: session.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const tokens = await this.createTokenPair(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        points: user.points,
        role: user.role,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async logout(sessionId: string) {
    await this.prisma.refreshSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async getUserById(userId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        bio: true,
        points: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getRefreshSessionId(refreshToken: string): Promise<string | null> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );

      if (payload.type !== 'refresh' || !payload.sid) {
        return null;
      }

      return payload.sid;
    } catch {
      return null;
    }
  }

  private async createTokenPair(userId: string) {
    const refreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '30d',
    );

    const refreshExpirationMs = this.parseDuration(refreshExpiresIn);

    // Generate the session ID before creating the database record.
    const sessionId = randomUUID();

    const accessPayload: AccessTokenPayload = {
      sub: userId,
      type: 'access',
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      type: 'refresh',
    };

    const accessToken = await this.jwt.signAsync(accessPayload);

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn as any,
    });

    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshExpirationMs),
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private parseDuration(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);

    if (!match) {
      throw new Error(
        'Invalid JWT_REFRESH_EXPIRES_IN. Use formats such as 30d, 12h, 60m.',
      );
    }

    const amount = Number(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return amount * multipliers[unit];
  }
}