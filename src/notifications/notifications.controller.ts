import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: string };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() dto: ListNotificationsDto,
  ) {
    return this.notificationsService.list(
      req.user.userId,
      dto.cursor,
      dto.limit,
    );
  }

  @Get('unread-count')
  async unreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getUnreadCount(req.user.userId);
  }

  @Patch(':id/read')
  async markRead(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.markRead(req.user.userId, id);
  }

  @Post('read-all')
  async markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(req.user.userId);
  }
}
