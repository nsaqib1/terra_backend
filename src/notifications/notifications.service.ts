import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, NotificationType } from '../generated/prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { NotificationRealtimeService } from './notification-realtime.service';

const actorSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: NotificationRealtimeService,
  ) {}

  async createInTransaction(
    tx: Prisma.TransactionClient,
    data: {
      recipientId: string;
      actorId?: string | null;
      type: NotificationType;
      postId?: string | null;
      commentId?: string | null;
    },
  ) {
    if (data.actorId && data.actorId === data.recipientId) {
      return null;
    }

    return tx.notification.create({ data });
  }

  async emitCreated(notificationId: string) {
    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
        include: {
          actor: { select: actorSelect },
        },
      });

      if (!notification) {
        return;
      }

      this.realtime.emitToUser(notification.recipientId, 'notification.created', {
        notification,
      });
    } catch {
      // Realtime delivery is best-effort. The notification is already durable in PostgreSQL.
    }
  }

  async list(recipientId: string, cursor?: string, limit = 20) {
    const notifications = await this.prisma.notification.findMany({
      where: { recipientId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
      include: {
        actor: { select: actorSelect },
      },
    });

    const hasMore = notifications.length > limit;
    const data = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

    return { data, nextCursor, hasMore };
  }

  async getUnreadCount(recipientId: string) {
    const count = await this.prisma.notification.count({
      where: {
        recipientId,
        readAt: null,
      },
    });

    return { count };
  }

  async markRead(recipientId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    if (result.count === 0) {
      const existing = await this.prisma.notification.findFirst({
        where: { id: notificationId, recipientId },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException('Notification not found');
      }
    } else {
      this.realtime.emitToUser(recipientId, 'notification.read', {
        notificationId,
      });
    }

    return { success: true };
  }

  async markAllRead(recipientId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    if (result.count > 0) {
      this.realtime.emitToUser(recipientId, 'notifications.read-all', {
        updated: result.count,
      });
    }

    return { success: true, updated: result.count };
  }
}
