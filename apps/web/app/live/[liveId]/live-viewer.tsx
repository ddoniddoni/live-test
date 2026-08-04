'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { Announcement, Coupon, LiveStatus, Product } from '@liveflow/contracts';

import { ChatPanel } from '@/components/chat-panel';
import { MockLivePlayback } from '@/components/mock-live-playback';
import { MockOrderForm } from '@/components/mock-order-form';
import { ProductQuestionPanel } from '@/components/product-question-panel';
import { ScreenState } from '@/components/screen-state';
import {
  ApiRequestError,
  chatAccessQueryKey,
  createViewerSession,
  fetchChatAccess,
  fetchLiveSnapshot,
  liveSnapshotQueryKey,
} from '@/lib/live-api';
import { useLiveRealtime } from '@/lib/use-live-realtime';
import type { ConnectionState } from '@/lib/use-live-realtime';
import { stitchAssets } from '@/lib/stitch-assets';

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

function LatestAnnouncementBanner({ announcement }: { announcement: Announcement | null }) {
  if (!announcement) {
    return null;
  }

  return (
    <section
      className="viewer-announcement"
      aria-live="polite"
      aria-labelledby="announcement-heading"
    >
      <p className="panel-kicker">LIVE NOTICE</p>
      <div>
        <h2 id="announcement-heading">운영 공지</h2>
        <p>{announcement.content}</p>
      </div>
    </section>
  );
}

function MobileProductCard({
  accessToken,
  activeCoupon,
  liveId,
  liveStatus,
  onAskProduct,
  product,
}: {
  accessToken: string | null;
  activeCoupon: Coupon | null;
  liveId: string;
  liveStatus: LiveStatus;
  onAskProduct: () => void;
  product: Product;
}) {
  return (
    <article className="mobile-product-card">
      <div className="mobile-product-image">
        <Image alt="라이브 소개 상품" fill sizes="64px" src={stitchAssets.mobileProduct} />
      </div>
      <div className="mobile-product-copy">
        <div>
          <span>한정 특가</span>
          <strong>{product.name}</strong>
        </div>
        <p>
          {formatKrw(product.priceKrw)}
          <small>실시간 재고 반영</small>
        </p>
      </div>
      <MockOrderForm
        accessToken={accessToken}
        activeCoupon={activeCoupon}
        liveId={liveId}
        liveStatus={liveStatus}
        product={product}
        variant="compact"
      />
      <button
        aria-label="AI에게 상품 질문하기"
        className="mobile-product-question-button"
        onClick={onAskProduct}
        type="button"
      >
        ✦
      </button>
    </article>
  );
}

export function LiveViewer({ liveId }: { liveId: string }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const mobileQuestionDialogRef = useRef<HTMLDialogElement>(null);
  const snapshotQuery = useQuery({
    queryKey: liveSnapshotQueryKey(liveId),
    queryFn: () => fetchLiveSnapshot(liveId),
  });
  const isLive = snapshotQuery.data?.live.status === 'LIVE';
  const chatAccessQuery = useQuery({
    queryKey: chatAccessQueryKey(liveId),
    queryFn: () => fetchChatAccess(liveId, accessToken ?? ''),
    enabled: accessToken !== null && isLive,
  });
  const { connectionState, retry: retryRealtimeConnection } = useLiveRealtime(liveId, accessToken);

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
    return <ScreenState>방송 정보를 불러오는 중입니다…</ScreenState>;
  }

  if (snapshotQuery.isError || !snapshotQuery.data) {
    return (
      <ScreenState tone="error">
        방송 정보를 불러오지 못했습니다. API 서버가 실행 중인지 확인해 주세요.
      </ScreenState>
    );
  }

  const { activeCoupon, featuredProduct, latestAnnouncement, live } = snapshotQuery.data;
  const isChatLive = live.status === 'LIVE';
  const liveStatusLabels: Record<LiveStatus, string> = {
    DRAFT: 'DRAFT',
    SCHEDULED: 'SCHEDULED',
    READY: 'COMING SOON',
    LIVE: 'LIVE',
    ENDED: 'ENDED',
    CANCELLED: 'CANCELLED',
  };
  const liveStatusLabel = liveStatusLabels[live.status];
  const chatStandbyMessages: Record<
    Exclude<LiveStatus, 'LIVE'>,
    { heading: string; body: string }
  > = {
    DRAFT: {
      heading: '방송 정보를 준비하고 있습니다',
      body: '방송이 공개되면 실시간 채팅과 AI 상품 질문을 이용할 수 있습니다.',
    },
    SCHEDULED: {
      heading: '라이브 시작 대기 중',
      body: '예정된 방송이 시작되면 실시간 채팅과 AI 상품 질문이 열립니다.',
    },
    READY: {
      heading: '라이브 시작 대기 중',
      body: '방송이 시작되면 실시간 채팅과 AI 상품 질문이 열립니다.',
    },
    ENDED: {
      heading: '라이브가 종료되었습니다',
      body: '이 방송의 실시간 채팅은 종료되었습니다.',
    },
    CANCELLED: {
      heading: '방송이 취소되었습니다',
      body: '다른 라이브 방송에서 다시 만나요.',
    },
  };
  const chatStandbyMessage = live.status === 'LIVE' ? null : chatStandbyMessages[live.status];

  return (
    <main className="live-shell viewer-shell">
      <header className="topbar viewer-topbar">
        <div className="topbar-brand-group">
          <Link className="brand" href="/">
            StreamOps Elite
          </Link>
          <nav className="viewer-desktop-nav" aria-label="주요 메뉴">
            <Link href="/">Dashboard</Link>
            <a className="is-active" href="#live-stage">
              Analytics
            </a>
            <a href="#featured-heading">Schedule</a>
          </nav>
        </div>
        <div className="topbar-actions">
          <span className={`topbar-live-badge is-${live.status.toLowerCase()}`}>
            <span aria-hidden="true" />
            {liveStatusLabel}
          </span>
          {connectionState === 'DISCONNECTED' || connectionState === 'FAILED' ? (
            <button className="connection-retry" onClick={retryRealtimeConnection} type="button">
              다시 연결
            </button>
          ) : (
            <span className={`connection-pill connection-${connectionState.toLowerCase()}`}>
              <span aria-hidden="true" />
              {connectionLabel(connectionState)}
            </span>
          )}
          <Link className="text-link" href={`/admin/lives/${liveId}`}>
            운영자 화면
          </Link>
        </div>
      </header>

      <section className="viewer-layout" aria-label="라이브 방송">
        <div className="viewer-main-column">
          <section className="broadcast-stage" aria-label="라이브 영상 영역" id="live-stage">
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
            <MockLivePlayback live={live} />

            <div className="stage-desktop-overlay">
              <div className="stage-stream-stats">
                <span>◉ {live.status === 'LIVE' ? '2.4k' : liveStatusLabel}</span>
                <span>⚡ 98% Health</span>
              </div>
              <div className="stage-now-showing">
                <span>실시간 시연 중</span>
                <strong>{featuredProduct?.name ?? live.title}</strong>
              </div>
            </div>

            <div className="mobile-live-header">
              <div className="mobile-stream-stats">
                <span className={`mobile-live-badge is-${live.status.toLowerCase()}`}>
                  <span aria-hidden="true" />
                  {liveStatusLabel}
                </span>
                <span className="mobile-viewer-count">◉ 12,408</span>
              </div>
              <div className="mobile-live-actions">
                <span
                  aria-label={connectionLabel(connectionState)}
                  title={connectionLabel(connectionState)}
                >
                  ↗
                </span>
                <Link aria-label="라이브 나가기" href="/">
                  ×
                </Link>
              </div>
            </div>
          </section>

          <LatestAnnouncementBanner announcement={latestAnnouncement} />

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

        <aside className="viewer-interaction-column" aria-label="라이브 상호작용">
          {isChatLive ? (
            <>
              {featuredProduct ? (
                <ProductQuestionPanel
                  accessToken={accessToken}
                  headingId="desktop-product-question-heading"
                  key={featuredProduct.id}
                  liveId={live.id}
                  product={featuredProduct}
                />
              ) : null}

              <ChatPanel
                accessToken={accessToken}
                currentUser={
                  accessToken
                    ? { id: 'demo-viewer', nickname: 'Demo Viewer', role: 'VIEWER' }
                    : null
                }
                chatTimeoutExpiresAt={chatAccessQuery.data?.timeoutExpiresAt ?? null}
                liveId={liveId}
                liveStatus={live.status}
                hasMore={snapshotQuery.data.chat.hasMore}
                messages={snapshotQuery.data.chat.messages}
                mobileAccessory={
                  featuredProduct ? (
                    <MobileProductCard
                      accessToken={accessToken}
                      activeCoupon={activeCoupon}
                      liveId={live.id}
                      liveStatus={live.status}
                      onAskProduct={() => {
                        if (!mobileQuestionDialogRef.current?.open) {
                          mobileQuestionDialogRef.current?.showModal();
                        }
                      }}
                      product={featuredProduct}
                    />
                  ) : null
                }
                sessionError={sessionError}
                variant="viewer"
              />
            </>
          ) : (
            <section className="viewer-chat-standby" role="status">
              <span aria-hidden="true">◌</span>
              <h2>{chatStandbyMessage?.heading ?? '라이브 시작 대기 중'}</h2>
              <p>
                {chatStandbyMessage?.body ?? '방송이 시작되면 실시간 채팅에 참여할 수 있습니다.'}
              </p>
            </section>
          )}
        </aside>
      </section>

      {featuredProduct ? (
        <dialog
          aria-labelledby="mobile-product-question-heading"
          className="mobile-product-question-sheet"
          ref={mobileQuestionDialogRef}
        >
          <div className="mobile-product-question-sheet-content">
            <button
              aria-label="상품 질문 닫기"
              className="mobile-product-question-close"
              onClick={() => mobileQuestionDialogRef.current?.close()}
              type="button"
            >
              닫기
            </button>
            <ProductQuestionPanel
              accessToken={accessToken}
              headingId="mobile-product-question-heading"
              key={featuredProduct.id}
              liveId={live.id}
              product={featuredProduct}
            />
          </div>
        </dialog>
      ) : null}

      {sessionError ? (
        <p className="viewer-session-error" role="alert">
          {sessionError}
        </p>
      ) : null}
    </main>
  );
}
