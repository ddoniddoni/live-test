'use client';

import Image from 'next/image';
import Link from 'next/link';
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
import { ScreenState } from '@/components/screen-state';
import {
  ApiRequestError,
  aiSuggestionsQueryKey,
  createAiChatSummary,
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
  removeChatMessageFromSnapshot,
  reviewAiSuggestion,
  recentOrdersQueryKey,
  startLive,
  timeoutChatUser,
} from '@/lib/live-api';
import { useLiveRealtime, type ConnectionState } from '@/lib/use-live-realtime';
import { stitchAssets } from '@/lib/stitch-assets';

import {
  AdminBroadcastControl,
  AdminProductControl,
  AdminRightColumn,
  AdminSidebar,
} from './admin-room-sections';

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

export function AdminRoom({ liveId, accessToken }: { liveId: string; accessToken: string }) {
  const queryClient = useQueryClient();
  const activeLiveId = liveId;
  const snapshotQuery = useQuery({
    queryKey: liveSnapshotQueryKey(activeLiveId),
    queryFn: () => fetchLiveSnapshot(activeLiveId),
  });
  const aiSuggestionsQuery = useQuery({
    queryKey: aiSuggestionsQueryKey(activeLiveId),
    queryFn: () => fetchAiSuggestions(activeLiveId, accessToken),
  });
  const recentOrdersQuery = useQuery({
    queryKey: recentOrdersQueryKey(activeLiveId),
    queryFn: () => fetchRecentOrders(activeLiveId, { limit: 10 }, accessToken),
  });
  const inventoryLowAlertsQuery = useQuery({
    queryKey: inventoryLowAlertsQueryKey(activeLiveId),
    queryFn: async (): Promise<InventoryLowEvent[]> => [],
    enabled: false,
    initialData: [] as InventoryLowEvent[],
  });
  const { connectionState, retry: retryRealtimeConnection } = useLiveRealtime(
    activeLiveId,
    accessToken,
  );

  const featureMutation = useMutation({
    mutationFn: (productId: string | null) => featureProduct(activeLiveId, productId, accessToken),
    onSuccess: (event) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(activeLiveId), (snapshot) =>
        mergeProductFeaturedEvent(snapshot, event),
      );
    },
  });
  const broadcastMutation = useMutation({
    mutationFn: (action: LiveStatusTransitionAction) =>
      action === 'START'
        ? startLive(activeLiveId, accessToken)
        : endLive(activeLiveId, accessToken),
    onSuccess: (event) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(activeLiveId), (snapshot) =>
        mergeLiveStatusChangedEvent(snapshot, event),
      );
    },
  });
  const hideMessageMutation = useMutation({
    mutationFn: (input: { messageId: string; reason: string }) =>
      hideChatMessage(activeLiveId, input.messageId, input.reason, accessToken),
    onSuccess: (event) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(activeLiveId), (snapshot) =>
        mergeChatMessageHiddenEvent(snapshot, event),
      );
      void queryClient.invalidateQueries({ queryKey: liveSnapshotQueryKey(activeLiveId) });
    },
    onError: (error, input) => {
      if (!(error instanceof ApiRequestError) || error.code !== 'CHAT_MESSAGE_ALREADY_HIDDEN') {
        return;
      }

      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(activeLiveId), (snapshot) =>
        removeChatMessageFromSnapshot(snapshot, input.messageId),
      );
      void queryClient.invalidateQueries({ queryKey: liveSnapshotQueryKey(activeLiveId) });
    },
  });
  const timeoutUserMutation = useMutation({
    mutationFn: (input: { userId: string; durationMinutes: number; reason: string }) =>
      timeoutChatUser(activeLiveId, input.userId, input, accessToken),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: liveSnapshotQueryKey(activeLiveId) }),
  });
  const couponMutation = useMutation({
    mutationFn: (input: {
      type: 'PERCENT' | 'FIXED';
      value: number;
      minOrderAmountKrw: number;
      endsAt: string;
      usageLimit: number | null;
    }) => publishCoupon(activeLiveId, input, accessToken),
    onSuccess: (event) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(activeLiveId), (snapshot) =>
        mergeCouponPublishedEvent(snapshot, event),
      );
    },
  });
  const announcementMutation = useMutation({
    mutationFn: (input: PublishAnnouncementRequest) =>
      publishAnnouncement(activeLiveId, input, accessToken),
    onSuccess: (event) => {
      queryClient.setQueryData<LiveSnapshot>(liveSnapshotQueryKey(activeLiveId), (snapshot) =>
        mergeAnnouncementPublishedEvent(snapshot, event),
      );
    },
  });
  const chatSummaryMutation = useMutation({
    mutationFn: () => createAiChatSummary(activeLiveId, accessToken),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: aiSuggestionsQueryKey(activeLiveId),
      }),
  });
  const reviewAiSuggestionMutation = useMutation({
    mutationFn: (input: { suggestionId: string; review: ReviewAiSuggestionRequest }) =>
      reviewAiSuggestion(input.suggestionId, input.review, accessToken),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: aiSuggestionsQueryKey(activeLiveId),
      }),
  });

  if (snapshotQuery.isPending) {
    return <ScreenState>운영자 컨트롤룸을 준비하는 중입니다…</ScreenState>;
  }

  if (snapshotQuery.isError || !snapshotQuery.data) {
    return (
      <ScreenState tone="error">
        방송 정보를 불러오지 못했습니다. API 서버가 실행 중인지 확인해 주세요.
      </ScreenState>
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
  const isAlreadyHiddenMessageReconciled =
    hideMessageMutation.isError &&
    hideMessageMutation.error instanceof ApiRequestError &&
    hideMessageMutation.error.code === 'CHAT_MESSAGE_ALREADY_HIDDEN';
  const moderationError =
    hideMessageMutation.isError && !isAlreadyHiddenMessageReconciled
      ? hideMessageMutation.error instanceof Error
        ? hideMessageMutation.error.message
        : '메시지를 숨기지 못했습니다. 다시 시도해 주세요.'
      : timeoutUserMutation.isError
        ? timeoutUserMutation.error instanceof Error
          ? timeoutUserMutation.error.message
          : '사용자를 채팅 제한하지 못했습니다. 다시 시도해 주세요.'
        : null;

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-primary">
          <Link className="admin-topbar-brand" href="/">
            StreamOps <strong>Elite</strong>
          </Link>
          <nav className="admin-desktop-nav" aria-label="운영자 메뉴">
            <a className="is-active" href="#dashboard">
              Dashboard
            </a>
            <a href="#ai-suggestion-control">Analytics</a>
            <a href="#orders-inventory-heading">Schedule</a>
          </nav>
        </div>
        <div className="admin-topbar-actions">
          <span className={`admin-on-air is-${snapshot.live.status.toLowerCase()}`}>
            <span aria-hidden="true" />
            {snapshot.live.status === 'LIVE' ? 'LIVE' : snapshot.live.status}
          </span>
          <span className="admin-live-duration">01:42:15</span>
          {connectionState === 'DISCONNECTED' || connectionState === 'FAILED' ? (
            <button
              className="admin-connection-retry"
              onClick={retryRealtimeConnection}
              type="button"
            >
              실시간 연결 다시 시도
            </button>
          ) : (
            <span className={`admin-connection-status is-${connectionState.toLowerCase()}`}>
              {connectionLabel(connectionState)}
            </span>
          )}
          <Link className="admin-home-link" href="/admin/lives">
            방송 목록
          </Link>
          <Link className="admin-home-link" href="/">
            홈으로
          </Link>
          <Link className="admin-viewer-link" href={`/live/${activeLiveId}`}>
            시청자 화면 보기 ↗
          </Link>
        </div>
      </header>

      <AdminSidebar
        featuredProductId={snapshot.featuredProduct?.id ?? null}
        isFeaturingProduct={featureMutation.isPending}
        liveId={activeLiveId}
        liveStatus={snapshot.live.status}
        onFeature={(productId) => featureMutation.mutate(productId)}
        products={snapshot.products}
      />

      <section className="admin-main">
        <div className="admin-dashboard-scroll" id="dashboard">
          <div className="admin-dashboard-grid">
            <div className="admin-left-column">
              <section className="admin-preview-card" id="broadcast-preview">
                <header>
                  <h2>◉ 송출 화면 미리보기</h2>
                  <Link href={`/live/${activeLiveId}`}>전체화면 ↗</Link>
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
                featuredProductId={snapshot.featuredProduct?.id ?? null}
                isPending={featureMutation.isPending}
                mutationStatus={featureMutationStatus}
                onFeature={(productId) => featureMutation.mutate(productId)}
                products={snapshot.products}
              />

              <AdminBroadcastControl
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

              <CouponPublishForm
                disabled={false}
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
                disabled={false}
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
                requiresAdminSession={false}
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
              liveId={activeLiveId}
              liveStatus={snapshot.live.status}
              lowestStockProduct={lowestStockProduct}
              moderationError={moderationError}
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
