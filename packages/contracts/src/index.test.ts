import { describe, expect, it } from 'vitest';
import {
  healthResponseSchema,
  liveSnapshotSchema,
  productFeaturedEventSchema,
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
        products: [],
        lastEventSequence: 4,
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
});
