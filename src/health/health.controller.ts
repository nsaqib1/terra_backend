import { Controller, Get, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) { }

  @Get()
  async check() {
    let database = 'down';
    let redis = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    try {
      const result = await this.redis.ping();

      if (result === 'PONG') {
        redis = 'up';
      }
    } catch {
      redis = 'down';
    }

    return {
      status: database === 'up' && redis === 'up' ? 'ok' : 'degraded',
      database,
      redis,
    };
  }
}