'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiveSnapshot } from '@liveflow/contracts';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { ChatPanel } from '../../../../components/chat-panel';
import { CouponPublishForm } from '../../../../components/coupon-publish-form';
import {
  ApiRequestError,
  createAdminSession,
  featureProduct,
  fetchLiveSnapshot,
  hideChatMessage,
  liveSnapshotQueryKey,
  mergeChatMessageHiddenEvent,
  mergeCouponPublishedEvent,
  mergeProductFeaturedEvent,
  publishCoupon,
  timeoutChatUser,
} from '../../../../lib/live-api';
import { useLiveRealtime } from '../../../../lib/use-live-realtime';

const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});

function formatKrw(amount: number): string {
  return krwFormatter.format(amount);
}

function connectionLabel(connectionState: ReturnType<typeof useLiveRealtime>): string {
  const labels: Record<ReturnType<typeof useLiveRealtime>, string> = {
    CONNECTING: '실시간 서버 연결 중',
    CONNECTED: '실시간 연결됨',
    RECOVERING: '변경 사항 동기화 중',
    DISCONNECTED: '연결이 끊겼습니다',
    FAILED: '실시간 연결에 실패했습니다',
  };

  return labels[connectionState];
}

export function AdminRoom({ liveId }: { liveId: string }) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const snapshotQuery = useQuery({
    queryKey: liveSnapshotQueryKey(liveId),
    queryFn: () => fetchLiveSnapshot(liveId),
  });
  const connectionState = useLiveRealtime(liveId, accessToken);

  const featureMutation = useMutation({
    mutationFn: (productId: string | null) => {
      if (!accessToken) {
        throw new Error('관리자 세션이 필요합니다.');
      }

      return featureProduct(liveId, productId, accessToken);
    },
    onSuccess: (event) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(liveId), (snapshot) =>
        mergeProductFeaturedEvent(snapshot, event),
      );
    },
  });
  const hideMessageMutation = useMutation({
    mutationFn: (input: { messageId: string; reason: string }) => {
      if (!accessToken) {
        throw new Error('관리자 세션이 필요합니다.');
      }

      return hideChatMessage(liveId, input.messageId, input.reason, accessToken);
    },
    onSuccess: (event) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(liveId), (snapshot) =>
        mergeChatMessageHiddenEvent(snapshot, event),
      );
    },
  });
  const timeoutUserMutation = useMutation({
    mutationFn: (input: { userId: string; durationMinutes: number; reason: string }) => {
      if (!accessToken) {
        throw new Error('관리자 세션이 필요합니다.');
      }

      return timeoutChatUser(liveId, input.userId, input, accessToken);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveSnapshotQueryKey(liveId) }),
  });
  const couponMutation = useMutation({
    mutationFn: (input: {
      type: 'PERCENT' | 'FIXED';
      value: number;
      minOrderAmountKrw: number;
      endsAt: string;
      usageLimit: number | null;
    }) => {
      if (!accessToken) {
        throw new Error('관리자 세션이 필요합니다.');
      }

      return publishCoupon(liveId, input, accessToken);
    },
    onSuccess: (event) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(liveId), (snapshot) =>
        mergeCouponPublishedEvent(snapshot, event),
      );
    },
  });

  async function handleLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoginError(null);

    try {
      const token = await createAdminSession(password);
      setAccessToken(token);
      setPassword('');
    } catch (error: unknown) {
      setLoginError(
        error instanceof ApiRequestError
          ? error.message
          : '관리자 세션을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }
  }

  if (snapshotQuery.isPending) {
    return <main className="screen-state">운영자 컨트롤룸을 준비하는 중입니다…</main>;
  }

  if (snapshotQuery.isError || !snapshotQuery.data) {
    return (
      <main className="screen-state" role="alert">
        방송 정보를 불러오지 못했습니다. API 서버가 실행 중인지 확인해 주세요.
      </main>
    );
  }

  const snapshot = snapshotQuery.data;

  return (
    <main className="live-shell admin-shell">
      <header className="topbar admin-topbar">
        <Link className="brand" href="/">
          LIVEFLOW <span>/ CONTROL ROOM</span>
        </Link>
        <Link className="text-link" href={`/live/${liveId}`}>
          시청자 화면 보기
        </Link>
      </header>

      <div className="admin-workspace">
        <aside className="admin-sidebar" aria-label="운영자 세션">
          <div className="admin-profile">
            <span aria-hidden="true">LF</span>
            <div>
              <strong>운영자 컨트롤</strong>
              <small>LiveFlow Admin</small>
            </div>
          </div>
          <div className="admin-sidebar-divider" />
          {accessToken ? (
            <section className="admin-session-card">
              <p className="panel-kicker">ADMIN SESSION</p>
              <strong>권한이 확인되었습니다</strong>
              <p>상품, 쿠폰, 채팅 운영 변경은 서버 저장 후 시청자에게 실시간 전파됩니다.</p>
            </section>
          ) : (
            <section className="admin-login" aria-labelledby="login-heading">
              <p className="panel-kicker">DEMO ADMIN</p>
              <h2 id="login-heading">운영자 로그인</h2>
              <p>상품 노출과 채팅 운영 전 관리자 세션이 필요합니다.</p>
              <form onSubmit={handleLogin}>
                <label htmlFor="admin-password">관리자 비밀번호</label>
                <input
                  autoComplete="current-password"
                  id="admin-password"
                  onChange={(event) => setPassword(event.target.value)}
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
          <Link className="admin-viewer-link" href={`/live/${liveId}`}>
            시청자 화면 미리보기
          </Link>
        </aside>

        <section className="admin-primary">
          <section className="admin-header">
            <div>
              <p className="panel-kicker">BROADCAST CONTROL</p>
              <h1>{snapshot.live.title}</h1>
              <p>
                방송 상태 <strong>{snapshot.live.status}</strong> ·{' '}
                {connectionLabel(connectionState)}
              </p>
            </div>
            <span className={`admin-session-status ${accessToken ? '' : 'muted'}`}>
              {accessToken ? '관리자 세션 연결됨' : '관리자 로그인이 필요합니다'}
            </span>
          </section>

          <section className="admin-preview" aria-label="라이브 상태 미리보기">
            <div className="admin-preview-overlay">
              <span className="live-badge">LIVE PREVIEW</span>
              <p>시청자 노출 화면</p>
              <strong>{snapshot.featuredProduct?.name ?? '소개 상품을 선택해 주세요'}</strong>
            </div>
            <span aria-hidden="true" className="admin-preview-mark">
              LIVE
              <br />
              FLOW
            </span>
          </section>

          <section className="product-control" aria-labelledby="product-control-heading">
            <div className="section-heading">
              <div>
                <p className="panel-kicker">FEATURED PRODUCT</p>
                <h2 id="product-control-heading">현재 소개 상품 선택</h2>
              </div>
              <p aria-live="polite" className="mutation-status">
                {featureMutation.isPending
                  ? '상품을 저장하고 시청자에게 반영하는 중입니다…'
                  : featureMutation.isError
                    ? featureMutation.error instanceof Error
                      ? featureMutation.error.message
                      : '상품 변경에 실패했습니다.'
                    : '저장 성공 후 실시간 이벤트가 발행됩니다.'}
              </p>
            </div>

            <div className="admin-product-grid">
              {snapshot.products.map((product) => {
                const isFeatured = product.id === snapshot.featuredProduct?.id;
                return (
                  <article
                    className={`admin-product ${isFeatured ? 'is-featured' : ''}`}
                    key={product.id}
                  >
                    <div className="product-art" aria-hidden="true">
                      <span>{product.name.slice(0, 1)}</span>
                    </div>
                    <p className="product-name">{product.name}</p>
                    <p>{product.description}</p>
                    <strong>{formatKrw(product.priceKrw)}</strong>
                    <p className="stock-summary">
                      총 재고 {product.variants.reduce((sum, variant) => sum + variant.stock, 0)}개
                    </p>
                    <button
                      disabled={!accessToken || featureMutation.isPending || isFeatured}
                      onClick={() => featureMutation.mutate(product.id)}
                      type="button"
                    >
                      {isFeatured ? '현재 소개 중' : '이 상품 소개하기'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </section>

        <aside className="admin-operations" aria-label="실시간 운영 도구">
          <CouponPublishForm
            disabled={!accessToken}
            error={
              couponMutation.isError
                ? couponMutation.error instanceof Error
                  ? couponMutation.error.message
                  : '쿠폰을 발행하지 못했습니다. 다시 시도해 주세요.'
                : null
            }
            isPending={couponMutation.isPending}
            onPublish={(input) => couponMutation.mutateAsync(input)}
          />

          <ChatPanel
            accessToken={accessToken}
            currentUser={
              accessToken ? { id: 'demo-admin', nickname: 'LiveFlow Admin', role: 'ADMIN' } : null
            }
            liveId={liveId}
            hasMore={snapshot.chat.hasMore}
            messages={snapshot.chat.messages}
            hidingMessageId={
              hideMessageMutation.isPending
                ? (hideMessageMutation.variables?.messageId ?? null)
                : null
            }
            timingOutUserId={
              timeoutUserMutation.isPending ? (timeoutUserMutation.variables?.userId ?? null) : null
            }
            moderationError={
              hideMessageMutation.isError
                ? hideMessageMutation.error instanceof Error
                  ? hideMessageMutation.error.message
                  : '메시지를 숨기지 못했습니다. 다시 시도해 주세요.'
                : timeoutUserMutation.isError
                  ? timeoutUserMutation.error instanceof Error
                    ? timeoutUserMutation.error.message
                    : '사용자를 채팅 제한하지 못했습니다. 다시 시도해 주세요.'
                  : null
            }
            sessionError={loginError}
            variant="admin"
            {...(accessToken
              ? {
                  onHideMessage: (messageId: string, reason: string) =>
                    hideMessageMutation.mutate({ messageId, reason }),
                  onTimeoutUser: (userId: string, durationMinutes: number, reason: string) =>
                    timeoutUserMutation.mutate({ userId, durationMinutes, reason }),
                }
              : {})}
          />
        </aside>
      </div>
    </main>
  );
}
