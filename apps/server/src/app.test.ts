import type {
  ChatMessage,
  ChatMessageCreatedEvent,
  LiveSnapshot,
  ProductFeaturedEvent,
} from '@liveflow/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildServer } from './app.js';
import type { LiveRepository } from './live-repository.js';

const servers: Awaited<ReturnType<typeof buildServer>>[] = [];

const demoSnapshot: LiveSnapshot = {
  live: {
    id: 'demo',
    title: 'LiveFlow 데모 방송',
    status: 'LIVE',
    startedAt: '2026-07-31T00:00:00.000Z',
    endedAt: null,
  },
  featuredProduct: null,
  products: [
    {
      id: 'soft-knit',
      name: '소프트 릴랙스 니트',
      description: '피부에 부드럽게 닿는 여름용 릴랙스 핏 니트입니다.',
      priceKrw: 39000,
      variants: [{ id: 'soft-knit-m', name: 'M', stock: 12 }],
    },
  ],
  lastEventSequence: 0,
  chat: {
    messages: [],
    lastMessageSequence: 0,
    hasMore: false,
  },
};

const demoChatMessage: ChatMessage = {
  id: 'message-1',
  clientMessageId: '9e3df3e8-7374-4d7a-8b2d-152b655c7d6f',
  roomId: 'demo-chat',
  liveId: 'demo',
  sender: {
    id: 'demo-viewer',
    nickname: 'Demo Viewer',
    role: 'VIEWER',
  },
  sequence: 1,
  type: 'USER',
  visibility: 'VISIBLE',
  content: '상품 사이즈가 궁금합니다.',
  createdAt: '2026-07-31T00:00:01.000Z',
};

const chatMessageCreatedEvent: ChatMessageCreatedEvent = {
  eventId: 'chat-event-1',
  liveId: 'demo',
  sequence: 1,
  type: 'chat.message.created',
  occurredAt: '2026-07-31T00:00:01.000Z',
  payload: { message: demoChatMessage },
};

const featuredProductEvent: ProductFeaturedEvent = {
  eventId: 'event-1',
  liveId: 'demo',
  sequence: 1,
  type: 'product.featured',
  occurredAt: '2026-07-31T00:00:01.000Z',
  payload: {
    product: demoSnapshot.products[0] ?? null,
  },
};

function createLiveRepository(overrides: Partial<LiveRepository> = {}): LiveRepository {
  return {
    getSnapshot: vi.fn(async (liveId: string) => (liveId === 'demo' ? demoSnapshot : null)),
    getMessages: vi.fn(async (liveId: string) => (liveId === 'demo' ? demoSnapshot.chat : null)),
    createMessage: vi.fn(async () => ({
      kind: 'created',
      event: chatMessageCreatedEvent,
    })),
    featureProduct: vi.fn(async () => ({
      kind: 'featured',
      event: featuredProductEvent,
    })),
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('GET /health', () => {
  it('returns a request-traceable liveness response', async () => {
    const app = await buildServer();
    servers.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });
    const body: unknown = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      service: 'liveflow-server',
    });
  });
});

describe('live product routes', () => {
  it('issues an admin token only after the configured demo password is verified', async () => {
    const app = await buildServer({
      demoAdminPassword: 'correct-demo-password',
      liveRepository: createLiveRepository(),
    });
    servers.push(app);

    const deniedResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/demo/admin-session',
      payload: { password: 'incorrect-password' },
    });
    const grantedResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/demo/admin-session',
      payload: { password: 'correct-demo-password' },
    });

    expect(deniedResponse.statusCode).toBe(401);
    expect(grantedResponse.statusCode).toBe(200);
    expect(grantedResponse.json()).toMatchObject({
      accessToken: expect.any(String),
      role: 'ADMIN',
    });
  });

  it('returns a persisted live snapshot through the public API', async () => {
    const app = await buildServer({ liveRepository: createLiveRepository() });
    servers.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/lives/demo/snapshot',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      live: { id: 'demo', status: 'LIVE' },
      products: [{ id: 'soft-knit' }],
      lastEventSequence: 0,
    });
  });

  it('blocks a viewer from changing the featured product', async () => {
    const liveRepository = createLiveRepository();
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const viewerToken = app.jwt.sign({ userId: 'demo-viewer', role: 'VIEWER' });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/lives/demo/featured-product',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { productId: 'soft-knit' },
    });

    expect(response.statusCode).toBe(403);
    expect(liveRepository.featureProduct).not.toHaveBeenCalled();
  });

  it('publishes only the event returned after an admin feature update succeeds', async () => {
    const liveRepository = createLiveRepository();
    const publishRealtimeEvent = vi.fn();
    const app = await buildServer({ liveRepository, publishRealtimeEvent });
    servers.push(app);
    const adminToken = app.jwt.sign({ userId: 'demo-admin', role: 'ADMIN' });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/lives/demo/featured-product',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { productId: 'soft-knit' },
    });

    expect(response.statusCode).toBe(200);
    expect(liveRepository.featureProduct).toHaveBeenCalledWith({
      liveId: 'demo',
      productId: 'soft-knit',
      actorId: 'demo-admin',
    });
    expect(publishRealtimeEvent).toHaveBeenCalledWith(featuredProductEvent);
  });
});

describe('chat routes', () => {
  it('returns cursor-based messages and rejects unauthenticated writes', async () => {
    const liveRepository = createLiveRepository();
    const app = await buildServer({ liveRepository });
    servers.push(app);

    const messagesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/lives/demo/messages?afterSequence=0&limit=50',
    });
    const deniedResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/lives/demo/messages',
      payload: {
        clientMessageId: demoChatMessage.clientMessageId,
        content: demoChatMessage.content,
      },
    });

    expect(messagesResponse.statusCode).toBe(200);
    expect(messagesResponse.json()).toMatchObject({
      lastMessageSequence: 0,
      hasMore: false,
    });
    expect(deniedResponse.statusCode).toBe(401);
    expect(liveRepository.createMessage).not.toHaveBeenCalled();
  });

  it('publishes only a newly persisted message, not an idempotent retry', async () => {
    const createMessage = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'created', event: chatMessageCreatedEvent })
      .mockResolvedValueOnce({ kind: 'idempotent', message: demoChatMessage });
    const liveRepository = createLiveRepository({ createMessage });
    const publishRealtimeEvent = vi.fn();
    const app = await buildServer({ liveRepository, publishRealtimeEvent });
    servers.push(app);
    const viewerToken = app.jwt.sign({ userId: 'demo-viewer', role: 'VIEWER' });
    const request = {
      method: 'POST' as const,
      url: '/api/v1/lives/demo/messages',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: {
        clientMessageId: demoChatMessage.clientMessageId,
        content: demoChatMessage.content,
      },
    };

    const createdResponse = await app.inject(request);
    const retriedResponse = await app.inject(request);

    expect(createdResponse.statusCode).toBe(200);
    expect(retriedResponse.statusCode).toBe(200);
    expect(createdResponse.json()).toMatchObject({ id: demoChatMessage.id });
    expect(retriedResponse.json()).toMatchObject({ id: demoChatMessage.id });
    expect(createMessage).toHaveBeenCalledTimes(2);
    expect(publishRealtimeEvent).toHaveBeenCalledTimes(1);
    expect(publishRealtimeEvent).toHaveBeenCalledWith(chatMessageCreatedEvent);
  });
});
