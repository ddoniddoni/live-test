'use client';

import { useQueryClient } from '@tanstack/react-query';
import { realtimeEventSchema, type ChatMessagePage, type LiveSnapshot } from '@liveflow/contracts';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  fetchChatMessages,
  getSocketUrl,
  liveSnapshotQueryKey,
  mergeChatMessage,
  mergeChatMessagePage,
  mergeProductFeaturedEvent,
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

      if (liveEvent.type === 'product.featured') {
        queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
          mergeProductFeaturedEvent(snapshot, liveEvent),
        );
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
