'use client';

import { useEffect, useState } from 'react';
import type { LiveSession } from '@liveflow/contracts';

import {
  MOCK_LIVE_DURATION_SECONDS,
  formatMockLivePlaybackTime,
  getMockLivePlaybackState,
} from '@/lib/mock-live-playback';

export function MockLivePlayback({ live }: { live: LiveSession }) {
  const [now, setNow] = useState(0);
  const playback = getMockLivePlaybackState({ ...live, now });
  const playbackPosition = formatMockLivePlaybackTime(playback.positionSeconds);

  useEffect(() => {
    if (!playback.shouldTick) {
      return undefined;
    }

    const tick = () => setNow(Date.now());
    const initialTickTimeoutId = window.setTimeout(tick, 0);
    const intervalId = window.setInterval(() => {
      tick();
    }, 1_000);

    return () => {
      window.clearTimeout(initialTickTimeoutId);
      window.clearInterval(intervalId);
    };
  }, [live.endedAt, live.startedAt, playback.shouldTick]);

  return (
    <div className={`mock-live-playback is-${live.status.toLowerCase()}`}>
      <div>
        <span>{live.status === 'LIVE' ? 'MOCK LIVE' : live.status}</span>
        <time>{playbackPosition}</time>
      </div>
      <progress
        aria-label={`Mock live 재생 위치 ${playbackPosition}`}
        max={MOCK_LIVE_DURATION_SECONDS}
        value={playback.positionSeconds}
      />
    </div>
  );
}
