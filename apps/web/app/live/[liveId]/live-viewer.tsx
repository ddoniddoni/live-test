'use client';

import { useQuery } from '@tanstack/react-query';
import type { Coupon, Product } from '@liveflow/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChatPanel } from '../../../components/chat-panel';
import { MockOrderForm } from '../../../components/mock-order-form';
import {
  ApiRequestError,
  chatAccessQueryKey,
  createViewerSession,
  fetchChatAccess,
  fetchLiveSnapshot,
  liveSnapshotQueryKey,
} from '../../../lib/live-api';
import { type ConnectionState, useLiveRealtime } from '../../../lib/use-live-realtime';
import { stitchAssets } from '../../../lib/stitch-assets';

const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

const couponTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Seoul',
});

function connectionLabel(connectionState: ConnectionState): string {
  const labels: Record<ConnectionState, string> = {
    CONNECTING: '실시간 서버 연결 중',
    CONNECTED: '실시간 연결됨',
    RECOVERING: '변경 사항 동기화 중',
    DISCONNECTED: '연결이 끊겼습니다',
    FAILED: '실시간 연결에 실패했습니다',
  };

  return labels[connectionState];
}

function ActiveCouponPanel({ coupon }: { coupon: Coupon | null }) {
  const couponEndsAt = coupon ? Date.parse(coupon.endsAt) : Number.NaN;
  const [now, setNow] = useState(() => Date.now());
  const isActive =
    coupon !== null &&
    coupon.status === 'PUBLISHED' &&
    (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit) &&
    Number.isFinite(couponEndsAt) &&
    couponEndsAt > now;

  useEffect(() => {
    if (!Number.isFinite(couponEndsAt) || couponEndsAt <= Date.now()) {
      return undefined;
    }

    const timeoutId = window.setTimeout(
      () => {
        setNow(Date.now());
      },
      couponEndsAt - Date.now() + 100,
    );

    return () => window.clearTimeout(timeoutId);
  }, [couponEndsAt]);

  return (
    <section className="viewer-coupon" aria-labelledby="coupon-heading">
      {isActive && coupon ? (
        <article className="active-coupon-card">
          <div>
            <p className="panel-kicker">LIVE COUPON</p>
            <h2 id="coupon-heading">
              {coupon.type === 'PERCENT'
                ? `${coupon.value}% 즉시 할인`
                : `${formatKrw(coupon.value)} 즉시 할인`}
            </h2>
            <p>
              {coupon.minOrderAmountKrw > 0
                ? `${formatKrw(coupon.minOrderAmountKrw)} 이상 주문 시 적용`
                : '최소 주문 금액 없이 적용'}
            </p>
          </div>
          <div className="coupon-expiry">
            <span>마감</span>
            <strong>{couponTimeFormatter.format(new Date(coupon.endsAt))}</strong>
            {coupon.usageLimit ? (
              <small>잔여 {coupon.usageLimit - coupon.usedCount}장</small>
            ) : null}
          </div>
        </article>
      ) : (
        <div className="empty-coupon" role="status">
          현재 발행된 라이브 쿠폰이 없습니다.
        </div>
      )}
    </section>
  );
}

function MobileProductCard({
  accessToken,
  activeCoupon,
  liveId,
  liveStatus,
  product,
}: {
  accessToken: string | null;
  activeCoupon: Coupon | null;
  liveId: string;
  liveStatus: 'READY' | 'LIVE' | 'ENDED';
  product: Product;
}) {
  return (
    <article className="mobile-product-card">
      <div className="mobile-product-image">
        <Image alt="라이브 소개 상품" fill sizes="64px" src={stitchAssets.mobileProduct} />
        <span>1</span>
      </div>
      <div className="mobile-product-copy">
        <div>
          <span>특가</span>
          <strong>{product.name}</strong>
        </div>
        <p>{formatKrw(product.priceKrw)}</p>
      </div>
      <MockOrderForm
        accessToken={accessToken}
        activeCoupon={activeCoupon}
        liveId={liveId}
        liveStatus={liveStatus}
        product={product}
        variant="compact"
      />
    </article>
  );
}

export function LiveViewer({ liveId }: { liveId: string }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const snapshotQuery = useQuery({
    queryKey: liveSnapshotQueryKey(liveId),
    queryFn: () => fetchLiveSnapshot(liveId),
  });
  const chatAccessQuery = useQuery({
    queryKey: chatAccessQueryKey(liveId),
    queryFn: () => fetchChatAccess(liveId, accessToken ?? ''),
    enabled: accessToken !== null,
  });
  const connectionState = useLiveRealtime(liveId, accessToken);

  useEffect(() => {
    let isActive = true;

    void createViewerSession()
      .then((token) => {
        if (isActive) {
          setAccessToken(token);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setSessionError(
            error instanceof ApiRequestError
              ? error.message
              : '시청자 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  if (snapshotQuery.isPending) {
    return <main className="screen-state">방송 정보를 불러오는 중입니다…</main>;
  }

  if (snapshotQuery.isError || !snapshotQuery.data) {
    return (
      <main className="screen-state" role="alert">
        방송 정보를 불러오지 못했습니다. API 서버가 실행 중인지 확인해 주세요.
      </main>
    );
  }

  const { activeCoupon, featuredProduct, live } = snapshotQuery.data;
  const liveStatusLabel =
    live.status === 'LIVE' ? 'LIVE' : live.status === 'READY' ? 'COMING SOON' : 'ENDED';

  return (
    <main className="live-shell viewer-shell">
      <header className="topbar viewer-topbar">
        <div className="topbar-brand-group">
          <Link className="brand" href="/">
            LIVEFLOW
          </Link>
          <span className={`topbar-live-badge is-${live.status.toLowerCase()}`}>
            <span aria-hidden="true" />
            {liveStatusLabel}
          </span>
          <span className="viewer-message-count">
            메시지 {snapshotQuery.data.chat.messages.length}
          </span>
        </div>
        <div className="topbar-actions">
          <span className={`connection-pill connection-${connectionState.toLowerCase()}`}>
            <span aria-hidden="true" />
            {connectionLabel(connectionState)}
          </span>
          <Link className="text-link" href={`/admin/lives/${liveId}`}>
            운영자 화면
          </Link>
        </div>
      </header>

      <section className="viewer-layout" aria-label="라이브 방송">
        <div className="viewer-main-column">
          <section className="broadcast-stage" aria-label="라이브 영상 영역">
            <Image
              alt="상품을 소개하는 라이브 커머스 진행자"
              className="viewer-live-image viewer-live-image-desktop"
              fill
              priority
              sizes="(max-width: 760px) 1px, (max-width: 1280px) 66vw, 820px"
              src={stitchAssets.viewerLive}
            />
            <Image
              alt="상품을 소개하는 모바일 라이브 커머스 진행자"
              className="viewer-live-image viewer-live-image-mobile"
              fill
              sizes="(max-width: 760px) 100vw, 1px"
              src={stitchAssets.mobileLive}
            />
            <div className="stage-gradient" aria-hidden="true" />

            <div className="stage-desktop-overlay">
              <div className={`live-badge is-${live.status.toLowerCase()}`}>
                <span aria-hidden="true" />
                {live.status === 'LIVE' ? '특가 방송 진행중' : liveStatusLabel}
              </div>
              <div className="stage-now-showing">
                <span>NOW SHOWING</span>
                <strong>{featuredProduct?.name ?? live.title}</strong>
                <small>{featuredProduct ? '라이브 전용 혜택을 확인해 보세요' : live.title}</small>
              </div>
            </div>

            <div className="mobile-live-header">
              <div>
                <div className="mobile-host-chip">
                  <span className="mobile-host-avatar">
                    <Image alt="라이브 진행자" fill sizes="32px" src={stitchAssets.mobileHost} />
                  </span>
                  <strong>뷰티플로우</strong>
                </div>
                <span className={`mobile-live-badge is-${live.status.toLowerCase()}`}>
                  <span aria-hidden="true" />
                  {liveStatusLabel}
                </span>
              </div>
              <div className="mobile-live-actions">
                <span>{connectionLabel(connectionState)}</span>
                <Link aria-label="라이브 나가기" href="/">
                  ×
                </Link>
              </div>
            </div>
          </section>

          <div className="viewer-commerce-grid">
            <section className="featured-section" aria-labelledby="featured-heading">
              <div className="section-heading">
                <div>
                  <p className="panel-kicker">NOW SHOWING</p>
                  <h2 id="featured-heading">현재 소개 상품</h2>
                </div>
                <span className="featured-live-note">실시간 재고 반영</span>
              </div>

              {featuredProduct ? (
                <article className="featured-product">
                  <div className="product-art product-art-viewer">
                    <Image
                      alt={`${featuredProduct.name} 상품 이미지`}
                      fill
                      sizes="180px"
                      src={stitchAssets.viewerProduct}
                    />
                    <small>품절 임박</small>
                  </div>
                  <div className="product-copy">
                    <p className="product-name">{featuredProduct.name}</p>
                    <p>{featuredProduct.description}</p>
                    <strong>{formatKrw(featuredProduct.priceKrw)}</strong>
                    <MockOrderForm
                      activeCoupon={activeCoupon}
                      accessToken={accessToken}
                      key={featuredProduct.id}
                      liveId={live.id}
                      liveStatus={live.status}
                      product={featuredProduct}
                    />
                  </div>
                </article>
              ) : (
                <div className="empty-product">
                  운영자가 상품을 소개하면 이 영역이 페이지 새로고침 없이 바뀝니다.
                </div>
              )}
            </section>

            <ActiveCouponPanel coupon={activeCoupon} />
          </div>
        </div>

        <ChatPanel
          accessToken={accessToken}
          currentUser={
            accessToken ? { id: 'demo-viewer', nickname: 'Demo Viewer', role: 'VIEWER' } : null
          }
          chatTimeoutExpiresAt={chatAccessQuery.data?.timeoutExpiresAt ?? null}
          liveId={liveId}
          hasMore={snapshotQuery.data.chat.hasMore}
          messages={snapshotQuery.data.chat.messages}
          mobileAccessory={
            featuredProduct ? (
              <MobileProductCard
                accessToken={accessToken}
                activeCoupon={activeCoupon}
                liveId={live.id}
                liveStatus={live.status}
                product={featuredProduct}
              />
            ) : null
          }
          sessionError={sessionError}
          variant="viewer"
        />
      </section>

      {sessionError ? (
        <p className="viewer-session-error" role="alert">
          {sessionError}
        </p>
      ) : null}
    </main>
  );
}
