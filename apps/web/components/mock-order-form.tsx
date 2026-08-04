'use client';

import { useId } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrderRequestSchema } from '@liveflow/contracts';
import type { Coupon, CreateOrderRequest, LiveStatus, Order, Product } from '@liveflow/contracts';
import { useForm, useWatch } from 'react-hook-form';

import { ApiRequestError, createMockOrder, liveSnapshotQueryKey } from '@/lib/live-api';

type OrderFormValues = {
  productVariantId: string;
  quantity: string;
};

type PendingOrderRequest = {
  input: CreateOrderRequest;
  idempotencyKey: string;
};

type MockOrderFormProps = {
  accessToken: string | null;
  activeCoupon: Coupon | null;
  liveId: string;
  liveStatus: LiveStatus;
  product: Product;
  variant?: 'default' | 'compact';
};

const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

function orderErrorMessage(error: unknown): string | null {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return error ? '주문을 처리하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.' : null;
}

export function MockOrderForm({
  accessToken,
  activeCoupon,
  liveId,
  liveStatus,
  product,
  variant = 'default',
}: MockOrderFormProps) {
  const headingId = useId();
  const firstVariant = product.variants[0];
  const form = useForm<OrderFormValues>({
    defaultValues: {
      productVariantId: firstVariant?.id ?? '',
      quantity: '1',
    },
  });
  const selectedVariantId = useWatch({ control: form.control, name: 'productVariantId' });
  const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId);
  const queryClient = useQueryClient();
  const orderMutation = useMutation({
    mutationFn: ({ input, idempotencyKey }: PendingOrderRequest) => {
      if (!accessToken) {
        throw new Error('시청자 세션이 준비되지 않았습니다.');
      }

      return createMockOrder(input, idempotencyKey, accessToken);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveSnapshotQueryKey(liveId) }),
  });
  const isOrderable =
    accessToken !== null && liveStatus === 'LIVE' && (selectedVariant?.stock ?? 0) > 0;
  const mutationError = orderErrorMessage(orderMutation.error);

  async function submit(values: OrderFormValues): Promise<void> {
    form.clearErrors();
    const parsedInput = createOrderRequestSchema.safeParse({
      liveId,
      productVariantId: values.productVariantId,
      quantity: values.quantity,
    });

    if (!parsedInput.success) {
      form.setError('root', {
        message: parsedInput.error.issues[0]?.message ?? '주문 옵션과 수량을 확인해 주세요.',
      });
      return;
    }

    const request = {
      input: parsedInput.data,
      idempotencyKey: crypto.randomUUID(),
    };
    try {
      await orderMutation.mutateAsync(request);
    } catch {
      // The rendered mutation error keeps API details user-safe and retryable.
    }
  }

  function retryLastOrder(): void {
    const request = orderMutation.variables;
    if (!request) {
      return;
    }

    void orderMutation.mutateAsync(request).catch(() => undefined);
  }

  return (
    <section className={`mock-order mock-order-${variant}`} aria-labelledby={headingId}>
      <div className="mock-order-heading">
        <div>
          <p className="panel-kicker">MOCK ORDER</p>
          <h3 id={headingId}>지금 주문하기</h3>
        </div>
        <span>
          {activeCoupon?.status === 'PUBLISHED' ? '할인은 서버가 최종 확정' : '정가 기준'}
        </span>
      </div>

      <form className="mock-order-form" onSubmit={form.handleSubmit(submit)}>
        <label>
          옵션
          <select
            disabled={orderMutation.isPending || !firstVariant}
            {...form.register('productVariantId')}
          >
            {product.variants.map((variant) => (
              <option disabled={variant.stock === 0} key={variant.id} value={variant.id}>
                {variant.name} · 재고 {variant.stock}개
              </option>
            ))}
          </select>
        </label>
        <label>
          수량
          <input
            disabled={orderMutation.isPending || !isOrderable}
            inputMode="numeric"
            max={Math.min(selectedVariant?.stock ?? 1, 10)}
            min={1}
            step={1}
            type="number"
            {...form.register('quantity')}
          />
        </label>
        <p className="mock-order-price">
          상품 금액 {formatKrw(product.priceKrw)} · 서버에서 재계산
        </p>
        <p aria-live="polite" className="form-error">
          {form.formState.errors.root?.message ?? mutationError}
        </p>
        {mutationError ? (
          <button className="mock-order-retry" onClick={retryLastOrder} type="button">
            같은 주문 다시 시도
          </button>
        ) : null}
        <button disabled={orderMutation.isPending || !isOrderable} type="submit">
          {orderMutation.isPending
            ? '주문 처리 중…'
            : !accessToken
              ? '시청자 세션 준비 중…'
              : selectedVariant?.stock === 0
                ? '품절된 옵션입니다'
                : liveStatus !== 'LIVE'
                  ? '주문할 수 없는 방송입니다'
                  : variant === 'compact'
                    ? '지금 구매'
                    : 'Mock 주문 확정'}
        </button>
      </form>

      {orderMutation.data ? <OrderReceipt order={orderMutation.data} /> : null}
    </section>
  );
}

function OrderReceipt({ order }: { order: Order }) {
  const item = order.items[0];

  if (!item) {
    return null;
  }

  return (
    <div aria-live="polite" className="mock-order-receipt">
      <strong>Mock 주문이 확정되었습니다</strong>
      <span>
        {item.productName} · {item.variantName} · {item.quantity}개
      </span>
      <dl>
        <div>
          <dt>상품 금액</dt>
          <dd>{formatKrw(order.subtotalKrw)}</dd>
        </div>
        <div>
          <dt>할인</dt>
          <dd>-{formatKrw(order.discountKrw)}</dd>
        </div>
        <div>
          <dt>최종 금액</dt>
          <dd>{formatKrw(order.totalKrw)}</dd>
        </div>
      </dl>
      <Link className="mock-order-receipt-link" href={`/orders/${order.id}`}>
        주문 결과 보기
      </Link>
    </div>
  );
}
