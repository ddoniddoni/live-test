import type { LiveSession } from '@liveflow/contracts';

export const MOCK_LIVE_DURATION_SECONDS = 30 * 60;

type MockLivePlaybackInput = Pick<LiveSession, 'endedAt' | 'startedAt' | 'status'> & {
  now: number;
};

export type MockLivePlaybackState = {
  positionSeconds: number;
  shouldTick: boolean;
};

export function getMockLivePlaybackState({
  endedAt,
  now,
  startedAt,
  status,
}: MockLivePlaybackInput): MockLivePlaybackState {
  if (status === 'READY' || !startedAt) {
    return { positionSeconds: 0, shouldTick: false };
  }

  const startedAtTime = Date.parse(startedAt);
  const endedAtTime = endedAt ? Date.parse(endedAt) : Number.NaN;

  if (!Number.isFinite(startedAtTime)) {
    return { positionSeconds: 0, shouldTick: false };
  }

  const playbackEndTime = status === 'ENDED' && Number.isFinite(endedAtTime) ? endedAtTime : now;
  const elapsedSeconds = Math.max(0, Math.floor((playbackEndTime - startedAtTime) / 1_000));

  return {
    positionSeconds: elapsedSeconds % MOCK_LIVE_DURATION_SECONDS,
    shouldTick: status === 'LIVE',
  };
}

export function formatMockLivePlaybackTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainderSeconds = safeSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${remainderSeconds.toString().padStart(2, '0')}`;
}
