import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { GameController } from './game.controller';
import { GameService } from './game.service';

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
            'GAME_SESSION_EXPIRES_IN',
            '30m',
          ) as any,
        },
      }),
    }),
  ],

  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule { }