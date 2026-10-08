import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class NotificationRealtimeService {
  private readonly logger = new Logger(NotificationRealtimeService.name);
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    if (!this.server) {
      return;
    }

    this.server.to(this.roomName(userId)).emit(event, payload);
  }

  disconnectUser(userId: string) {
    if (!this.server) {
      return;
    }

    this.server.in(this.roomName(userId)).disconnectSockets(true);
  }

  roomName(userId: string) {
    return `user:${userId}`;
  }
}
