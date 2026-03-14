import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit } from '../rate-limiter.js';
import type { Redis } from 'ioredis';

function makeRedis(count: number): Redis {
  return {
    incr:    vi.fn().mockResolvedValue(count),
    pexpire: vi.fn().mockResolvedValue(1),
  } as unknown as Redis;
}

describe('checkRateLimit', () => {
  it('allows requests within limit', async () => {
    const redis = makeRedis(100);
    const result = await checkRateLimit(redis, 'sys-1', 'AGENT');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9900); // 10000 - 100
  });

  it('blocks requests over limit', async () => {
    const redis = makeRedis(10001);
    const result = await checkRateLimit(redis, 'sys-1', 'AGENT');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('applies correct limit per source type', async () => {
    const redis = makeRedis(4999);
    const result = await checkRateLimit(redis, 'sys-2', 'LOG_PARSER');
    // LOG_PARSER limit is 2000 — 4999 > 2000 so blocked
    expect(result.allowed).toBe(false);
  });

  it('sets TTL on first request in window', async () => {
    const redis = makeRedis(1); // count === 1 means first request
    await checkRateLimit(redis, 'sys-3', 'SDK');
    expect((redis.pexpire as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });
});
