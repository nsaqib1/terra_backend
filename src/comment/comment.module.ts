import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [CommentController],
  providers: [CommentService]
})
export class CommentModule { }
