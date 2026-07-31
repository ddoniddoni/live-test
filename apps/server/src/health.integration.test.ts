import type {
  ChatUserTimedOutEvent,
  LiveSnapshot,
  ProductFeaturedEvent,
} from '@liveflow/contracts';
import { io } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from './app.js';
import { AuthService } from './auth.service.js';
import { LiveGateway } from './live.gateway.js';
import type { LiveRepository } from './live-repository.js';

const servers: Awaited<ReturnType<typeof buildServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('health integration', () => {
  it('assigns a unique request ID to the health response', async () => {
    const app = await buildServer();
    servers.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });
    const body: unknown = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      requestId: expect.any(String),
      timestamp: expect.any(String),
    });
  });

  it('serves authenticated Socket.IO rooms from the same HTTP server', async () => {
    const app = await buildServer({ liveRepository: socketTestLiveRepository });
    servers.push(app);
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected the Nest Fastify server to listen on a TCP port.');
    }

    const token = app.get(AuthService).issueDemoSession('VIEWER', 'demo-viewer').accessToken;
    const socket = io(`http://127.0.0.1:${address.port}`, {
      auth: { token },
      transports: ['websocket'],
    });

    try {
      await waitForSocketConnection(socket);
      const joinResult = await new Promise<{ ok: boolean; lastEventSequence?: number }>(
        (resolve) => {
          socket.emit('live.join', { liveId: 'demo', lastEventSequence: 0 }, resolve);
        },
      );

      expect(joinResult).toEqual({ ok: true, lastEventSequence: 2 });
      const eventPromise = waitForRealtimeEvent(socket);
      app.get(LiveGateway).publish(socketProductEvent);

      await expect(eventPromise).resolves.toEqual(socketProductEvent);
      const privateEventPromise = waitForRealtimeEvent(socket);
      app.get(LiveGateway).publishToUser(socketTimeoutEvent, 'demo-viewer');

      await expect(privateEventPromise).resolves.toEqual(socketTimeoutEvent);
    } finally {
      socket.close();
    }
  });
});

const socketTestSnapshot: LiveSnapshot = {
  live: {
    id: 'demo',
    title: 'Socket test live',
    status: 'LIVE',
    startedAt: '2026-07-31T00:00:00.000Z',
    endedAt: null,
  },
  featuredProduct: null,
  activeCoupon: null,
  products: [],
  lastEventSequence: 2,
  chat: {
    messages: [],
    lastMessageSequence: 0,
    hasMore: false,
  },
};

const socketProductEvent: ProductFeaturedEvent = {
  eventId: 'socket-event-1',
  liveId: 'demo',
  sequence: 3,
  type: 'product.featured',
  occurredAt: '2026-07-31T00:00:01.000Z',
  payload: { product: null },
};

const socketTimeoutEvent: ChatUserTimedOutEvent = {
  eventId: 'socket-timeout-event-1',
  liveId: 'demo',
  sequence: 4,
  type: 'chat.user.timed_out',
  occurredAt: '2026-07-31T00:00:02.000Z',
  payload: {
    userId: 'demo-viewer',
    expiresAt: '2026-07-31T00:10:00.000Z',
  },
};

const socketTestLiveRepository: LiveRepository = {
  async getSnapshot(liveId) {
    return liveId === 'demo' ? socketTestSnapshot : null;
  },
  async getMessages() {
    return null;
  },
  async getChatAccess() {
    return { kind: 'found', access: { timeoutExpiresAt: null } };
  },
  async createMessage() {
    throw new Error('This integration test does not create messages.');
  },
  async createOrder() {
    return { kind: 'live_not_found' };
  },
  async hideMessage() {
    return { kind: 'message_not_found' };
  },
  async timeoutUser() {
    return { kind: 'user_not_found' };
  },
  async publishCoupon() {
    return { kind: 'live_not_found' };
  },
  async featureProduct() {
    return { kind: 'live_not_found' };
  },
};

function waitForSocketConnection(socket: ReturnType<typeof io>): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Socket connection timed out.'));
    }, 5_000);

    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function waitForRealtimeEvent(
  socket: ReturnType<typeof io>,
): Promise<ProductFeaturedEvent | ChatUserTimedOutEvent> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Realtime event timed out.'));
    }, 5_000);

    socket.once('live.event', (event: ProductFeaturedEvent | ChatUserTimedOutEvent) => {
      clearTimeout(timeout);
      resolve(event);
    });
  });
}
