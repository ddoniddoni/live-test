import { describe, expect, it } from 'vitest';

import {
  adminLiveListQuerySchema,
  adminLiveListSchema,
  adminOrderPageSchema,
  adminOrdersQuerySchema,
  aiChatSummarySchema,
  aiProductAnswerSchema,
  adminOrderListSchema,
  announcementPublishedEventSchema,
  auditLogPageSchema,
  auditLogsQuerySchema,
  chatAccessStatusSchema,
  chatMessageHiddenEventSchema,
  chatMessagesQuerySchema,
  chatTimeoutUserRequestSchema,
  chatUserTimedOutEventSchema,
  couponPublishedEventSchema,
  couponRedeemedEventSchema,
  createAiChatSummaryRequestSchema,
  createChatMessageRequestSchema,
  createNextLiveSessionResponseSchema,
  createProductQuestionRequestSchema,
  createOrderRequestSchema,
  healthResponseSchema,
  hideChatMessageRequestSchema,
  liveMetricsSchema,
  liveSnapshotSchema,
  productFeaturedEventSchema,
  inventoryUpdatedEventSchema,
  inventoryLowEventSchema,
  liveStatusChangedEventSchema,
  orderParamsSchema,
  orderSchema,
  orderCreatedEventSchema,
  orderStatusChangedEventSchema,
  ordersQuerySchema,
  publishAnnouncementRequestSchema,
  publishCouponRequestSchema,
  reviewAiSuggestionRequestSchema,
  roleSchema,
  createLiveDraftRequestSchema,
  liveProductListSchema,
  liveStatusSchema,
  liveStatusTransitionActionSchema,
  replaceLiveProductsRequestSchema,
} from './index.js';

describe('shared contracts', () => {
  it('accepts only server-issued demo roles', () => {
    expect(roleSchema.safeParse('VIEWER').success).toBe(true);
    expect(roleSchema.safeParse('ADMIN').success).toBe(true);
    expect(roleSchema.safeParse('OPERATOR').success).toBe(false);
  });

  it('requires a traceable health response', () => {
    expect(
      healthResponseSchema.safeParse({
        status: 'ok',
        service: 'liveflow-server',
        requestId: 'request-123',
        timestamp: '2026-07-30T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('accepts a persisted live snapshot with a featured product', () => {
    expect(
      liveSnapshotSchema.safeParse({
        live: {
          id: 'demo',
          title: 'LiveFlow 데모 방송',
          status: 'LIVE',
          startedAt: '2026-07-31T00:00:00.000Z',
          endedAt: null,
        },
        featuredProduct: {
          id: 'soft-knit',
          name: '소프트 릴랙스 니트',
          description: '여름 저녁에 가볍게 입는 릴랙스 핏 니트',
          priceKrw: 39000,
          variants: [{ id: 'soft-knit-m', name: 'M', stock: 12 }],
        },
        activeCoupon: null,
        latestAnnouncement: null,
        products: [],
        lastEventSequence: 4,
        chat: {
          messages: [],
          lastMessageSequence: 0,
          hasMore: false,
        },
      }).success,
    ).toBe(true);
  });

  it('accepts nonnegative persisted broadcast metrics', () => {
    expect(
      liveMetricsSchema.safeParse({
        chatMessageCount: 12,
        couponUseCount: 3,
        paidOrderCount: 4,
        pendingAiSuggestionCount: 1,
        reviewedAiSuggestionCount: 2,
        totalDiscountKrw: 6000,
        totalOrderCount: 5,
        totalRevenueKrw: 150000,
      }).success,
    ).toBe(true);
    expect(
      liveMetricsSchema.safeParse({
        chatMessageCount: -1,
        couponUseCount: 0,
        paidOrderCount: 0,
        pendingAiSuggestionCount: 0,
        reviewedAiSuggestionCount: 0,
        totalDiscountKrw: 0,
        totalOrderCount: 0,
        totalRevenueKrw: 0,
      }).success,
    ).toBe(false);
  });

  it('validates one-way live status transitions and their public realtime event', () => {
    expect(liveStatusTransitionActionSchema.safeParse('START').success).toBe(true);
    expect(liveStatusTransitionActionSchema.safeParse('RESTART').success).toBe(false);
    expect(
      liveStatusChangedEventSchema.safeParse({
        eventId: 'live-status-event-1',
        liveId: 'demo',
        sequence: 5,
        type: 'live.status.changed',
        occurredAt: '2026-08-02T00:00:00.000Z',
        payload: {
          live: {
            id: 'demo',
            title: 'LiveFlow 데모 방송',
            status: 'LIVE',
            startedAt: '2026-08-02T00:00:00.000Z',
            endedAt: null,
          },
        },
      }).success,
    ).toBe(true);
  });

  it('validates the new broadcast session returned to an administrator', () => {
    expect(
      createNextLiveSessionResponseSchema.safeParse({
        id: 'next-demo',
        title: 'LiveFlow 데모 방송',
        status: 'READY',
        startedAt: null,
        endedAt: null,
      }).success,
    ).toBe(true);
  });

  it('validates the private broadcast draft contract and list cursor', () => {
    expect(liveStatusSchema.safeParse('DRAFT').success).toBe(true);
    expect(liveStatusSchema.safeParse('SCHEDULED').success).toBe(true);
    expect(liveStatusSchema.safeParse('CANCELLED').success).toBe(true);
    expect(liveStatusSchema.safeParse('ARCHIVED').success).toBe(false);
    expect(
      createLiveDraftRequestSchema.safeParse({
        title: '가을 데일리룩 라이브',
        description: '가을 신상품을 소개하는 방송입니다.',
        scheduledStartAt: '2099-09-01T10:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      createLiveDraftRequestSchema.safeParse({
        title: ' ',
        description: '방송 설명',
        scheduledStartAt: 'not-a-date',
      }).success,
    ).toBe(false);
    expect(adminLiveListQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(
      adminLiveListSchema.safeParse({
        lives: [
          {
            id: 'draft-live',
            title: '가을 데일리룩 라이브',
            description: '가을 신상품을 소개하는 방송입니다.',
            thumbnailUrl: null,
            scheduledStartAt: '2099-09-01T10:00:00.000Z',
            status: 'DRAFT',
            startedAt: null,
            endedAt: null,
            createdAt: '2026-08-04T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      }).success,
    ).toBe(true);
  });

  it('validates an ordered, unique list of sellable broadcast products', () => {
    expect(
      replaceLiveProductsRequestSchema.safeParse({
        productIds: ['soft-knit', 'linen-shirt'],
      }).success,
    ).toBe(true);
    expect(
      replaceLiveProductsRequestSchema.safeParse({
        productIds: ['soft-knit', 'soft-knit'],
      }).success,
    ).toBe(false);
    expect(liveStatusTransitionActionSchema.safeParse('SCHEDULE').success).toBe(true);
    expect(liveStatusTransitionActionSchema.safeParse('PREPARE').success).toBe(true);
    expect(
      liveProductListSchema.safeParse([
        {
          liveId: 'draft-live',
          displayOrder: 0,
          product: {
            id: 'soft-knit',
            name: '소프트 릴랙스 니트',
            description: '피부에 부드럽게 닿는 여름용 릴랙스 핏 니트입니다.',
            priceKrw: 39000,
            variants: [{ id: 'soft-knit-m', name: 'M', stock: 12 }],
          },
        },
      ]).success,
    ).toBe(true);
  });

  it('validates idempotent chat writes and exclusive cursor directions', () => {
    expect(
      createChatMessageRequestSchema.safeParse({
        clientMessageId: '9e3df3e8-7374-4d7a-8b2d-152b655c7d6f',
        content: '상품 사이즈가 궁금합니다.',
      }).success,
    ).toBe(true);
    expect(
      createChatMessageRequestSchema.safeParse({
        clientMessageId: 'not-a-uuid',
        content: ' ',
      }).success,
    ).toBe(false);
    expect(
      chatMessagesQuerySchema.safeParse({ beforeSequence: '10', afterSequence: '2' }).success,
    ).toBe(false);
  });

  it('requires grounded, structured answers for product questions', () => {
    expect(
      createProductQuestionRequestSchema.safeParse({ question: '여름에 입기 괜찮나요?' }).success,
    ).toBe(true);
    expect(createProductQuestionRequestSchema.safeParse({ question: ' ' }).success).toBe(false);
    expect(
      aiProductAnswerSchema.safeParse({
        answer: '등록된 상품 설명을 기준으로 여름용 니트입니다.',
        sourceIds: ['product.description'],
        confidence: 0.92,
        needsHumanReview: false,
        reason: '등록된 상품 설명을 근거로 답변했습니다.',
      }).success,
    ).toBe(true);
    expect(
      aiProductAnswerSchema.safeParse({
        answer: '근거 없는 답변',
        sourceIds: [],
        confidence: 1.2,
        needsHumanReview: false,
        reason: '',
      }).success,
    ).toBe(false);
  });

  it('validates a bounded chat summary and blocks approval without an announcement', () => {
    const summary = {
      groups: [
        {
          topic: '배송 문의',
          count: 2,
          exampleMessageIds: ['message-1'],
          suggestedAnswer: '배송 일정은 운영자가 확인한 뒤 안내드리겠습니다.',
          sourceIds: ['chat.messages'],
          risk: 'MEDIUM',
        },
      ],
      overallSentiment: 'NEUTRAL',
      requiresImmediateAttention: false,
    };

    expect(aiChatSummarySchema.safeParse(summary).success).toBe(true);
    expect(createAiChatSummaryRequestSchema.safeParse({ maxMessages: 101 }).success).toBe(false);
    expect(
      reviewAiSuggestionRequestSchema.safeParse({ action: 'APPROVE', editedOutput: summary })
        .success,
    ).toBe(false);
    expect(
      reviewAiSuggestionRequestSchema.safeParse({ action: 'REJECT', reason: '근거가 부족합니다.' })
        .success,
    ).toBe(true);
  });

  it('validates a public announcement only when it carries a persisted announcement record', () => {
    expect(
      publishAnnouncementRequestSchema.safeParse({
        content: '배송 일정은 오늘 오후 운영자가 다시 안내드리겠습니다.',
      }).success,
    ).toBe(true);
    expect(publishAnnouncementRequestSchema.safeParse({ content: ' ' }).success).toBe(false);

    expect(
      announcementPublishedEventSchema.safeParse({
        eventId: 'announcement-event-1',
        liveId: 'demo',
        sequence: 7,
        type: 'announcement.published',
        occurredAt: '2026-08-01T00:00:00.000Z',
        payload: {
          announcement: {
            id: 'announcement-1',
            liveId: 'demo',
            content: '배송 일정은 운영자가 확인한 뒤 안내드리겠습니다.',
            createdBy: 'demo-admin',
            sourceSuggestionId: null,
            createdAt: '2026-08-01T00:00:00.000Z',
          },
        },
      }).success,
    ).toBe(true);
  });

  it('validates bounded audit-log pages without exposing change payloads', () => {
    expect(auditLogsQuerySchema.safeParse({ limit: '30', cursor: 'audit-log-1' }).data).toEqual({
      limit: 30,
      cursor: 'audit-log-1',
    });
    expect(auditLogsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(
      auditLogPageSchema.safeParse({
        logs: [
          {
            id: 'audit-log-1',
            liveId: 'demo',
            actor: { id: 'demo-admin', nickname: 'LiveFlow Admin' },
            action: 'LIVE_STARTED',
            entityType: 'LIVE_SESSION',
            entityId: 'demo',
            createdAt: '2026-08-02T00:00:00.000Z',
          },
        ],
        nextCursor: null,
      }).success,
    ).toBe(true);
  });

  it('rejects malformed product featured events', () => {
    expect(
      productFeaturedEventSchema.safeParse({
        eventId: 'event-1',
        liveId: 'demo',
        sequence: 0,
        type: 'product.featured',
        occurredAt: '2026-07-31T00:00:00.000Z',
        payload: { product: null },
      }).success,
    ).toBe(false);
  });

  it('validates a publishable coupon and its public realtime event', () => {
    const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(
      publishCouponRequestSchema.safeParse({
        type: 'PERCENT',
        value: 10,
        minOrderAmountKrw: 30000,
        endsAt,
        usageLimit: 100,
      }).success,
    ).toBe(true);
    expect(
      publishCouponRequestSchema.safeParse({
        type: 'PERCENT',
        value: 101,
        minOrderAmountKrw: 0,
        endsAt,
        usageLimit: null,
      }).success,
    ).toBe(false);
    expect(
      couponPublishedEventSchema.safeParse({
        eventId: 'coupon-event-1',
        liveId: 'demo',
        sequence: 7,
        type: 'coupon.published',
        occurredAt: '2026-07-31T00:00:00.000Z',
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
      }).success,
    ).toBe(true);
  });

  it('validates a bounded admin order list and low-stock alert event', () => {
    const order = {
      id: 'order-1',
      userId: 'demo-viewer',
      liveId: 'demo',
      couponId: null,
      status: 'PAID',
      subtotalKrw: 39000,
      discountKrw: 0,
      totalKrw: 39000,
      createdAt: '2026-08-02T00:00:00.000Z',
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
      customer: { id: 'demo-viewer', nickname: 'Demo Viewer' },
    };

    expect(ordersQuerySchema.safeParse({ limit: '10' }).data).toEqual({ limit: 10 });
    expect(ordersQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(adminOrderListSchema.safeParse([order]).success).toBe(true);
    expect(
      orderCreatedEventSchema.safeParse({
        eventId: 'order-created-1',
        liveId: 'demo',
        sequence: 9,
        type: 'order.created',
        occurredAt: '2026-08-02T00:00:00.000Z',
        payload: { order },
      }).success,
    ).toBe(true);
    expect(
      inventoryLowEventSchema.safeParse({
        eventId: 'inventory-low-1',
        liveId: 'demo',
        sequence: 10,
        type: 'inventory.low',
        occurredAt: '2026-08-02T00:00:00.000Z',
        payload: {
          productId: 'soft-knit',
          productName: '소프트 릴랙스 니트',
          productVariantId: 'soft-knit-m',
          variantName: 'M',
          stock: 5,
          threshold: 5,
        },
      }).success,
    ).toBe(true);
  });

  it('validates server-authoritative order writes and their realtime events', () => {
    const order = {
      id: 'order-1',
      userId: 'demo-viewer',
      liveId: 'demo',
      couponId: 'coupon-1',
      status: 'PAID',
      subtotalKrw: 39_000,
      discountKrw: 3_900,
      totalKrw: 35_100,
      createdAt: '2026-07-31T00:00:00.000Z',
      items: [
        {
          id: 'order-item-1',
          productVariantId: 'soft-knit-m',
          productId: 'soft-knit',
          productName: '소프트 릴랙스 니트',
          variantName: 'M',
          quantity: 1,
          unitPriceKrw: 39_000,
        },
      ],
    };

    expect(
      createOrderRequestSchema.safeParse({
        liveId: 'demo',
        productVariantId: 'soft-knit-m',
        quantity: '1',
      }).success,
    ).toBe(true);
    expect(
      createOrderRequestSchema.safeParse({ liveId: 'demo', productVariantId: 'x', quantity: 0 })
        .success,
    ).toBe(false);
    expect(orderSchema.safeParse(order).success).toBe(true);
    expect(orderParamsSchema.safeParse({ orderId: 'order-1' }).success).toBe(true);
    expect(orderParamsSchema.safeParse({ orderId: '' }).success).toBe(false);
    expect(
      adminOrdersQuerySchema.safeParse({ liveId: 'demo', cursor: 'order-1', limit: '20' }).success,
    ).toBe(true);
    expect(adminOrdersQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(
      adminOrderPageSchema.safeParse({
        orders: [{ ...order, customer: { id: 'demo-viewer', nickname: '데모 시청자' } }],
        nextCursor: null,
      }).success,
    ).toBe(true);
    expect(
      inventoryUpdatedEventSchema.safeParse({
        eventId: 'event-8',
        liveId: 'demo',
        sequence: 8,
        type: 'inventory.updated',
        occurredAt: '2026-07-31T00:00:00.000Z',
        payload: { productId: 'soft-knit', productVariantId: 'soft-knit-m', stock: 11 },
      }).success,
    ).toBe(true);
    expect(
      couponRedeemedEventSchema.safeParse({
        eventId: 'event-9',
        liveId: 'demo',
        sequence: 9,
        type: 'coupon.redeemed',
        occurredAt: '2026-07-31T00:00:00.000Z',
        payload: {
          coupon: {
            id: 'coupon-1',
            liveId: 'demo',
            type: 'PERCENT',
            value: 10,
            minOrderAmountKrw: 0,
            startsAt: '2026-07-31T00:00:00.000Z',
            endsAt: '2026-07-31T01:00:00.000Z',
            usageLimit: 100,
            usedCount: 1,
            status: 'PUBLISHED',
          },
        },
      }).success,
    ).toBe(true);
    expect(
      orderStatusChangedEventSchema.safeParse({
        eventId: 'event-10',
        liveId: 'demo',
        sequence: 10,
        type: 'order.status.changed',
        occurredAt: '2026-07-31T00:00:00.000Z',
        payload: { order },
      }).success,
    ).toBe(true);
  });

  it('requires a moderation reason and validates hidden-message events', () => {
    expect(hideChatMessageRequestSchema.safeParse({ reason: '도배성 메시지' }).success).toBe(true);
    expect(hideChatMessageRequestSchema.safeParse({ reason: '   ' }).success).toBe(false);
    expect(
      chatMessageHiddenEventSchema.safeParse({
        eventId: 'event-2',
        liveId: 'demo',
        sequence: 5,
        type: 'chat.message.hidden',
        occurredAt: '2026-07-31T00:00:00.000Z',
        payload: { messageId: 'message-1' },
      }).success,
    ).toBe(true);
  });

  it('validates a bounded timeout command and a private timeout event', () => {
    expect(
      chatTimeoutUserRequestSchema.safeParse({
        durationMinutes: 10,
        reason: '반복 메시지',
      }).success,
    ).toBe(true);
    expect(
      chatTimeoutUserRequestSchema.safeParse({
        durationMinutes: 0,
        reason: ' ',
      }).success,
    ).toBe(false);
    expect(
      chatUserTimedOutEventSchema.safeParse({
        eventId: 'event-6',
        liveId: 'demo',
        sequence: 6,
        type: 'chat.user.timed_out',
        occurredAt: '2026-07-31T00:00:00.000Z',
        payload: {
          userId: 'demo-viewer',
          expiresAt: '2026-07-31T00:10:00.000Z',
        },
      }).success,
    ).toBe(true);
    expect(chatAccessStatusSchema.safeParse({ timeoutExpiresAt: null }).success).toBe(true);
  });
});
