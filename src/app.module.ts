import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { CommunitiesModule } from './communities/communities.module';
import { AdminModule } from './admin/admin.module';
import { PostsModule } from './posts/posts.module';
import { MediaModule } from './media/media.module';
import { TagsModule } from './tags/tags.module';
import { CommentModule } from './comment/comment.module';
import { VoteModule } from './vote/vote.module';
import { PointModule } from './point/point.module';
import { UserModule } from './user/user.module';
import { InvitesModule } from './invites/invites.module';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z.string().min(1),

  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),

  FRONTEND_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),

  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('30d'),

  MEDIA_STORAGE_PATH: z.string().min(1),

  MEDIA_MAX_FILE_SIZE: z.coerce.number().int().positive(),
  MEDIA_MAX_IMAGE_WIDTH: z.coerce.number().int().positive(),
  MEDIA_MAX_IMAGE_HEIGHT: z.coerce.number().int().positive(),

  LOG_LEVEL: z.string().default('info'),

  POSTGRES_DB: z.string().min(1),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),

    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    CommunitiesModule,
    AdminModule,
    PostsModule,
    MediaModule,
    TagsModule,
    CommentModule,
    VoteModule,
    PointModule,
    UserModule,
    InvitesModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }