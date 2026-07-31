import type {
  ChatMessageHiddenEvent,
  ChatUserTimedOutEvent,
  CouponPublishedEvent,
  InventoryUpdatedEvent,
  LiveSnapshot,
} from '@liveflow/contracts';
import { describe, expect, it } from 'vitest';
import {
  chatAccessQueryKey,
  mergeChatMessageHiddenEvent,
  mergeCouponPublishedEvent,
  mergeInventoryUpdatedEvent,
  prependChatMessagePage,
} from './live-api.js';

const snapshot: LiveSnapshot = {
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
    description: '피부에 부드럽게 닿는 여름용 릴랙스 핏 니트입니다.',
    priceKrw: 39000,
    variants: [{ id: 'soft-knit-m', name: 'M', stock: 12 }],
  },
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
  lastEventSequence: 4,
  chat: {
    messages: [
      {
        id: 'message-2',
        clientMessageId: '9e3df3e8-7374-4d7a-8b2d-152b655c7d6f',
        roomId: 'room-1',
        liveId: 'demo',
        sender: { id: 'demo-viewer', nickname: 'Demo Viewer', role: 'VIEWER' },
        sequence: 2,
        type: 'USER',
        visibility: 'VISIBLE',
        content: '상품 사이즈가 궁금합니다.',
        createdAt: '2026-07-31T00:00:01.000Z',
      },
    ],
    lastMessageSequence: 2,
    hasMore: true,
  },
};

const hiddenEvent: ChatMessageHiddenEvent = {
  eventId: 'event-5',
  liveId: 'demo',
  sequence: 5,
  type: 'chat.message.hidden',
  occurredAt: '2026-07-31T00:00:02.000Z',
  payload: { messageId: 'message-2' },
};

describe('mergeChatMessageHiddenEvent', () => {
  it('removes the hidden message once and advances the live event sequence', () => {
    const merged = mergeChatMessageHiddenEvent(snapshot, hiddenEvent);

    expect(merged?.chat.messages).toEqual([]);
    expect(merged?.chat.lastMessageSequence).toBe(2);
    expect(merged?.lastEventSequence).toBe(5);
  });

  it('ignores a duplicated hidden-message event', () => {
    expect(mergeChatMessageHiddenEvent(snapshot, { ...hiddenEvent, sequence: 4 })).toBe(snapshot);
  });
});

describe('prependChatMessagePage', () => {
  it('prepends an older cursor page and replaces the older-history cursor state', () => {
    const latestMessage = snapshot.chat.messages[0];
    if (!latestMessage) {
      throw new Error('Expected the chat snapshot fixture to contain a message.');
    }

    const merged = prependChatMessagePage(snapshot, {
      messages: [
        {
          ...latestMessage,
          id: 'message-1',
          clientMessageId: '0e3df3e8-7374-4d7a-8b2d-152b655c7d6f',
          sequence: 1,
          content: '이전 메시지입니다.',
        },
      ],
      lastMessageSequence: 2,
      hasMore: false,
    });

    expect(merged?.chat.messages.map((message) => message.sequence)).toEqual([1, 2]);
    expect(merged?.chat.lastMessageSequence).toBe(2);
    expect(merged?.chat.hasMore).toBe(false);
  });
});

describe('private chat timeout state', () => {
  it('uses a live-specific cache key and keeps the target-only event shape stable', () => {
    const event: ChatUserTimedOutEvent = {
      eventId: 'event-6',
      liveId: 'demo',
      sequence: 6,
      type: 'chat.user.timed_out',
      occurredAt: '2026-07-31T00:00:03.000Z',
      payload: {
        userId: 'demo-viewer',
        expiresAt: '2026-07-31T00:10:00.000Z',
      },
    };

    expect(chatAccessQueryKey(event.liveId)).toEqual(['live', 'demo', 'chat-access']);
    expect(event.payload.expiresAt).toBe('2026-07-31T00:10:00.000Z');
  });
});

describe('mergeCouponPublishedEvent', () => {
  it('replaces the active coupon once and advances the event sequence', () => {
    const event: CouponPublishedEvent = {
      eventId: 'coupon-event-5',
      liveId: 'demo',
      sequence: 5,
      type: 'coupon.published',
      occurredAt: '2026-07-31T00:00:03.000Z',
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

    const merged = mergeCouponPublishedEvent(snapshot, event);

    expect(merged?.activeCoupon).toEqual(event.payload.coupon);
    expect(merged?.lastEventSequence).toBe(5);
    expect(mergeCouponPublishedEvent(snapshot, { ...event, sequence: 4 })).toBe(snapshot);
  });
});

describe('mergeInventoryUpdatedEvent', () => {
  it('updates the product and featured-product stock once from a persisted event', () => {
    const event: InventoryUpdatedEvent = {
      eventId: 'inventory-event-5',
      liveId: 'demo',
      sequence: 5,
      type: 'inventory.updated',
      occurredAt: '2026-07-31T00:00:03.000Z',
      payload: { productId: 'soft-knit', productVariantId: 'soft-knit-m', stock: 11 },
    };

    const merged = mergeInventoryUpdatedEvent(snapshot, event);

    expect(merged?.products[0]?.variants[0]?.stock).toBe(11);
    expect(merged?.featuredProduct?.variants[0]?.stock).toBe(11);
    expect(merged?.lastEventSequence).toBe(5);
    expect(mergeInventoryUpdatedEvent(snapshot, { ...event, sequence: 4 })).toBe(snapshot);
  });
});
