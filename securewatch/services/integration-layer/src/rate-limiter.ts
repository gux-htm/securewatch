/**
 * Per-source sliding-window rate limiter backed by Redis.
 * Limits per steering file 02 / TDD section 3.3.
 */

import type { Redis } from 'ioredis';
import { RATE_LIMITS } from '@securewatch/types';
import type { SourceType } from '@securewatch/types';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix ms
}

export async function checkRateLimit(
  redis: Redis,
  sourceId: string,
  sourceType: SourceType,
): Promise<RateLimitResult> {
  const limit = RATE_LIMITS[sourceType];
  const windowKey = Math.floor(Date.now() / limit.windowMs);
  const key = `ratelimit:${sourceId}:${windowKey}`;

  const current = await redis.incr(key);
  if (current === 1) {
    // First request in this window — set TTL
    await redis.pexpire(key, limit.windowMs * 2);
  }

  const resetAt = (windowKey + 1) * limit.windowMs;
  const remaining = Math.max(0, limit.requests - current);

  return {
    allowed:   current <= limit.requests,
    remaining,
    resetAt,
  };
}
