'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { FormEventHandler } from 'react';
import type { AiSuggestion, LiveSnapshot, ReviewAiSuggestionRequest } from '@liveflow/contracts';

import { AiSuggestionPanel } from '@/components/ai-suggestion-panel';
import { ChatPanel } from '@/components/chat-panel';
import { stitchAssets } from '@/lib/stitch-assets';

const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

type AdminSidebarProps = {
  accessToken: string | null;
  liveId: string;
  loginError: string | null;
  onLogin: FormEventHandler<HTMLFormElement>;
  onPasswordChange: (password: string) => void;
  password: string;
};

export function AdminSidebar({
  accessToken,
  liveId,
  loginError,
  onLogin,
  onPasswordChange,
  password,
}: AdminSidebarProps) {
  return (
    <aside className="admin-sidebar" aria-label="운영자 메뉴">
      <Link className="admin-brand" href="/">
        <span aria-hidden="true">▰</span>
        LiveFlow
      </Link>

      <div className="admin-profile">
        <span className="admin-profile-image">
          <Image alt="운영 관리자" fill sizes="48px" src={stitchAssets.adminProfile} />
        </span>
        <div>
          <strong>운영 관리자</strong>
          <small>LiveFlow Admin</small>
        </div>
      </div>

      {accessToken ? (
        <section className="admin-session-card">
          <span className="admin-session-dot" aria-hidden="true" />
          <div>
            <strong>관리자 세션 연결됨</strong>
            <small>운영 변경 권한 확인 완료</small>
          </div>
        </section>
      ) : (
        <section className="admin-login" aria-labelledby="login-heading">
          <p className="panel-kicker">DEMO ADMIN</p>
          <h2 id="login-heading">운영자 로그인</h2>
          <form onSubmit={onLogin}>
            <label htmlFor="admin-password">관리자 비밀번호</label>
            <input
              autoComplete="current-password"
              id="admin-password"
              onChange={(event) => onPasswordChange(event.target.value)}
              required
              type="password"
              value={password}
            />
            {loginError ? (
              <p className="form-error" role="alert">
                {loginError}
              </p>
            ) : null}
            <button type="submit">관리자 세션 시작</button>
          </form>
        </section>
      )}

      <Link className="admin-broadcast-button" href={`/live/${liveId}`}>
        시청자 화면 열기
      </Link>

      <nav className="admin-nav" aria-label="컨트롤룸 바로가기">
        <a className="is-active" href="#dashboard">
          <span aria-hidden="true">▦</span> 대시보드
        </a>
        <a href="#broadcast-preview">
          <span aria-hidden="true">▶</span> 라이브 관리
        </a>
        <a href="#product-control-heading">
          <span aria-hidden="true">□</span> 상품 관리
        </a>
        <a href="#coupon-control-heading">
          <span aria-hidden="true">◇</span> 쿠폰 설정
        </a>
        <a href="#admin-chat-heading">
          <span aria-hidden="true">○</span> 채팅 모니터링
        </a>
        <Link href="/admin/audit-logs">
          <span aria-hidden="true">◷</span> 감사 로그
        </Link>
      </nav>
    </aside>
  );
}

type AdminProductControlProps = {
  accessToken: string | null;
  featuredProductId: string | null;
  isPending: boolean;
  mutationStatus: string;
  onFeature: (productId: string) => void;
  products: LiveSnapshot['products'];
};

export function AdminProductControl({
  accessToken,
  featuredProductId,
  isPending,
  mutationStatus,
  onFeature,
  products,
}: AdminProductControlProps) {
  return (
    <section className="product-control" aria-labelledby="product-control-heading">
      <div className="section-heading">
        <div>
          <p className="panel-kicker">FEATURED PRODUCT</p>
          <h2 id="product-control-heading">현재 소개 상품 선택</h2>
        </div>
        <p aria-live="polite" className="mutation-status">
          {mutationStatus}
        </p>
      </div>

      <div className="admin-product-grid">
        {products.map((product) => {
          const isFeatured = product.id === featuredProductId;
          return (
            <article
              className={`admin-product ${isFeatured ? 'is-featured' : ''}`}
              key={product.id}
            >
              <div className="admin-product-image">
                <Image
                  alt={`${product.name} 상품 이미지`}
                  fill
                  sizes="160px"
                  src={stitchAssets.adminProduct}
                />
              </div>
              <div className="admin-product-copy">
                <span>{isFeatured ? '노출 중' : '대기'}</span>
                <p className="product-name">{product.name}</p>
                <strong>{formatKrw(product.priceKrw)}</strong>
                <small>
                  총 재고 {product.variants.reduce((sum, variant) => sum + variant.stock, 0)}개
                </small>
              </div>
              <button
                disabled={!accessToken || isPending || isFeatured}
                onClick={() => onFeature(product.id)}
                type="button"
              >
                {isFeatured ? '현재 소개 중' : '소개하기'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

type AdminBroadcastControlProps = {
  accessToken: string | null;
  error: string | null;
  isPending: boolean;
  onEnd: () => void;
  onStart: () => void;
  status: LiveSnapshot['live']['status'];
};

export function AdminBroadcastControl({
  accessToken,
  error,
  isPending,
  onEnd,
  onStart,
  status,
}: AdminBroadcastControlProps) {
  const isReady = status === 'READY';
  const isLive = status === 'LIVE';
  const statusMessage = isReady
    ? '방송을 시작하면 시청자 화면의 채팅과 주문이 활성화됩니다.'
    : isLive
      ? '방송을 종료하면 신규 시청자 채팅과 주문이 즉시 제한됩니다.'
      : '방송이 종료되었습니다. 시청자는 다시보기 정보만 확인할 수 있습니다.';

  return (
    <section className="broadcast-control" aria-labelledby="broadcast-control-heading">
      <div>
        <p className="panel-kicker">BROADCAST CONTROL</p>
        <h2 id="broadcast-control-heading">방송 상태 제어</h2>
        <p aria-live="polite" className={error ? 'form-error' : 'broadcast-control-status'}>
          {error ?? statusMessage}
        </p>
      </div>
      {isReady ? (
        <button disabled={!accessToken || isPending} onClick={onStart} type="button">
          {isPending ? '방송 시작 중…' : '방송 시작'}
        </button>
      ) : isLive ? (
        <button
          className="broadcast-control-end"
          disabled={!accessToken || isPending}
          onClick={onEnd}
          type="button"
        >
          {isPending ? '방송 종료 중…' : '방송 종료'}
        </button>
      ) : (
        <span className="broadcast-control-ended">종료됨</span>
      )}
    </section>
  );
}

type AdminRightColumnProps = {
  accessToken: string | null;
  activeCoupon: LiveSnapshot['activeCoupon'];
  aiError: string | null;
  aiSuggestions: AiSuggestion[] | undefined;
  chat: LiveSnapshot['chat'];
  hidingMessageId: string | null;
  isReviewingSuggestionId: string | null;
  isSummarizing: boolean;
  liveId: string;
  liveStatus: LiveSnapshot['live']['status'];
  loginError: string | null;
  lowestStockProduct: { name: string; stock: number } | null;
  moderationError: string | null;
  onCreateSummary: () => void;
  onHideMessage: (messageId: string, reason: string) => void;
  onReview: (suggestionId: string, review: ReviewAiSuggestionRequest) => void;
  onTimeoutUser: (userId: string, durationMinutes: number, reason: string) => void;
  timingOutUserId: string | null;
};

export function AdminRightColumn({
  accessToken,
  activeCoupon,
  aiError,
  aiSuggestions,
  chat,
  hidingMessageId,
  isReviewingSuggestionId,
  isSummarizing,
  liveId,
  liveStatus,
  loginError,
  lowestStockProduct,
  moderationError,
  onCreateSummary,
  onHideMessage,
  onReview,
  onTimeoutUser,
  timingOutUserId,
}: AdminRightColumnProps) {
  return (
    <aside className="admin-right-column" aria-label="실시간 운영 도구">
      <AiSuggestionPanel
        accessToken={accessToken}
        error={aiError}
        isReviewingSuggestionId={isReviewingSuggestionId}
        isSummarizing={isSummarizing}
        onCreateSummary={onCreateSummary}
        onReview={onReview}
        suggestions={aiSuggestions}
      />

      <ChatPanel
        accessToken={accessToken}
        currentUser={
          accessToken ? { id: 'demo-admin', nickname: 'LiveFlow Admin', role: 'ADMIN' } : null
        }
        liveId={liveId}
        hasMore={chat.hasMore}
        liveStatus={liveStatus}
        messages={chat.messages}
        hidingMessageId={hidingMessageId}
        timingOutUserId={timingOutUserId}
        moderationError={moderationError}
        sessionError={loginError}
        variant="admin"
        {...(accessToken
          ? {
              onHideMessage,
              onTimeoutUser,
            }
          : {})}
      />

      <div className="admin-metrics-grid">
        <article className="admin-metric-card coupon-metric">
          <span>진행중</span>
          <h3>라이브 쿠폰</h3>
          <strong>
            {activeCoupon
              ? activeCoupon.type === 'PERCENT'
                ? `${activeCoupon.value}% 할인`
                : `${formatKrw(activeCoupon.value)} 할인`
              : '발행된 쿠폰 없음'}
          </strong>
          <small>
            {activeCoupon
              ? `${activeCoupon.usedCount}장 사용됨`
              : '아래 쿠폰 설정에서 발행할 수 있습니다.'}
          </small>
        </article>
        <article className="admin-metric-card stock-metric">
          <span>재고 현황</span>
          <h3>{lowestStockProduct?.name ?? '등록 상품 없음'}</h3>
          <strong>{lowestStockProduct?.stock ?? 0}개</strong>
          <small>현재 가장 적은 총 재고</small>
        </article>
      </div>
    </aside>
  );
}
