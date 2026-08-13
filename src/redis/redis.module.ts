import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

const RedisProvider = {
  provide: 'REDIS_CLIENT',
  useFactory: () => {
    return new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    });
  },
};

@Global()
@Module({
  providers: [RedisProvider],
  exports: [RedisProvider],
})
export class RedisModule { }