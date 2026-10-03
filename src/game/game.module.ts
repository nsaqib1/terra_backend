import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameSessionGuard } from './guards/game-session.guard';

@Module({
  imports: [
    ConfigModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('GAME_SESSION_SECRET'),
        signOptions: {
          expiresIn: config.get<string>(
            'GAME_SESSION_EXPIRES_SECONDS',
            '1800',
          ) as any,
        },
      }),
    }),
  ],

  controllers: [GameController],

  providers: [
    GameService,
    GameSessionGuard,
  ],

  exports: [
    GameService,
    GameSessionGuard,
  ],
})
export class GameModule { }