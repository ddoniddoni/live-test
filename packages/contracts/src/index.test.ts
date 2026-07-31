import { describe, expect, it } from 'vitest';
import {
  chatAccessStatusSchema,
  chatMessageHiddenEventSchema,
  chatMessagesQuerySchema,
  chatTimeoutUserRequestSchema,
  chatUserTimedOutEventSchema,
  couponPublishedEventSchema,
  couponRedeemedEventSchema,
  createChatMessageRequestSchema,
  createOrderRequestSchema,
  healthResponseSchema,
  hideChatMessageRequestSchema,
  liveSnapshotSchema,
  productFeaturedEventSchema,
  inventoryUpdatedEventSchema,
  orderSchema,
  orderStatusChangedEventSchema,
  publishCouponRequestSchema,
  roleSchema,
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
