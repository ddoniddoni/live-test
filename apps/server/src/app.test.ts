import type {
  ChatMessage,
  ChatMessageCreatedEvent,
  ChatMessageHiddenEvent,
  ChatUserTimedOutEvent,
  CouponPublishedEvent,
  InventoryUpdatedEvent,
  LiveSnapshot,
  Order,
  OrderStatusChangedEvent,
  ProductFeaturedEvent,
} from '@liveflow/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildServer } from './app.js';
import { AuthService } from './auth.service.js';
import { LiveGateway } from './live.gateway.js';
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
  activeCoupon: null,
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

const chatMessageHiddenEvent: ChatMessageHiddenEvent = {
  eventId: 'chat-hidden-event-1',
  liveId: 'demo',
  sequence: 2,
  type: 'chat.message.hidden',
  occurredAt: '2026-07-31T00:00:02.000Z',
  payload: { messageId: demoChatMessage.id },
};

const chatUserTimedOutEvent: ChatUserTimedOutEvent = {
  eventId: 'chat-timeout-event-1',
  liveId: 'demo',
  sequence: 3,
  type: 'chat.user.timed_out',
  occurredAt: '2026-07-31T00:00:03.000Z',
  payload: {
    userId: 'demo-viewer',
    expiresAt: '2026-07-31T00:10:00.000Z',
  },
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

const couponPublishedEvent: CouponPublishedEvent = {
  eventId: 'coupon-event-1',
  liveId: 'demo',
  sequence: 4,
  type: 'coupon.published',
  occurredAt: '2026-07-31T00:00:04.000Z',
  payload: {
    coupon: {
      id: 'coupon-1',
      liveId: 'demo',
      type: 'PERCENT',
      value: 10,
      minOrderAmountKrw: 30000,
      startsAt: '2026-07-31T00:00:00.000Z',
      endsAt: '2026-07-31T01:00:00.000Z',
      usageLimit: 100,
      usedCount: 0,
      status: 'PUBLISHED',
    },
  },
};

const demoOrder: Order = {
  id: 'order-1',
  userId: 'demo-viewer',
  liveId: 'demo',
  couponId: null,
  status: 'PAID',
  subtotalKrw: 39000,
  discountKrw: 0,
  totalKrw: 39000,
  createdAt: '2026-07-31T00:00:05.000Z',
  items: [
    {
      id: 'order-item-1',
      productVariantId: 'soft-knit-m',
      productId: 'soft-knit',
      productName: '소프트 릴랙스 니트',
      variantName: 'M',
      quantity: 1,
      unitPriceKrw: 39000,
    },
  ],
};

const inventoryUpdatedEvent: InventoryUpdatedEvent = {
  eventId: 'inventory-event-1',
  liveId: 'demo',
  sequence: 5,
  type: 'inventory.updated',
  occurredAt: '2026-07-31T00:00:05.000Z',
  payload: {
    productId: 'soft-knit',
    productVariantId: 'soft-knit-m',
    stock: 11,
  },
};

const orderStatusChangedEvent: OrderStatusChangedEvent = {
  eventId: 'order-event-1',
  liveId: 'demo',
  sequence: 6,
  type: 'order.status.changed',
  occurredAt: '2026-07-31T00:00:05.000Z',
  payload: { order: demoOrder },
};

function createLiveRepository(overrides: Partial<LiveRepository> = {}): LiveRepository {
  return {
    getSnapshot: vi.fn(async (liveId: string) => (liveId === 'demo' ? demoSnapshot : null)),
    getMessages: vi.fn(async (liveId: string) => (liveId === 'demo' ? demoSnapshot.chat : null)),
    getChatAccess: vi.fn(async (liveId: string) =>
      liveId === 'demo'
        ? { kind: 'found' as const, access: { timeoutExpiresAt: null } }
        : { kind: 'live_not_found' as const },
    ),
    createMessage: vi.fn(async () => ({
      kind: 'created',
      event: chatMessageCreatedEvent,
    })),
    createOrder: vi.fn(async () => ({
      kind: 'created',
      order: demoOrder,
      inventoryEvent: inventoryUpdatedEvent,
      couponEvent: null,
      orderEvent: orderStatusChangedEvent,
    })),
    hideMessage: vi.fn(async () => ({
      kind: 'hidden',
      event: chatMessageHiddenEvent,
    })),
    timeoutUser: vi.fn(async () => ({
      kind: 'timed_out',
      event: chatUserTimedOutEvent,
    })),
    publishCoupon: vi.fn(async () => ({
      kind: 'published',
      event: couponPublishedEvent,
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
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');

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
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishRealtimeEvent = vi.spyOn(app.get(LiveGateway), 'publish');
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');

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

  it('allows only an admin to publish a valid coupon and broadcasts the persisted event', async () => {
    const liveRepository = createLiveRepository();
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishRealtimeEvent = vi.spyOn(app.get(LiveGateway), 'publish');
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');
    const request = {
      method: 'POST' as const,
      url: '/api/v1/admin/lives/demo/coupons',
      payload: {
        type: 'PERCENT',
        value: 10,
        minOrderAmountKrw: 30000,
        endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        usageLimit: 100,
      },
    };

    const deniedResponse = await app.inject({
      ...request,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    const grantedResponse = await app.inject({
      ...request,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(deniedResponse.statusCode).toBe(403);
    expect(grantedResponse.statusCode).toBe(201);
    expect(grantedResponse.json()).toMatchObject(couponPublishedEvent);
    expect(liveRepository.publishCoupon).toHaveBeenCalledWith({
      liveId: 'demo',
      actorId: 'demo-admin',
      type: 'PERCENT',
      value: 10,
      minOrderAmountKrw: 30000,
      endsAt: request.payload.endsAt,
      usageLimit: 100,
    });
    expect(publishRealtimeEvent).toHaveBeenCalledWith(couponPublishedEvent);
  });

  it('creates one viewer order for an idempotency key and emits only its persisted events', async () => {
    const createOrder = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'created',
        order: demoOrder,
        inventoryEvent: inventoryUpdatedEvent,
        couponEvent: null,
        orderEvent: orderStatusChangedEvent,
      })
      .mockResolvedValueOnce({ kind: 'idempotent', order: demoOrder });
    const liveRepository = createLiveRepository({ createOrder });
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishRealtimeEvent = vi.spyOn(app.get(LiveGateway), 'publish');
    const publishToUser = vi.spyOn(app.get(LiveGateway), 'publishToUser');
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');
    const request = {
      method: 'POST' as const,
      url: '/api/v1/orders',
      headers: {
        authorization: `Bearer ${viewerToken}`,
        'idempotency-key': 'b6a08796-0d9c-4614-9e25-6bd175a5a1fc',
      },
      payload: { liveId: 'demo', productVariantId: 'soft-knit-m', quantity: 1 },
    };

    const missingKeyResponse = await app.inject({
      method: request.method,
      url: request.url,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: request.payload,
    });
    const deniedResponse = await app.inject({
      ...request,
      headers: { ...request.headers, authorization: `Bearer ${adminToken}` },
    });
    const createdResponse = await app.inject(request);
    const retriedResponse = await app.inject(request);

    expect(missingKeyResponse.statusCode).toBe(400);
    expect(missingKeyResponse.json()).toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    expect(deniedResponse.statusCode).toBe(403);
    expect(createdResponse.statusCode).toBe(200);
    expect(retriedResponse.statusCode).toBe(200);
    expect(createdResponse.json()).toMatchObject({ id: demoOrder.id, totalKrw: 39000 });
    expect(createOrder).toHaveBeenCalledTimes(2);
    expect(createOrder).toHaveBeenCalledWith({
      liveId: 'demo',
      userId: 'demo-viewer',
      productVariantId: 'soft-knit-m',
      quantity: 1,
      idempotencyKey: request.headers['idempotency-key'],
    });
    expect(publishRealtimeEvent).toHaveBeenCalledTimes(1);
    expect(publishRealtimeEvent).toHaveBeenCalledWith(inventoryUpdatedEvent);
    expect(publishToUser).toHaveBeenCalledTimes(1);
    expect(publishToUser).toHaveBeenCalledWith(orderStatusChangedEvent, 'demo-viewer');
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
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishRealtimeEvent = vi.spyOn(app.get(LiveGateway), 'publish');
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');
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

  it('returns a timeout error when the repository rejects a viewer message', async () => {
    const liveRepository = createLiveRepository({
      createMessage: vi.fn(async () => ({
        kind: 'user_timed_out' as const,
        expiresAt: '2026-07-31T00:10:00.000Z',
      })),
    });
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/lives/demo/messages',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: {
        clientMessageId: demoChatMessage.clientMessageId,
        content: demoChatMessage.content,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'CHAT_TIMEOUT_ACTIVE' });
  });

  it('allows only an admin to hide a message and publishes the persisted event', async () => {
    const liveRepository = createLiveRepository();
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishRealtimeEvent = vi.spyOn(app.get(LiveGateway), 'publish');
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');
    const request = {
      method: 'PUT' as const,
      url: `/api/v1/admin/lives/demo/messages/${demoChatMessage.id}/hide`,
      payload: { reason: '도배성 메시지' },
    };

    const deniedResponse = await app.inject({
      ...request,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    const grantedResponse = await app.inject({
      ...request,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(deniedResponse.statusCode).toBe(403);
    expect(grantedResponse.statusCode).toBe(200);
    expect(grantedResponse.json()).toMatchObject(chatMessageHiddenEvent);
    expect(liveRepository.hideMessage).toHaveBeenCalledTimes(1);
    expect(liveRepository.hideMessage).toHaveBeenCalledWith({
      liveId: 'demo',
      messageId: demoChatMessage.id,
      actorId: 'demo-admin',
      reason: '도배성 메시지',
    });
    expect(publishRealtimeEvent).toHaveBeenCalledWith(chatMessageHiddenEvent);
  });

  it('allows only an admin to set a viewer timeout and sends the event to that viewer', async () => {
    const liveRepository = createLiveRepository();
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishToUser = vi.spyOn(app.get(LiveGateway), 'publishToUser');
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');
    const request = {
      method: 'PUT' as const,
      url: '/api/v1/admin/lives/demo/users/demo-viewer/chat-timeout',
      payload: { durationMinutes: 10, reason: '반복 메시지' },
    };

    const deniedResponse = await app.inject({
      ...request,
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    const grantedResponse = await app.inject({
      ...request,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(deniedResponse.statusCode).toBe(403);
    expect(grantedResponse.statusCode).toBe(200);
    expect(grantedResponse.json()).toMatchObject(chatUserTimedOutEvent);
    expect(liveRepository.timeoutUser).toHaveBeenCalledWith({
      liveId: 'demo',
      userId: 'demo-viewer',
      actorId: 'demo-admin',
      durationMinutes: 10,
      reason: '반복 메시지',
    });
    expect(publishToUser).toHaveBeenCalledWith(chatUserTimedOutEvent, 'demo-viewer');
  });

  it('returns only the authenticated viewer chat-access status', async () => {
    const liveRepository = createLiveRepository({
      getChatAccess: vi.fn(async () => ({
        kind: 'found' as const,
        access: { timeoutExpiresAt: '2026-07-31T00:10:00.000Z' },
      })),
    });
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/lives/demo/chat-access',
      headers: { authorization: `Bearer ${viewerToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ timeoutExpiresAt: '2026-07-31T00:10:00.000Z' });
    expect(liveRepository.getChatAccess).toHaveBeenCalledWith('demo', 'demo-viewer');
  });
});

function issueAccessToken(
  app: Awaited<ReturnType<typeof buildServer>>,
  role: 'VIEWER' | 'ADMIN',
  userId: string,
): string {
  return app.get(AuthService).issueDemoSession(role, userId).accessToken;
}
