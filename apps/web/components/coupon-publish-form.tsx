'use client';

import {
  publishCouponRequestSchema,
  type Coupon,
  type PublishCouponRequest,
} from '@liveflow/contracts';
import { useForm } from 'react-hook-form';

type CouponFormValues = {
  type: Coupon['type'];
  value: string;
  minOrderAmountKrw: string;
  endsAt: string;
  usageLimit: string;
};

type CouponPublishFormProps = {
  disabled: boolean;
  error: string | null;
  isPending: boolean;
  onPublish: (input: PublishCouponRequest) => Promise<unknown>;
};

const defaultValues: CouponFormValues = {
  type: 'PERCENT',
  value: '10',
  minOrderAmountKrw: '0',
  endsAt: '',
  usageLimit: '',
};

export function CouponPublishForm({
  disabled,
  error,
  isPending,
  onPublish,
}: CouponPublishFormProps) {
  const form = useForm<CouponFormValues>({ defaultValues });

  async function submit(values: CouponFormValues): Promise<void> {
    form.clearErrors();
    const endsAtTime = Date.parse(values.endsAt);
    const parsedInput = publishCouponRequestSchema.safeParse({
      type: values.type,
      value: values.value,
      minOrderAmountKrw: values.minOrderAmountKrw,
      endsAt: Number.isFinite(endsAtTime) ? new Date(endsAtTime).toISOString() : values.endsAt,
      usageLimit: values.usageLimit.trim() ? values.usageLimit : null,
    });

    if (!parsedInput.success) {
      const firstIssue = parsedInput.error.issues[0];
      form.setError('root', {
        message: firstIssue?.message ?? '쿠폰 조건을 다시 확인해 주세요.',
      });
      return;
    }

    try {
      await onPublish(parsedInput.data);
      form.reset(defaultValues);
    } catch {
      // The mutation state below provides a user-safe error message from the API.
    }
  }

  return (
    <section className="coupon-control" aria-labelledby="coupon-control-heading">
      <div className="section-heading">
        <div>
          <p className="panel-kicker">LIVE COUPON</p>
          <h2 id="coupon-control-heading">시청자 쿠폰 발행</h2>
        </div>
        <p className="mutation-status">새 쿠폰을 발행하면 이전 활성 쿠폰은 자동으로 종료됩니다.</p>
      </div>

      <form className="coupon-form" onSubmit={form.handleSubmit(submit)}>
        <label>
          할인 방식
          <select disabled={disabled || isPending} {...form.register('type')}>
            <option value="PERCENT">퍼센트 할인</option>
            <option value="FIXED">정액 할인</option>
          </select>
        </label>
        <label>
          할인 값
          <input
            disabled={disabled || isPending}
            inputMode="numeric"
            min={1}
            step={1}
            type="number"
            {...form.register('value')}
          />
        </label>
        <label>
          최소 주문 금액 (원)
          <input
            disabled={disabled || isPending}
            inputMode="numeric"
            min={0}
            step={1}
            type="number"
            {...form.register('minOrderAmountKrw')}
          />
        </label>
        <label>
          만료 시각
          <input
            disabled={disabled || isPending}
            required
            type="datetime-local"
            {...form.register('endsAt')}
          />
        </label>
        <label>
          사용 한도 (선택)
          <input
            disabled={disabled || isPending}
            inputMode="numeric"
            min={1}
            step={1}
            type="number"
            {...form.register('usageLimit')}
          />
        </label>
        <div className="coupon-form-submit">
          <p aria-live="polite" className="form-error">
            {form.formState.errors.root?.message ?? error}
          </p>
          <button disabled={disabled || isPending} type="submit">
            {isPending ? '쿠폰 발행 중…' : '쿠폰 발행'}
          </button>
        </div>
      </form>
    </section>
  );
}
