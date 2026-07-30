'use client';

import { useQueryClient } from '@tanstack/react-query';
import { productFeaturedEventSchema, type LiveSnapshot } from '@liveflow/contracts';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { getSocketUrl, liveSnapshotQueryKey, mergeProductFeaturedEvent } from './live-api';

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

    const handleConnect = () => {
      setConnectionState(hasConnected ? 'RECOVERING' : 'CONNECTING');
      const lastEventSequence = queryClient.getQueryData<{ lastEventSequence: number }>(
        queryKey,
      )?.lastEventSequence;

      socket.emit(
        'live.join',
        { liveId, lastEventSequence: lastEventSequence ?? 0 },
        (result: { ok: boolean; lastEventSequence?: number }) => {
          if (!result.ok) {
            setConnectionState('FAILED');
            return;
          }

          hasConnected = true;
          setConnectionState('CONNECTED');
          void queryClient.invalidateQueries({ queryKey });
        },
      );
    };

    const handleLiveEvent = (input: unknown) => {
      const event = productFeaturedEventSchema.safeParse(input);
      if (!event.success || event.data.liveId !== liveId) {
        return;
      }

      queryClient.setQueryData<LiveSnapshot>(queryKey, (snapshot) =>
        mergeProductFeaturedEvent(snapshot, event.data),
      );
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
