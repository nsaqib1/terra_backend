import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
})
export class AppModule {}
