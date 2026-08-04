import Link from 'next/link';

import {
  LOW_STOCK_THRESHOLD,
  type AdminOrder,
  type InventoryLowEvent,
  type LiveMetrics,
  type Product,
} from '@liveflow/contracts';

type AdminOrdersInventoryPanelProps = {
  inventoryLowAlerts: InventoryLowEvent[];
  liveId: string;
  metrics: LiveMetrics | undefined;
  metricsError: string | null;
  metricsLoading: boolean;
  orders: AdminOrder[] | undefined;
  ordersError: string | null;
  ordersLoading: boolean;
  products: Product[];
  requiresAdminSession: boolean;
};

const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

const orderTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'Asia/Seoul',
});

const orderStatusLabel: Record<AdminOrder['status'], string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  FAILED: '결제 실패',
  CANCELLED: '주문 취소',
};

function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

export function AdminOrdersInventoryPanel({
  inventoryLowAlerts,
  liveId,
  metrics,
  metricsError,
  metricsLoading,
  orders,
  ordersError,
  ordersLoading,
  products,
  requiresAdminSession,
}: AdminOrdersInventoryPanelProps) {
  const lowStockVariants = products.flatMap((product) =>
    product.variants
      .filter((variant) => variant.stock <= LOW_STOCK_THRESHOLD)
      .map((variant) => ({ ...variant, productName: product.name })),
  );

  return (
    <section className="admin-orders-inventory" aria-labelledby="orders-inventory-heading">
      <div className="section-heading">
        <div>
          <p className="panel-kicker">ORDERS & INVENTORY</p>
          <h2 id="orders-inventory-heading">최근 주문 · 옵션별 재고</h2>
        </div>
        <p className="mutation-status">
          재고 {LOW_STOCK_THRESHOLD}개 이하 옵션은 경고로 표시됩니다.
        </p>
        <Link className="admin-orders-all-link" href={`/admin/orders?liveId=${liveId}`}>
          전체 주문 보기
        </Link>
      </div>

      {inventoryLowAlerts.length > 0 ? (
        <div className="inventory-low-alert" role="status">
          <strong>재고 경고</strong>
          <span>
            {inventoryLowAlerts[0]?.payload.productName}{' '}
            {inventoryLowAlerts[0]?.payload.variantName}
            {' · '}
            {inventoryLowAlerts[0]?.payload.stock}개 남음
          </span>
        </div>
      ) : null}

      <section className="live-performance-summary" aria-labelledby="live-performance-heading">
        <div className="live-performance-heading">
          <div>
            <p className="panel-kicker">BROADCAST PERFORMANCE</p>
            <h3 id="live-performance-heading">현재까지 방송 성과</h3>
          </div>
          <span>저장된 주문·채팅 기준</span>
        </div>
        {requiresAdminSession ? (
          <p className="admin-data-empty">관리자 세션을 시작하면 방송 성과를 확인할 수 있습니다.</p>
        ) : metricsLoading ? (
          <p className="admin-data-empty" role="status">
            방송 성과를 집계하는 중입니다…
          </p>
        ) : metricsError ? (
          <p className="form-error" role="alert">
            {metricsError}
          </p>
        ) : metrics ? (
          <dl className="live-performance-grid">
            <div>
              <dt>Mock 매출</dt>
              <dd>{formatKrw(metrics.totalRevenueKrw)}</dd>
            </div>
            <div>
              <dt>결제 완료</dt>
              <dd>
                {metrics.paidOrderCount} / {metrics.totalOrderCount}건
              </dd>
            </div>
            <div>
              <dt>할인 적용</dt>
              <dd>{formatKrw(metrics.totalDiscountKrw)}</dd>
            </div>
            <div>
              <dt>채팅 수</dt>
              <dd>{metrics.chatMessageCount}개</dd>
            </div>
            <div>
              <dt>쿠폰 사용</dt>
              <dd>{metrics.couponUseCount}장</dd>
            </div>
            <div>
              <dt>AI 검토</dt>
              <dd>
                완료 {metrics.reviewedAiSuggestionCount} · 대기 {metrics.pendingAiSuggestionCount}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      <div className="admin-orders-inventory-grid">
        <section aria-labelledby="recent-orders-heading">
          <h3 id="recent-orders-heading">최근 주문</h3>
          {requiresAdminSession ? (
            <p className="admin-data-empty">
              관리자 세션을 시작하면 최근 주문을 확인할 수 있습니다.
            </p>
          ) : ordersLoading ? (
            <p className="admin-data-empty">최근 주문을 불러오는 중입니다…</p>
          ) : ordersError ? (
            <p className="form-error" role="alert">
              {ordersError}
            </p>
          ) : orders?.length ? (
            <ul className="recent-order-list">
              {orders.map((order) => (
                <li key={order.id}>
                  <div>
                    <strong>{order.customer.nickname}</strong>
                    <span>
                      {order.items
                        .map((item) => `${item.productName} ${item.variantName}`)
                        .join(', ')}
                    </span>
                  </div>
                  <div>
                    <strong>{formatKrw(order.totalKrw)}</strong>
                    <span>
                      {orderStatusLabel[order.status]} ·{' '}
                      {orderTimeFormatter.format(new Date(order.createdAt))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-data-empty">아직 생성된 Mock 주문이 없습니다.</p>
          )}
        </section>

        <section aria-labelledby="variant-stock-heading">
          <h3 id="variant-stock-heading">옵션별 재고</h3>
          <ul className="variant-stock-list">
            {products.flatMap((product) =>
              product.variants.map((variant) => (
                <li
                  className={variant.stock <= LOW_STOCK_THRESHOLD ? 'is-low-stock' : ''}
                  key={variant.id}
                >
                  <span>
                    {product.name} · {variant.name}
                  </span>
                  <strong>{variant.stock}개</strong>
                </li>
              )),
            )}
          </ul>
          {lowStockVariants.length > 0 ? (
            <p className="low-stock-summary">주의 옵션 {lowStockVariants.length}개</p>
          ) : (
            <p className="low-stock-summary">현재 저재고 옵션이 없습니다.</p>
          )}
        </section>
      </div>
    </section>
  );
}
