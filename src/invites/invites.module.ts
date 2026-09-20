import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { AdminInvitesController } from './admin-invites.controller';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvitesController, AdminInvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
