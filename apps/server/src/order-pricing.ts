import type { Coupon } from '@liveflow/contracts';

type ApplicableCoupon = Pick<
  Coupon,
  | 'id'
  | 'type'
  | 'value'
  | 'minOrderAmountKrw'
  | 'startsAt'
  | 'endsAt'
  | 'usageLimit'
  | 'usedCount'
  | 'status'
>;

export type OrderPricing = {
  subtotalKrw: number;
  discountKrw: number;
  totalKrw: number;
  coupon: ApplicableCoupon | null;
};

export function calculateOrderPricing(input: {
  unitPriceKrw: number;
  quantity: number;
  coupon: ApplicableCoupon | null;
  now: Date;
}): OrderPricing {
  const subtotalKrw = input.unitPriceKrw * input.quantity;
  const coupon = isCouponApplicable(input.coupon, subtotalKrw, input.now) ? input.coupon : null;

  if (!coupon) {
    return { subtotalKrw, discountKrw: 0, totalKrw: subtotalKrw, coupon: null };
  }

  const rawDiscountKrw =
    coupon.type === 'PERCENT' ? Math.floor((subtotalKrw * coupon.value) / 100) : coupon.value;
  const discountKrw = Math.min(subtotalKrw, rawDiscountKrw);

  return {
    subtotalKrw,
    discountKrw,
    totalKrw: subtotalKrw - discountKrw,
    coupon,
  };
}

function isCouponApplicable(
  coupon: ApplicableCoupon | null,
  subtotalKrw: number,
  now: Date,
): coupon is ApplicableCoupon {
  if (!coupon || coupon.status !== 'PUBLISHED' || subtotalKrw < coupon.minOrderAmountKrw) {
    return false;
  }

  const currentTime = now.getTime();
  const isWithinValidity =
    Date.parse(coupon.startsAt) <= currentTime && currentTime < Date.parse(coupon.endsAt);
  const hasRemainingUsage = coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit;

  return isWithinValidity && hasRemainingUsage;
}
