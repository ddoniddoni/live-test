import type {
  AdminOrder,
  AiSuggestion,
  AiSuggestionCreatedEvent,
  AnnouncementPublishedEvent,
  AuditLogPage,
  ChatMessage,
  ChatMessageCreatedEvent,
  ChatMessageHiddenEvent,
  ChatUserTimedOutEvent,
  CouponPublishedEvent,
  InventoryUpdatedEvent,
  InventoryLowEvent,
  LiveStatusChangedEvent,
  LiveSnapshot,
  Order,
  OrderCreatedEvent,
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
  latestAnnouncement: null,
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

const liveStartedEvent: LiveStatusChangedEvent = {
  eventId: 'live-started-event-1',
  liveId: 'demo',
  sequence: 1,
  type: 'live.status.changed',
  occurredAt: '2026-08-02T00:00:00.000Z',
  payload: {
    live: {
      ...demoSnapshot.live,
      status: 'LIVE',
      startedAt: '2026-08-02T00:00:00.000Z',
      endedAt: null,
    },
  },
};

const liveEndedEvent: LiveStatusChangedEvent = {
  eventId: 'live-ended-event-1',
  liveId: 'demo',
  sequence: 2,
  type: 'live.status.changed',
  occurredAt: '2026-08-02T01:00:00.000Z',
  payload: {
    live: {
      ...liveStartedEvent.payload.live,
      status: 'ENDED',
      endedAt: '2026-08-02T01:00:00.000Z',
    },
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

const demoAdminOrder: AdminOrder = {
  ...demoOrder,
  customer: {
    id: 'demo-viewer',
    nickname: 'Demo Viewer',
  },
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

const orderCreatedEvent: OrderCreatedEvent = {
  eventId: 'order-created-event-1',
  liveId: 'demo',
  sequence: 7,
  type: 'order.created',
  occurredAt: '2026-07-31T00:00:05.000Z',
  payload: { order: demoAdminOrder },
};

const inventoryLowEvent: InventoryLowEvent = {
  eventId: 'inventory-low-event-1',
  liveId: 'demo',
  sequence: 8,
  type: 'inventory.low',
  occurredAt: '2026-07-31T00:00:05.000Z',
  payload: {
    productId: 'soft-knit',
    productName: '소프트 릴랙스 니트',
    productVariantId: 'soft-knit-m',
    variantName: 'M',
    stock: 5,
    threshold: 5,
  },
};

const demoAiSuggestion: AiSuggestion = {
  id: 'suggestion-1',
  liveId: 'demo',
  type: 'CHAT_SUMMARY',
  provider: 'mock',
  modelOrMockVersion: 'chat-summary-v1',
  inputHash: 'b'.repeat(64),
  output: {
    groups: [
      {
        topic: '배송 문의',
        count: 2,
        exampleMessageIds: ['message-1'],
        suggestedAnswer: '배송 일정은 운영자가 확인한 뒤 정확한 내용으로 안내드리겠습니다.',
        sourceIds: ['chat.messages'],
        risk: 'MEDIUM',
      },
    ],
    overallSentiment: 'NEUTRAL',
    requiresImmediateAttention: false,
  },
  status: 'PENDING',
  reviewedBy: null,
  reviewedAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
};

const aiSuggestionCreatedEvent: AiSuggestionCreatedEvent = {
  eventId: 'ai-suggestion-event-1',
  liveId: 'demo',
  sequence: 7,
  type: 'ai.suggestion.created',
  occurredAt: '2026-08-01T00:00:00.000Z',
  payload: { suggestion: demoAiSuggestion },
};

const announcementPublishedEvent: AnnouncementPublishedEvent = {
  eventId: 'announcement-event-1',
  liveId: 'demo',
  sequence: 8,
  type: 'announcement.published',
  occurredAt: '2026-08-01T00:00:01.000Z',
  payload: {
    announcement: {
      id: 'announcement-1',
      liveId: 'demo',
      content: '배송 일정은 운영자가 확인한 뒤 정확한 내용으로 안내드리겠습니다.',
      createdBy: 'demo-admin',
      sourceSuggestionId: demoAiSuggestion.id,
      createdAt: '2026-08-01T00:00:01.000Z',
    },
  },
};

const directAnnouncementPublishedEvent: AnnouncementPublishedEvent = {
  ...announcementPublishedEvent,
  eventId: 'announcement-event-2',
  payload: {
    announcement: {
      ...announcementPublishedEvent.payload.announcement,
      id: 'announcement-2',
      sourceSuggestionId: null,
    },
  },
};

const auditLogPage: AuditLogPage = {
  logs: [
    {
      id: 'audit-log-1',
      liveId: 'demo',
      actor: {
        id: 'demo-admin',
        nickname: 'LiveFlow Admin',
      },
      action: 'LIVE_STARTED',
      entityType: 'LIVE_SESSION',
      entityId: 'demo',
      createdAt: '2026-08-02T00:00:00.000Z',
    },
  ],
  nextCursor: null,
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
      inventoryLowEvent: null,
      couponEvent: null,
      orderEvent: orderStatusChangedEvent,
      adminOrderEvent: orderCreatedEvent,
    })),
    getRecentOrders: vi.fn(async () => ({
      kind: 'found',
      orders: [demoAdminOrder],
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
    publishAnnouncement: vi.fn(async () => ({
      kind: 'published',
      event: directAnnouncementPublishedEvent,
    })),
    featureProduct: vi.fn(async () => ({
      kind: 'featured',
      event: featuredProductEvent,
    })),
    changeLiveStatus: vi.fn(async ({ action }) => ({
      kind: 'changed',
      event: action === 'START' ? liveStartedEvent : liveEndedEvent,
    })),
    getAuditLogs: vi.fn(async () => ({
      kind: 'found',
      page: auditLogPage,
    })),
    getAiSuggestions: vi.fn(async () => ({
      kind: 'found',
      suggestions: [demoAiSuggestion],
    })),
    createAiSuggestion: vi.fn(async () => ({
      kind: 'created',
      suggestion: demoAiSuggestion,
      event: aiSuggestionCreatedEvent,
    })),
    reviewAiSuggestion: vi.fn(async () => ({
      kind: 'approved',
      suggestion: {
        ...demoAiSuggestion,
        status: 'APPROVED' as const,
        reviewedBy: 'demo-admin',
        reviewedAt: '2026-08-01T00:00:01.000Z',
      },
      event: announcementPublishedEvent,
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

  it('allows only admins to read a cursor-based audit log page', async () => {
    const liveRepository = createLiveRepository();
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');

    const deniedResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/lives/demo/audit-logs?limit=10',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    const grantedResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/lives/demo/audit-logs?limit=10',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(deniedResponse.statusCode).toBe(403);
    expect(grantedResponse.statusCode).toBe(200);
    expect(grantedResponse.json()).toEqual(auditLogPage);
    expect(liveRepository.getAuditLogs).toHaveBeenCalledTimes(1);
    expect(liveRepository.getAuditLogs).toHaveBeenCalledWith('demo', { limit: 10 });
  });

  it('allows only admins to start and end a persisted live broadcast', async () => {
    const liveRepository = createLiveRepository();
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishRealtimeEvent = vi.spyOn(app.get(LiveGateway), 'publish');
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');

    const deniedResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/lives/demo/start',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    const startedResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/lives/demo/start',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const endedResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/lives/demo/end',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(deniedResponse.statusCode).toBe(403);
    expect(startedResponse.statusCode).toBe(200);
    expect(endedResponse.statusCode).toBe(200);
    expect(liveRepository.changeLiveStatus).toHaveBeenCalledTimes(2);
    expect(liveRepository.changeLiveStatus).toHaveBeenNthCalledWith(1, {
      liveId: 'demo',
      actorId: 'demo-admin',
      action: 'START',
    });
    expect(liveRepository.changeLiveStatus).toHaveBeenNthCalledWith(2, {
      liveId: 'demo',
      actorId: 'demo-admin',
      action: 'END',
    });
    expect(publishRealtimeEvent).toHaveBeenCalledWith(liveStartedEvent);
    expect(publishRealtimeEvent).toHaveBeenCalledWith(liveEndedEvent);
  });

  it('does not emit an event when the server rejects an invalid live status transition', async () => {
    const liveRepository = createLiveRepository({
      changeLiveStatus: vi.fn(async () => ({ kind: 'invalid_status_transition' as const })),
    });
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishRealtimeEvent = vi.spyOn(app.get(LiveGateway), 'publish');
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/lives/demo/start',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'LIVE_STATUS_TRANSITION_INVALID' });
    expect(publishRealtimeEvent).not.toHaveBeenCalled();
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

  it('allows only admins to read recent orders for a live broadcast', async () => {
    const liveRepository = createLiveRepository();
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');

    const deniedResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/lives/demo/orders?limit=10',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    const grantedResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/lives/demo/orders?limit=10',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(deniedResponse.statusCode).toBe(403);
    expect(grantedResponse.statusCode).toBe(200);
    expect(grantedResponse.json()).toEqual([demoAdminOrder]);
    expect(liveRepository.getRecentOrders).toHaveBeenCalledWith('demo', { limit: 10 });
  });

  it('allows only an admin to publish a direct announcement and broadcasts the persisted event', async () => {
    const liveRepository = createLiveRepository();
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishRealtimeEvent = vi.spyOn(app.get(LiveGateway), 'publish');
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');
    const request = {
      method: 'POST' as const,
      url: '/api/v1/admin/lives/demo/announcements',
      payload: { content: '배송 일정은 오늘 오후 운영자가 다시 안내드리겠습니다.' },
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
    expect(grantedResponse.json()).toMatchObject(directAnnouncementPublishedEvent);
    expect(liveRepository.publishAnnouncement).toHaveBeenCalledWith({
      liveId: 'demo',
      actorId: 'demo-admin',
      content: request.payload.content,
    });
    expect(publishRealtimeEvent).toHaveBeenCalledWith(directAnnouncementPublishedEvent);
  });

  it('creates one viewer order for an idempotency key and emits only its persisted events', async () => {
    const createOrder = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'created',
        order: demoOrder,
        inventoryEvent: inventoryUpdatedEvent,
        inventoryLowEvent,
        couponEvent: null,
        orderEvent: orderStatusChangedEvent,
        adminOrderEvent: orderCreatedEvent,
      })
      .mockResolvedValueOnce({ kind: 'idempotent', order: demoOrder });
    const liveRepository = createLiveRepository({ createOrder });
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishRealtimeEvent = vi.spyOn(app.get(LiveGateway), 'publish');
    const publishToAdmins = vi.spyOn(app.get(LiveGateway), 'publishToAdmins');
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
    expect(publishToAdmins).toHaveBeenCalledWith(orderCreatedEvent);
    expect(publishToAdmins).toHaveBeenCalledWith(inventoryLowEvent);
  });
});

describe('admin AI suggestion routes', () => {
  it('lets only admins create a persisted summary and emits it to the admin room', async () => {
    const liveRepository = createLiveRepository({
      getMessages: vi.fn(async () => ({
        messages: [demoChatMessage],
        lastMessageSequence: 1,
        hasMore: false,
      })),
    });
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishToAdmins = vi.spyOn(app.get(LiveGateway), 'publishToAdmins');
    const publishToViewers = vi.spyOn(app.get(LiveGateway), 'publish');
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');
    const request = {
      method: 'POST' as const,
      url: '/api/v1/admin/lives/demo/ai/chat-summaries',
      payload: { maxMessages: 100 },
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
    expect(grantedResponse.json()).toMatchObject({ id: demoAiSuggestion.id, status: 'PENDING' });
    expect(liveRepository.createAiSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'demo-admin', liveId: 'demo' }),
    );
    expect(publishToAdmins).toHaveBeenCalledWith(aiSuggestionCreatedEvent);
    expect(publishToViewers).not.toHaveBeenCalled();
  });

  it('publishes an AI announcement only after an admin approval succeeds', async () => {
    const liveRepository = createLiveRepository();
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const publishToViewers = vi.spyOn(app.get(LiveGateway), 'publish');
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');
    const request = {
      method: 'PATCH' as const,
      url: `/api/v1/admin/ai/suggestions/${demoAiSuggestion.id}`,
      payload: {
        action: 'APPROVE',
        announcementContent: announcementPublishedEvent.payload.announcement.content,
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
    expect(grantedResponse.statusCode).toBe(200);
    expect(liveRepository.reviewAiSuggestion).toHaveBeenCalledWith({
      actorId: 'demo-admin',
      suggestionId: demoAiSuggestion.id,
      action: 'APPROVE',
      announcementContent: announcementPublishedEvent.payload.announcement.content,
      editedOutput: undefined,
      reason: undefined,
    });
    expect(publishToViewers).toHaveBeenCalledWith(announcementPublishedEvent);
  });
});

describe('product question routes', () => {
  it('answers a viewer question with source IDs and preserves review requirements', async () => {
    const featuredSnapshot: LiveSnapshot = {
      ...demoSnapshot,
      featuredProduct: demoSnapshot.products[0] ?? null,
    };
    const liveRepository = createLiveRepository({
      getSnapshot: vi.fn(async (liveId: string) => (liveId === 'demo' ? featuredSnapshot : null)),
    });
    const app = await buildServer({ liveRepository });
    servers.push(app);
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/lives/demo/ai/product-questions',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { question: '175cm, 70kg이면 어떤 사이즈가 좋을까요?' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      sourceIds: ['product.description', 'product.variants'],
      needsHumanReview: true,
    });
  });

  it('rejects non-viewer sessions and reports unavailable providers without exposing internals', async () => {
    const featuredSnapshot: LiveSnapshot = {
      ...demoSnapshot,
      featuredProduct: demoSnapshot.products[0] ?? null,
    };
    const liveRepository = createLiveRepository({
      getSnapshot: vi.fn(async () => featuredSnapshot),
    });
    const app = await buildServer({ aiMode: 'unsupported-provider', liveRepository });
    servers.push(app);
    const adminToken = issueAccessToken(app, 'ADMIN', 'demo-admin');
    const viewerToken = issueAccessToken(app, 'VIEWER', 'demo-viewer');
    const request = {
      method: 'POST' as const,
      url: '/api/v1/lives/demo/ai/product-questions',
      payload: { question: '여름에 입기 괜찮나요?' },
    };

    const deniedResponse = await app.inject({
      ...request,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const unavailableResponse = await app.inject({
      ...request,
      headers: { authorization: `Bearer ${viewerToken}` },
    });

    expect(deniedResponse.statusCode).toBe(403);
    expect(unavailableResponse.statusCode).toBe(503);
    expect(unavailableResponse.json()).toMatchObject({
      code: 'AI_PROVIDER_UNAVAILABLE',
      message: 'AI 답변을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    });
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
