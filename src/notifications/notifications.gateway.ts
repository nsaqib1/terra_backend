import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { NotificationRealtimeService } from './notification-realtime.service';
import { AccessTokenPayload } from '../auth/types/auth.types';

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
  };
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed'), false);
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25_000,
  pingTimeout: 20_000,
  maxHttpBufferSize: 1_000_000,
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly realtime: NotificationRealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.setServer(server);
  }

  async handleConnection(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const token = this.extractToken(client);

    if (!token) {
      this.disconnectUnauthorized(client);
      return;
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);

      if (payload.type !== 'access' || !payload.sub) {
        throw new UnauthorizedException();
      }

      client.data.userId = payload.sub;
      await client.join(this.realtime.roomName(payload.sub));

      this.scheduleDisconnectAtTokenExpiry(client, payload);

      client.emit('connection.ready', {
        userId: payload.sub,
      });
    } catch {
      this.disconnectUnauthorized(client);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    // Socket.IO handles room cleanup automatically.
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;

    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    const authorization = client.handshake.headers.authorization;

    if (typeof authorization === 'string') {
      return authorization.replace(/^Bearer\s+/i, '');
    }

    return null;
  }

  private scheduleDisconnectAtTokenExpiry(
    client: AuthenticatedSocket,
    payload: AccessTokenPayload,
  ) {
    if (!payload.exp) {
      return;
    }

    const delay = Math.max(0, payload.exp * 1000 - Date.now());

    const timer = setTimeout(() => {
      if (client.connected) {
        client.emit('auth.expired');
        client.disconnect(true);
      }
    }, delay);

    timer.unref?.();
  }

  private disconnectUnauthorized(client: Socket) {
    client.emit('auth.error', {
      code: 'UNAUTHORIZED',
    });
    client.disconnect(true);
  }
}
