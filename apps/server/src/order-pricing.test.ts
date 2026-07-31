import type { Coupon } from '@liveflow/contracts';
import { describe, expect, it } from 'vitest';
import { calculateOrderPricing } from './order-pricing.js';

const now = new Date('2026-07-31T00:30:00.000Z');

function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'coupon-1',
    liveId: 'demo',
    type: 'PERCENT',
    value: 15,
    minOrderAmountKrw: 0,
    startsAt: '2026-07-31T00:00:00.000Z',
    endsAt: '2026-07-31T01:00:00.000Z',
    usageLimit: null,
    usedCount: 0,
    status: 'PUBLISHED',
    ...overrides,
  };
}

describe('calculateOrderPricing', () => {
  it('uses integer KRW arithmetic and caps a fixed discount at the subtotal', () => {
    expect(
      calculateOrderPricing({
        unitPriceKrw: 19_999,
        quantity: 2,
        coupon: coupon({ type: 'PERCENT', value: 15 }),
        now,
      }),
    ).toMatchObject({ subtotalKrw: 39_998, discountKrw: 5_999, totalKrw: 33_999 });

    expect(
      calculateOrderPricing({
        unitPriceKrw: 10_000,
        quantity: 1,
        coupon: coupon({ type: 'FIXED', value: 20_000 }),
        now,
      }),
    ).toMatchObject({ subtotalKrw: 10_000, discountKrw: 10_000, totalKrw: 0 });
  });

  it('does not apply an expired, exhausted, or minimum-unmet coupon', () => {
    const baseInput = { unitPriceKrw: 10_000, quantity: 1, now };

    for (const unavailableCoupon of [
      coupon({ minOrderAmountKrw: 20_000 }),
      coupon({ usageLimit: 1, usedCount: 1 }),
      coupon({ endsAt: '2026-07-31T00:29:59.000Z' }),
    ]) {
      expect(calculateOrderPricing({ ...baseInput, coupon: unavailableCoupon })).toMatchObject({
        subtotalKrw: 10_000,
        discountKrw: 0,
        totalKrw: 10_000,
        coupon: null,
      });
    }
  });
});
