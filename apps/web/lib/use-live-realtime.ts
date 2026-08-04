'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  realtimeEventSchema,
  type ChatAccessStatus,
  type ChatMessagePage,
  type InventoryLowEvent,
  type LiveSnapshot,
  type RealtimeEvent,
} from '@liveflow/contracts';
import { io } from 'socket.io-client';

import {
  aiSuggestionsQueryKey,
  chatAccessQueryKey,
  fetchChatMessages,
  fetchLiveSnapshot,
  getSocketUrl,
  hasRealtimeSequenceGap,
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

export type LiveRealtimeConnection = {
  connectionState: ConnectionState;
  retry: () => void;
};

function advanceEventSequence(
  snapshot: LiveSnapshot | undefined,
  incomingSequence: number,
): LiveSnapshot | undefined {
  if (!snapshot || incomingSequence <= snapshot.lastEventSequence) {
    return snapshot;
  }

  return { ...snapshot, lastEventSequence: incomingSequence };
}

export function useLiveRealtime(
  liveId: string,
  accessToken: string | null,
): LiveRealtimeConnection {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retry = useCallback(() => {
    setConnectionState('CONNECTING');
    setRetryAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  useEffect(() => {
    if (!accessToken) {
      return undefined;
    }

    let hasConnected = false;
    let isActive = true;
    let isSynchronizing = false;
    let queuedEvents: RealtimeEvent[] = [];
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

    const processLiveEvent = (liveEvent: RealtimeEvent): void => {
      if (!isActive) {
        return;
      }

      if (isSynchronizing) {
        queuedEvents.push(liveEvent);
        return;
      }

      const snapshot = queryClient.getQueryData<LiveSnapshot>(queryKey);
      if (!snapshot || hasRealtimeSequenceGap(snapshot, liveEvent.sequence)) {
        void synchronizeState(snapshot?.chat.lastMessageSequence ?? 0);
        return;
      }

      if (liveEvent.sequence <= snapshot.lastEventSequence) {
        return;
      }

      if (liveEvent.type === 'live.status.changed') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          mergeLiveStatusChangedEvent(currentSnapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'product.featured') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          mergeProductFeaturedEvent(currentSnapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'coupon.published') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          mergeCouponPublishedEvent(currentSnapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'coupon.redeemed') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          mergeCouponRedeemedEvent(currentSnapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'announcement.published') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          mergeAnnouncementPublishedEvent(currentSnapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'ai.suggestion.created') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          advanceEventSequence(currentSnapshot, liveEvent.sequence),
        );
        void queryClient.invalidateQueries({ queryKey: aiSuggestionsQueryKey(liveId) });
        return;
      }

      if (liveEvent.type === 'inventory.updated') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          mergeInventoryUpdatedEvent(currentSnapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'order.status.changed') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          advanceEventSequence(currentSnapshot, liveEvent.sequence),
        );
        return;
      }

      if (liveEvent.type === 'order.created') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          advanceEventSequence(currentSnapshot, liveEvent.sequence),
        );
        void queryClient.invalidateQueries({ queryKey: recentOrdersQueryKey(liveId) });
        return;
      }

      if (liveEvent.type === 'inventory.low') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          advanceEventSequence(currentSnapshot, liveEvent.sequence),
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
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          mergeChatMessageHiddenEvent(currentSnapshot, liveEvent),
        );
        return;
      }

      if (liveEvent.type === 'chat.user.timed_out') {
        queryClient.setQueryData<ChatAccessStatus>(chatAccessQueryKey(liveId), {
          timeoutExpiresAt: liveEvent.payload.expiresAt,
        });
        queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) =>
          advanceEventSequence(currentSnapshot, liveEvent.sequence),
        );
        return;
      }

      queryClient.setQueryData<LiveSnapshot>(queryKey, (currentSnapshot) => {
        const mergedSnapshot = mergeChatMessage(currentSnapshot, liveEvent.payload.message);
        return mergedSnapshot
          ? { ...mergedSnapshot, lastEventSequence: liveEvent.sequence }
          : mergedSnapshot;
      });
    };

    const synchronizeState = async (afterMessageSequence: number): Promise<void> => {
      if (isSynchronizing) {
        return;
      }

      isSynchronizing = true;
      setConnectionState('RECOVERING');

      try {
        const [snapshot, pages] = await Promise.all([
          fetchLiveSnapshot(liveId),
          fetchRecoveryPages(afterMessageSequence),
        ]);
        if (!isActive) {
          return;
        }

        const recoveredSnapshot = pages.reduce<LiveSnapshot>(
          (currentSnapshot, page) => mergeChatMessagePage(currentSnapshot, page) ?? currentSnapshot,
          snapshot,
        );
        queryClient.setQueryData(queryKey, recoveredSnapshot);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: aiSuggestionsQueryKey(liveId) }),
          queryClient.invalidateQueries({ queryKey: chatAccessQueryKey(liveId) }),
          queryClient.invalidateQueries({ queryKey: recentOrdersQueryKey(liveId) }),
        ]);

        const eventsToProcess = queuedEvents.toSorted(
          (left, right) => left.sequence - right.sequence,
        );
        queuedEvents = [];
        isSynchronizing = false;
        for (const queuedEvent of eventsToProcess) {
          processLiveEvent(queuedEvent);
        }

        if (!isSynchronizing) {
          setConnectionState('CONNECTED');
        }
      } catch {
        if (isActive) {
          setConnectionState('FAILED');
        }
      } finally {
        isSynchronizing = false;
      }
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
          void synchronizeState(lastMessageSequence);
        },
      );
    };

    const handleLiveEvent = (input: unknown) => {
      const event = realtimeEventSchema.safeParse(input);
      if (!event.success || event.data.liveId !== liveId) {
        return;
      }

      processLiveEvent(event.data);
    };

    const handleDisconnect = () => {
      setConnectionState('DISCONNECTED');
    };

    const handleConnectError = () => {
      setConnectionState('FAILED');
    };

    socket.on('connect', handleConnect);
    socket.on('live.event', handleLiveEvent);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    socket.connect();

    return () => {
      isActive = false;
      socket.off('connect', handleConnect);
      socket.off('live.event', handleLiveEvent);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.close();
    };
  }, [accessToken, liveId, queryClient, retryAttempt]);

  return {
    connectionState: accessToken ? connectionState : 'CONNECTING',
    retry,
  };
}
