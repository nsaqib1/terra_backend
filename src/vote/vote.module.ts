import { Module } from '@nestjs/common';
import { VoteController } from './vote.controller';
import { VoteService } from './vote.service';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [VoteController],
  providers: [VoteService]
})
export class VoteModule {}
