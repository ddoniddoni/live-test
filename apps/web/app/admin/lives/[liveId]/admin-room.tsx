'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  InventoryLowEvent,
  LiveSnapshot,
  LiveStatusTransitionAction,
  PublishAnnouncementRequest,
  ReviewAiSuggestionRequest,
} from '@liveflow/contracts';

import { AnnouncementPublishForm } from '@/components/announcement-publish-form';
import { AdminOrdersInventoryPanel } from '@/components/admin-orders-inventory-panel';
import { CouponPublishForm } from '@/components/coupon-publish-form';
import {
  ApiRequestError,
  aiSuggestionsQueryKey,
  createAiChatSummary,
  createAdminSession,
  endLive,
  featureProduct,
  fetchAiSuggestions,
  fetchLiveSnapshot,
  fetchRecentOrders,
  hideChatMessage,
  liveSnapshotQueryKey,
  inventoryLowAlertsQueryKey,
  mergeChatMessageHiddenEvent,
  mergeAnnouncementPublishedEvent,
  mergeCouponPublishedEvent,
  mergeLiveStatusChangedEvent,
  mergeProductFeaturedEvent,
  publishCoupon,
  publishAnnouncement,
  reviewAiSuggestion,
  recentOrdersQueryKey,
  startLive,
  timeoutChatUser,
} from '@/lib/live-api';
import { useLiveRealtime } from '@/lib/use-live-realtime';
import { stitchAssets } from '@/lib/stitch-assets';

import {
  AdminBroadcastControl,
  AdminProductControl,
  AdminRightColumn,
  AdminSidebar,
} from './admin-room-sections';

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
  const aiSuggestionsQuery = useQuery({
    queryKey: aiSuggestionsQueryKey(liveId),
    queryFn: () => fetchAiSuggestions(liveId, accessToken ?? ''),
    enabled: accessToken !== null,
  });
  const recentOrdersQuery = useQuery({
    queryKey: recentOrdersQueryKey(liveId),
    queryFn: () => fetchRecentOrders(liveId, { limit: 10 }, accessToken ?? ''),
    enabled: accessToken !== null,
  });
  const inventoryLowAlertsQuery = useQuery({
    queryKey: inventoryLowAlertsQueryKey(liveId),
    queryFn: async (): Promise<InventoryLowEvent[]> => [],
    enabled: false,
    initialData: [] as InventoryLowEvent[],
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
  const broadcastMutation = useMutation({
    mutationFn: (action: LiveStatusTransitionAction) => {
      if (!accessToken) {
        throw new Error('관리자 세션이 필요합니다.');
      }

      return action === 'START' ? startLive(liveId, accessToken) : endLive(liveId, accessToken);
    },
    onSuccess: (event) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(liveId), (snapshot) =>
        mergeLiveStatusChangedEvent(snapshot, event),
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
  const announcementMutation = useMutation({
    mutationFn: (input: PublishAnnouncementRequest) => {
      if (!accessToken) {
        throw new Error('관리자 세션이 필요합니다.');
      }

      return publishAnnouncement(liveId, input, accessToken);
    },
    onSuccess: (event) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(liveId), (snapshot) =>
        mergeAnnouncementPublishedEvent(snapshot, event),
      );
    },
  });
  const chatSummaryMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) {
        throw new Error('관리자 세션이 필요합니다.');
      }

      return createAiChatSummary(liveId, accessToken);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: aiSuggestionsQueryKey(liveId),
      }),
  });
  const reviewAiSuggestionMutation = useMutation({
    mutationFn: (input: { suggestionId: string; review: ReviewAiSuggestionRequest }) => {
      if (!accessToken) {
        throw new Error('관리자 세션이 필요합니다.');
      }

      return reviewAiSuggestion(input.suggestionId, input.review, accessToken);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: aiSuggestionsQueryKey(liveId),
      }),
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

              <AdminBroadcastControl
                accessToken={accessToken}
                error={
                  broadcastMutation.isError
                    ? broadcastMutation.error instanceof Error
                      ? broadcastMutation.error.message
                      : '방송 상태를 변경하지 못했습니다. 다시 시도해 주세요.'
                    : null
                }
                isPending={broadcastMutation.isPending}
                onEnd={() => broadcastMutation.mutate('END')}
                onStart={() => broadcastMutation.mutate('START')}
                status={snapshot.live.status}
              />

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

              <AnnouncementPublishForm
                disabled={!accessToken}
                error={
                  announcementMutation.isError
                    ? announcementMutation.error instanceof Error
                      ? announcementMutation.error.message
                      : '공지를 발행하지 못했습니다. 다시 시도해 주세요.'
                    : null
                }
                isPending={announcementMutation.isPending}
                onPublish={(input) => announcementMutation.mutateAsync(input)}
              />

              <AdminOrdersInventoryPanel
                inventoryLowAlerts={inventoryLowAlertsQuery.data}
                orders={recentOrdersQuery.data}
                ordersError={
                  recentOrdersQuery.isError
                    ? recentOrdersQuery.error instanceof Error
                      ? recentOrdersQuery.error.message
                      : '최근 주문을 불러오지 못했습니다. 다시 시도해 주세요.'
                    : null
                }
                ordersLoading={recentOrdersQuery.isPending}
                products={snapshot.products}
                requiresAdminSession={!accessToken}
              />
            </div>

            <AdminRightColumn
              accessToken={accessToken}
              activeCoupon={snapshot.activeCoupon}
              aiError={
                chatSummaryMutation.isError
                  ? chatSummaryMutation.error instanceof Error
                    ? chatSummaryMutation.error.message
                    : 'AI 채팅 요약을 만들지 못했습니다. 다시 시도해 주세요.'
                  : reviewAiSuggestionMutation.isError
                    ? reviewAiSuggestionMutation.error instanceof Error
                      ? reviewAiSuggestionMutation.error.message
                      : 'AI 제안을 검토하지 못했습니다. 다시 시도해 주세요.'
                    : aiSuggestionsQuery.isError
                      ? 'AI 제안 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'
                      : null
              }
              aiSuggestions={aiSuggestionsQuery.data}
              chat={snapshot.chat}
              hidingMessageId={
                hideMessageMutation.isPending
                  ? (hideMessageMutation.variables?.messageId ?? null)
                  : null
              }
              isReviewingSuggestionId={
                reviewAiSuggestionMutation.isPending
                  ? (reviewAiSuggestionMutation.variables?.suggestionId ?? null)
                  : null
              }
              isSummarizing={chatSummaryMutation.isPending}
              liveId={liveId}
              liveStatus={snapshot.live.status}
              loginError={loginError}
              lowestStockProduct={lowestStockProduct}
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
              onCreateSummary={() => chatSummaryMutation.mutate()}
              onHideMessage={(messageId, reason) =>
                hideMessageMutation.mutate({ messageId, reason })
              }
              onReview={(suggestionId, review) =>
                reviewAiSuggestionMutation.mutate({ review, suggestionId })
              }
              onTimeoutUser={(userId, durationMinutes, reason) =>
                timeoutUserMutation.mutate({ userId, durationMinutes, reason })
              }
              timingOutUserId={
                timeoutUserMutation.isPending
                  ? (timeoutUserMutation.variables?.userId ?? null)
                  : null
              }
            />
          </div>
        </div>
      </section>
    </main>
  );
}
