'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { Order, OrderStatus } from '@liveflow/contracts';

import {
  ApiRequestError,
  createViewerSession,
  fetchViewerOrder,
  viewerOrderQueryKey,
} from '@/lib/live-api';

type OrderResultViewerProps = {
  orderId: string;
};

const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const orderStatusLabel: Record<OrderStatus, string> = {
  PENDING: '주문 확인 중',
  PAID: '주문 확정',
  FAILED: '주문 실패',
  CANCELLED: '주문 취소',
};

function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

function orderErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return '주문 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export function OrderResultViewer({ orderId }: OrderResultViewerProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const orderQuery = useQuery({
    queryKey: viewerOrderQueryKey(orderId),
    queryFn: () => fetchViewerOrder(orderId, accessToken ?? ''),
    enabled: accessToken !== null,
  });

  useEffect(() => {
    let isActive = true;

    void createViewerSession()
      .then((token) => {
        if (isActive) {
          setAccessToken(token);
        }
      })
      .catch(() => {
        if (isActive) {
          setSessionError('시청자 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  if (sessionError) {
    return <OrderResultError message={sessionError} retry={() => window.location.reload()} />;
  }

  if (!accessToken || orderQuery.isPending) {
    return (
      <OrderResultState
        description="저장된 주문 내역을 확인하고 있습니다."
        title="주문 결과를 불러오는 중입니다"
      />
    );
  }

  if (orderQuery.isError) {
    return (
      <OrderResultError message={orderErrorMessage(orderQuery.error)} retry={orderQuery.refetch} />
    );
  }

  return <OrderResult order={orderQuery.data} />;
}

function OrderResultError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <main className="order-result-shell">
      <section
        aria-labelledby="order-result-error-title"
        className="order-result-state is-error"
        role="alert"
      >
        <p className="panel-kicker">ORDER LOOKUP</p>
        <h1 id="order-result-error-title">주문 결과를 확인할 수 없습니다</h1>
        <p>{message}</p>
        <div className="order-result-actions">
          <button className="order-result-primary-link" onClick={retry} type="button">
            다시 시도
          </button>
          <Link className="order-result-secondary-link" href="/">
            홈으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}

function OrderResultState({ description, title }: { description: string; title: string }) {
  return (
    <main className="order-result-shell">
      <section
        aria-busy="true"
        aria-labelledby="order-result-loading-title"
        className="order-result-state"
        role="status"
      >
        <span aria-hidden="true" className="order-result-loading-mark" />
        <p className="panel-kicker">ORDER LOOKUP</p>
        <h1 id="order-result-loading-title">{title}</h1>
        <p>{description}</p>
      </section>
    </main>
  );
}

function OrderResult({ order }: { order: Order }) {
  return (
    <main className="order-result-shell">
      <section className="order-result-card" aria-labelledby="order-result-title">
        <p className="panel-kicker">MOCK ORDER RECEIPT</p>
        <div className="order-result-heading">
          <div>
            <h1 id="order-result-title">{orderStatusLabel[order.status]}</h1>
            <p>주문 정보는 서버에 저장된 내역을 기준으로 표시됩니다.</p>
          </div>
          <span className={`order-status-badge is-${order.status.toLowerCase()}`}>
            {orderStatusLabel[order.status]}
          </span>
        </div>

        <dl className="order-result-meta">
          <div>
            <dt>주문 번호</dt>
            <dd>{order.id}</dd>
          </div>
          <div>
            <dt>주문 시각</dt>
            <dd>
              <time dateTime={order.createdAt}>
                {dateTimeFormatter.format(new Date(order.createdAt))}
              </time>
            </dd>
          </div>
        </dl>

        <section aria-labelledby="order-items-title" className="order-result-items">
          <h2 id="order-items-title">주문 상품</h2>
          <ul>
            {order.items.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.productName}</strong>
                  <span>
                    {item.variantName} · {item.quantity}개
                  </span>
                </div>
                <span>{formatKrw(item.unitPriceKrw * item.quantity)}</span>
              </li>
            ))}
          </ul>
        </section>

        <dl className="order-result-pricing">
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

        <div className="order-result-actions">
          <Link className="order-result-primary-link" href={`/live/${order.liveId}`}>
            라이브로 돌아가기
          </Link>
          <Link className="order-result-secondary-link" href="/">
            홈으로
          </Link>
        </div>
      </section>
    </main>
  );
}
