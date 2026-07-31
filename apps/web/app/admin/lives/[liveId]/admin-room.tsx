'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiveSnapshot } from '@liveflow/contracts';

import { ChatPanel } from '@/components/chat-panel';
import { CouponPublishForm } from '@/components/coupon-publish-form';
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
} from '@/lib/live-api';
import { useLiveRealtime } from '@/lib/use-live-realtime';
import { stitchAssets } from '@/lib/stitch-assets';

import { AdminProductControl, AdminSidebar } from './admin-room-sections';

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
  const lowestStockProduct = snapshot.products.reduce<{ name: string; stock: number } | null>(
    (lowest, product) => {
      const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
      return lowest === null || stock < lowest.stock ? { name: product.name, stock } : lowest;
    },
    null,
  );
  const featureMutationStatus = featureMutation.isPending
    ? '시청자 화면에 반영하는 중입니다…'
    : featureMutation.isError
      ? featureMutation.error instanceof Error
        ? featureMutation.error.message
        : '상품 변경에 실패했습니다.'
      : '저장 후 실시간 이벤트가 발행됩니다.';

  return (
    <main className="admin-shell">
      <AdminSidebar
        accessToken={accessToken}
        liveId={liveId}
        loginError={loginError}
        onLogin={handleLogin}
        onPasswordChange={setPassword}
        password={password}
      />

      <section className="admin-main">
        <header className="admin-topbar">
          <div className="admin-live-heading">
            <span className={`admin-on-air is-${snapshot.live.status.toLowerCase()}`}>
              <span aria-hidden="true" />
              {snapshot.live.status === 'LIVE' ? 'ON AIR' : snapshot.live.status}
            </span>
            <div>
              <h1>{snapshot.live.title}</h1>
              <p>
                <span>{connectionLabel(connectionState)}</span>
                <span aria-hidden="true">•</span>
                서버 저장 후 실시간 반영
              </p>
            </div>
          </div>
          <Link className="admin-viewer-link" href={`/live/${liveId}`}>
            시청자 화면 보기 ↗
          </Link>
        </header>

        <div className="admin-dashboard-scroll" id="dashboard">
          <div className="admin-dashboard-grid">
            <div className="admin-left-column">
              <section className="admin-preview-card" id="broadcast-preview">
                <header>
                  <h2>◉ 송출 화면 미리보기</h2>
                  <Link href={`/live/${liveId}`}>전체화면 ↗</Link>
                </header>
                <div className="admin-preview-media">
                  <Image
                    alt="라이브 송출 화면 미리보기"
                    fill
                    priority
                    sizes="(max-width: 1000px) 100vw, 58vw"
                    src={stitchAssets.adminLive}
                  />
                  <span>SAFE AREA</span>
                </div>
              </section>

              <AdminProductControl
                accessToken={accessToken}
                featuredProductId={snapshot.featuredProduct?.id ?? null}
                isPending={featureMutation.isPending}
                mutationStatus={featureMutationStatus}
                onFeature={(productId) => featureMutation.mutate(productId)}
                products={snapshot.products}
              />

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
            </div>

            <aside className="admin-right-column" aria-label="실시간 운영 도구">
              <section className="admin-ai-card">
                <div className="admin-ai-heading">
                  <span aria-hidden="true">✦</span>
                  <h2>AI 채팅 요약 및 제안</h2>
                </div>
                <div>
                  <p>
                    라이브 채팅 요약과 운영 공지 제안은 다음 개발 단계에서 실제 AI 승인 흐름으로
                    연결됩니다.
                  </p>
                  <span>준비 중 · 운영자 승인 후 발행</span>
                </div>
              </section>

              <ChatPanel
                accessToken={accessToken}
                currentUser={
                  accessToken
                    ? { id: 'demo-admin', nickname: 'LiveFlow Admin', role: 'ADMIN' }
                    : null
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
                  timeoutUserMutation.isPending
                    ? (timeoutUserMutation.variables?.userId ?? null)
                    : null
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

              <div className="admin-metrics-grid">
                <article className="admin-metric-card coupon-metric">
                  <span>진행중</span>
                  <h3>라이브 쿠폰</h3>
                  <strong>
                    {snapshot.activeCoupon
                      ? snapshot.activeCoupon.type === 'PERCENT'
                        ? `${snapshot.activeCoupon.value}% 할인`
                        : `${formatKrw(snapshot.activeCoupon.value)} 할인`
                      : '발행된 쿠폰 없음'}
                  </strong>
                  <small>
                    {snapshot.activeCoupon
                      ? `${snapshot.activeCoupon.usedCount}장 사용됨`
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
          </div>
        </div>
      </section>
    </main>
  );
}
