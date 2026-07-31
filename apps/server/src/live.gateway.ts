import { Inject, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayInit,
} from '@nestjs/websockets';
import { liveJoinRequestSchema, type RealtimeEvent } from '@liveflow/contracts';
import type { Server, Socket } from 'socket.io';
import { AuthService } from './auth.service.js';
import { LiveService } from './live.service.js';
import type { DemoAccessToken } from './server-configuration.js';

type ServerToClientEvents = {
  'live.event': (event: RealtimeEvent) => void;
};

type ClientToServerEvents = {
  'live.join': (
    input: unknown,
    acknowledge: (result: { ok: boolean; lastEventSequence?: number }) => void,
  ) => void;
};

type SocketData = {
  session: DemoAccessToken;
};

type LiveSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type LiveSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

@WebSocketGateway()
export class LiveGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(LiveGateway.name);

  @WebSocketServer()
  private server!: LiveSocketServer;

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(LiveService) private readonly liveService: LiveService,
  ) {}

  afterInit(server: LiveSocketServer): void {
    server.use((socket, next) => {
      const session = this.authService.verifySocketToken(socket.handshake.auth.token);

      if (!session) {
        next(new Error('UNAUTHENTICATED'));
        return;
      }

      socket.data.session = session;
      next();
    });
  }

  handleConnection(socket: LiveSocket): void {
    socket.on('live.join', (input, acknowledge) => {
      void this.joinLive(socket, input, acknowledge);
    });
  }

  publish(event: RealtimeEvent): void {
    this.server.to(toPublicRoom(event.liveId)).emit('live.event', event);
  }

  publishToUser(event: RealtimeEvent, userId: string): void {
    this.server.to(toUserRoom(userId)).emit('live.event', event);
  }

  private async joinLive(
    socket: LiveSocket,
    input: unknown,
    acknowledge: (result: { ok: boolean; lastEventSequence?: number }) => void,
  ): Promise<void> {
    const parsedInput = liveJoinRequestSchema.safeParse(input);

    if (!parsedInput.success) {
      acknowledge({ ok: false });
      return;
    }

    try {
      const snapshot = await this.liveService.getSnapshot(parsedInput.data.liveId);

      if (!snapshot) {
        acknowledge({ ok: false });
        return;
      }

      await socket.join(toPublicRoom(parsedInput.data.liveId));
      await socket.join(toUserRoom(socket.data.session.userId));
      if (socket.data.session.role === 'ADMIN') {
        await socket.join(toAdminRoom(parsedInput.data.liveId));
      }

      acknowledge({
        ok: true,
        lastEventSequence: snapshot.lastEventSequence,
      });
    } catch (error: unknown) {
      this.logger.error(
        {
          eventType: 'live.join',
          liveId: parsedInput.data.liveId,
          role: socket.data.session.role,
        },
        error instanceof Error ? error.stack : 'Unknown join error',
      );
      acknowledge({ ok: false });
    }
  }
}

function toPublicRoom(liveId: string): string {
  return `live:${liveId}:public`;
}

function toAdminRoom(liveId: string): string {
  return `live:${liveId}:admin`;
}

function toUserRoom(userId: string): string {
  return `user:${userId}`;
}
