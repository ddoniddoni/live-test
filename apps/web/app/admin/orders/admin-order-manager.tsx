'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { AdminOrder } from '@liveflow/contracts';

import { ScreenState } from '@/components/screen-state';
import {
  adminLiveListQueryKey,
  adminOrdersQueryKey,
  fetchAdminLives,
  fetchAdminOrders,
} from '@/lib/live-api';

type AdminOrderManagerProps = {
  accessToken: string;
};

const orderStatusLabel: Record<AdminOrder['status'], string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  FAILED: '결제 실패',
  CANCELLED: '주문 취소',
};

const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Seoul',
});

function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

function getOrderItemsSummary(order: AdminOrder): string {
  return order.items
    .map((item) => `${item.productName} · ${item.variantName} ${item.quantity}개`)
    .join(', ');
}

export function AdminOrderManager({ accessToken }: AdminOrderManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedLiveId = searchParams.get('liveId') ?? undefined;
  const liveListQuery = useQuery({
    queryKey: adminLiveListQueryKey(),
    queryFn: () => fetchAdminLives(accessToken, { limit: 50 }),
  });
  const ordersQuery = useInfiniteQuery({
    queryKey: adminOrdersQueryKey(selectedLiveId),
    queryFn: ({ pageParam }) =>
      fetchAdminOrders(
        {
          cursor: pageParam ?? undefined,
          limit: 20,
          liveId: selectedLiveId,
        },
        accessToken,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const orders = ordersQuery.data?.pages.flatMap((page) => page.orders) ?? [];
  const liveById = new Map(
    (liveListQuery.data?.lives ?? []).map((live) => [live.id, live] as const),
  );
  const totalRevenueKrw = orders.reduce(
    (sum, order) => (order.status === 'PAID' ? sum + order.totalKrw : sum),
    0,
  );
  const paidOrderCount = orders.filter((order) => order.status === 'PAID').length;

  function selectLive(nextLiveId: string): void {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (nextLiveId) {
      nextSearchParams.set('liveId', nextLiveId);
    } else {
      nextSearchParams.delete('liveId');
    }

    const queryString = nextSearchParams.toString();
    router.replace(queryString ? `/admin/orders?${queryString}` : '/admin/orders');
  }

  if (liveListQuery.isPending && ordersQuery.isPending) {
    return <ScreenState>주문 목록을 불러오는 중입니다…</ScreenState>;
  }

  if (ordersQuery.isError) {
    return <AdminOrderListError onRetry={() => void ordersQuery.refetch()} />;
  }

  return (
    <main className="admin-live-manager-shell admin-order-manager-shell">
      <header className="admin-live-manager-header">
        <div>
          <Link className="admin-access-brand" href="/">
            StreamOps <strong>Elite</strong>
          </Link>
          <p className="panel-kicker">LIVEFLOW / ORDER OPERATIONS</p>
          <h1>주문 관리</h1>
          <p>방송별 Mock 주문, 할인 금액, 결제 상태를 최신 생성 순으로 확인합니다.</p>
        </div>
        <div className="admin-live-manager-actions">
          <Link className="admin-live-secondary-link" href="/admin/lives">
            방송 관리
          </Link>
          <Link className="admin-live-primary-link" href="/">
            시청자 홈
          </Link>
        </div>
      </header>

      <section aria-labelledby="admin-order-list-heading" className="admin-order-list-section">
        <header className="admin-order-list-heading">
          <div>
            <p className="panel-kicker">PERSISTED ORDERS</p>
            <h2 id="admin-order-list-heading">
              {selectedLiveId
                ? `${liveById.get(selectedLiveId)?.title ?? '선택한 방송'} 주문`
                : '전체 방송 주문'}
            </h2>
          </div>
          <div className="admin-order-list-actions">
            <button
              className="admin-live-secondary-button admin-order-refresh-button"
              disabled={ordersQuery.isFetching}
              onClick={() => void ordersQuery.refetch()}
              type="button"
            >
              {ordersQuery.isFetching ? '새로고침 중…' : '최신 주문 새로고침'}
            </button>
            <label className="admin-order-live-filter">
              <span>방송 필터</span>
              <select
                onChange={(event) => selectLive(event.target.value)}
                value={selectedLiveId ?? ''}
              >
                <option value="">전체 방송</option>
                {(liveListQuery.data?.lives ?? []).map((live) => (
                  <option key={live.id} value={live.id}>
                    {live.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {liveListQuery.isError ? (
          <p className="admin-order-filter-error" role="status">
            방송 이름을 불러오지 못해 방송 ID로 표시합니다.
          </p>
        ) : null}

        <dl className="admin-order-summary">
          <div>
            <dt>표시 중인 주문</dt>
            <dd>{orders.length}건</dd>
          </div>
          <div>
            <dt>결제 완료</dt>
            <dd>{paidOrderCount}건</dd>
          </div>
          <div>
            <dt>Mock 매출</dt>
            <dd>{formatKrw(totalRevenueKrw)}</dd>
          </div>
        </dl>

        {ordersQuery.isPending ? (
          <p className="admin-order-state" role="status">
            저장된 주문을 불러오는 중입니다…
          </p>
        ) : orders.length === 0 ? (
          <div className="admin-order-state">
            <h3>아직 생성된 Mock 주문이 없습니다.</h3>
            <p>시청자가 라이브 화면에서 주문을 완료하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <>
            <ol className="admin-order-list">
              {orders.map((order) => {
                const live = liveById.get(order.liveId);

                return (
                  <li key={order.id}>
                    <div className="admin-order-row-primary">
                      <span className={`admin-order-status is-${order.status.toLowerCase()}`}>
                        {orderStatusLabel[order.status]}
                      </span>
                      <strong>{order.customer.nickname}</strong>
                      <span className="admin-order-broadcast">
                        {live?.title ?? `방송 ID: ${order.liveId}`}
                      </span>
                      <p>{getOrderItemsSummary(order)}</p>
                    </div>
                    <div className="admin-order-row-secondary">
                      <strong>{formatKrw(order.totalKrw)}</strong>
                      <time dateTime={order.createdAt}>
                        {dateTimeFormatter.format(new Date(order.createdAt))}
                      </time>
                      <Link href={`/admin/lives/${order.liveId}`}>컨트롤룸</Link>
                    </div>
                  </li>
                );
              })}
            </ol>
            {ordersQuery.hasNextPage ? (
              <button
                className="admin-live-secondary-button admin-order-more-button"
                disabled={ordersQuery.isFetchingNextPage}
                onClick={() => void ordersQuery.fetchNextPage()}
                type="button"
              >
                {ordersQuery.isFetchingNextPage ? '주문을 불러오는 중…' : '이전 주문 더 보기'}
              </button>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function AdminOrderListError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="admin-live-manager-shell admin-order-manager-shell">
      <section className="admin-order-list-section admin-order-error-state" role="alert">
        <p className="panel-kicker">ORDER LOOKUP</p>
        <h1>주문 목록을 불러오지 못했습니다</h1>
        <p>잠시 후 다시 시도하거나 API 서버 연결 상태를 확인해 주세요.</p>
        <div className="admin-live-manager-actions">
          <button className="admin-live-primary-link" onClick={onRetry} type="button">
            다시 시도
          </button>
          <Link className="admin-live-secondary-link" href="/admin/lives">
            방송 관리로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
