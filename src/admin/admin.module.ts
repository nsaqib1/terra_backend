import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { ResourcesModule } from '../resources/resources.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [ResourcesModule, GameModule],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminGuard,
  ],
})
export class AdminModule { }