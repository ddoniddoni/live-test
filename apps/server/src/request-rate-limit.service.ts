import { Injectable } from '@nestjs/common';

import { ApiException } from './api-exception.filter.js';

@Injectable()
export class RequestRateLimitService {
  private readonly attemptsByKey = new Map<string, number[]>();

  consume(input: { key: string; limit: number; windowMs: number }): void {
    const now = Date.now();
    const windowStart = now - input.windowMs;
    const recentAttempts = (this.attemptsByKey.get(input.key) ?? []).filter(
      (attemptedAt) => attemptedAt > windowStart,
    );

    if (recentAttempts.length >= input.limit) {
      throw new ApiException(429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요.');
    }

    recentAttempts.push(now);
    this.attemptsByKey.set(input.key, recentAttempts);
  }
}
