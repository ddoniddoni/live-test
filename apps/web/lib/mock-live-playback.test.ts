import { describe, expect, it } from 'vitest';

import {
  MOCK_LIVE_DURATION_SECONDS,
  formatMockLivePlaybackTime,
  getMockLivePlaybackState,
} from './mock-live-playback.js';

describe('getMockLivePlaybackState', () => {
  it('calculates the mock live position from startedAt while a live is running', () => {
    const state = getMockLivePlaybackState({
      endedAt: null,
      now: Date.parse('2026-08-02T00:01:05.000Z'),
      startedAt: '2026-08-02T00:00:00.000Z',
      status: 'LIVE',
    });

    expect(state).toEqual({ positionSeconds: 65, shouldTick: true });
  });

  it('loops the mock playback position and freezes it when a live ends', () => {
    const state = getMockLivePlaybackState({
      endedAt: '2026-08-02T00:30:05.000Z',
      now: Date.parse('2026-08-02T03:00:00.000Z'),
      startedAt: '2026-08-02T00:00:00.000Z',
      status: 'ENDED',
    });

    expect(state).toEqual({ positionSeconds: 5, shouldTick: false });
  });

  it('does not start playback before a broadcast starts', () => {
    const state = getMockLivePlaybackState({
      endedAt: null,
      now: Date.parse('2026-08-02T00:00:00.000Z'),
      startedAt: null,
      status: 'READY',
    });

    expect(state).toEqual({ positionSeconds: 0, shouldTick: false });
    expect(formatMockLivePlaybackTime(MOCK_LIVE_DURATION_SECONDS)).toBe('30:00');
  });
});
