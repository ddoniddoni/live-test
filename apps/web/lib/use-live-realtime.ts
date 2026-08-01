'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  realtimeEventSchema,
  type ChatAccessStatus,
  type ChatMessagePage,
  type InventoryLowEvent,
  type LiveSnapshot,
} from '@liveflow/contracts';
import { io } from 'socket.io-client';

import {
  aiSuggestionsQueryKey,
  chatAccessQueryKey,
  fetchChatMessages,
  getSocketUrl,
  inventoryLowAlertsQueryKey,
  liveSnapshotQueryKey,
  mergeAnnouncementPublishedEvent,
  mergeChatMessage,
  mergeChatMessageHiddenEvent,
  mergeChatMessagePage,
  mergeCouponPublishedEvent,
  mergeCouponRedeemedEvent,
  mergeInventoryUpdatedEvent,
  mergeLiveStatusChangedEvent,
  mergeProductFeaturedEvent,
  recentOrdersQueryKey,
} from './live-api';

export type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'RECOVERING' | 'DISCONNECTED' | 'FAILED';

export function useLiveRealtime(liveId: string, accessToken: string | null): ConnectionState {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');

  useEffect(() => {
    if (!accessToken) {
      return undefined;
    }

    let hasConnected = false;
    const queryKey = liveSnapshotQueryKey(liveId);
    const socket = io(getSocketUrl(), {
      auth: { token: accessToken },
      autoConnect: false,
    });

    const fetchRecoveryPages = async (afterSequence: number): Promise<ChatMessagePage[]> => {
      const pages: ChatMessagePage[] = [];
      let cursor = afterSequence;
      let hasMore = true;

      while (hasMore) {
        const page = await fetchChatMessages(liveId, { afterSequence: cursor, limit: 200 });
        pages.push(page);
        const lastMessage = page.messages.at(-1);

        if (!page.hasMore || !lastMessage || lastMessage.sequence <= cursor) {
          return pages;
        }

        cursor = lastMessage.sequence;
        hasMore = page.hasMore;
      }

      return pages;
    };

    const handleConnect = () => {
      setConnectionState(hasConnected ? 'RECOVERING' : 'CONNECTING');
      const snapshot = queryClient.getQueryData<LiveSnapshot>(queryKey);
      const lastEventSequence = snapshot?.lastEventSequence ?? 0;
      const lastMessageSequence = snapshot?.chat.lastMessageSequence ?? 0;

      socket.emit(
        'live.join',
        { liveId, lastEventSequence },
        (result: { ok: boolean; lastEventSequence?: number }) => {
          if (!result.ok) {
            setConnectionState('FAILED');
            return;
          }

          hasConnected = true;
          setConnectionState('RECOVERING');
          void Promise.all([
            queryClient.invalidateQueries({ queryKey }),
            fetchRecoveryPages(lastMessageSequence),
            queryClient.invalidateQueries({ queryKey: chatAccessQueryKey(liveId) }),
          ])
            .then(([, pages]) => {
              queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
                pages.reduce(
                  (mergedSnapshot, page) => mergeChatMessagePage(mergedSnapshot, page),
                  currentSnapshot,
                ),
              );
              setConnectionState('CONNECTED');
            })
            .catch(() => {
              setConnectionState('FAILED');
            });
        },
      );
    };

    const handleLiveEvent = (input: unknown) => {
      const event = realtimeEventSchema.safeParse(input);
      if (!event.success || event.data.liveId !== liveId) {
        return;
      }

      const liveEvent = event.data;

      if (liveEvent.type === 'live.status.changed') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          mergeLiveStatusChangedEvent(snapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'product.featured') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          mergeProductFeaturedEvent(snapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'coupon.published') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          mergeCouponPublishedEvent(snapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'coupon.redeemed') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          mergeCouponRedeemedEvent(snapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'announcement.published') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          mergeAnnouncementPublishedEvent(snapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'ai.suggestion.created') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          !snapshot || liveEvent.sequence <= snapshot.lastEventSequence
            ? snapshot
            : { ...snapshot, lastEventSequence: liveEvent.sequence },
        );
        void queryClient.invalidateQueries({ queryKey: aiSuggestionsQueryKey(liveId) });
        return;
      }

      if (liveEvent.type === 'inventory.updated') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          mergeInventoryUpdatedEvent(snapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'order.status.changed') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          !snapshot || liveEvent.sequence <= snapshot.lastEventSequence
            ? snapshot
            : { ...snapshot, lastEventSequence: liveEvent.sequence },
        );
        return;
      }

      if (liveEvent.type === 'order.created') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          !snapshot || liveEvent.sequence <= snapshot.lastEventSequence
            ? snapshot
            : { ...snapshot, lastEventSequence: liveEvent.sequence },
        );
        void queryClient.invalidateQueries({ queryKey: recentOrdersQueryKey(liveId) });
        return;
      }

      if (liveEvent.type === 'inventory.low') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          !snapshot || liveEvent.sequence <= snapshot.lastEventSequence
            ? snapshot
            : { ...snapshot, lastEventSequence: liveEvent.sequence },
        );
        queryClient.setQueryData<InventoryLowEvent[]>(
          inventoryLowAlertsQueryKey(liveId),
          (alerts = []) =>
            alerts.some((alert) => alert.eventId === liveEvent.eventId)
              ? alerts
              : [liveEvent, ...alerts].slice(0, 3),
        );
        return;
      }

      if (liveEvent.type === 'chat.message.hidden') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          mergeChatMessageHiddenEvent(snapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'chat.user.timed_out') {
        queryClient.setQueryData<ChatAccessStatus>(chatAccessQueryKey(liveId), {
          timeoutExpiresAt: liveEvent.payload.expiresAt,
        });
        return;
      }

      const message = liveEvent.payload.message;
      const eventSequence = liveEvent.sequence;

      queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) => {
        if (!snapshot || eventSequence <= snapshot.lastEventSequence) {
          return snapshot;
        }

        const mergedSnapshot = mergeChatMessage(snapshot, message);
        return mergedSnapshot
          ? { ...mergedSnapshot, lastEventSequence: eventSequence }
          : mergedSnapshot;
      });
    };

    const handleDisconnect = () => {
      setConnectionState('DISCONNECTED');
    };

    const handleConnectError = () => {
      setConnectionState(hasConnected ? 'RECOVERING' : 'FAILED');
    };

    socket.on('connect', handleConnect);
    socket.on('live.event', handleLiveEvent);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('live.event', handleLiveEvent);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.close();
    };
  }, [accessToken, liveId, queryClient]);

  return accessToken ? connectionState : 'CONNECTING';
}
