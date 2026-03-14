/**
 * IdentityCache tests — TTL, cache-aside, invalidation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdentityCache } from '../identity-cache.js';
import type { CachedAccount, CachedDevice, CachedZone } from '../identity-cache.js';
import type { Redis } from 'ioredis';

function makeRedis(): Redis {
  const store = new Map<string, string>();
  return {
    get:    vi.fn(async (k: string) => store.get(k) ?? null),
    setex:  vi.fn(async (k: string, _ttl: number, v: string) => { store.set(k, v); return 'OK'; }),
    del:    vi.fn(async (k: string) => { store.delete(k); return 1; }),
  } as unknown as Redis;
}

const account: CachedAccount = {
  account_id: 'acc-1', tenant_id: 'ten-1', username: 'alice',
  email: 'alice@example.com', status: 'ACTIVE',
  registered_at: new Date().toISOString(), failed_login_count: 0,
};

const device: CachedDevice = {
  device_id: 'dev-1', tenant_id: 'ten-1', fingerprint: 'fp-abc',
  mac_address: 'aa:bb:cc:dd:ee:ff', hostname: 'host1',
  network_zone_id: null, status: 'REGISTERED', blacklist_reason: null,
};

const zones: CachedZone[] = [
  { zone_id: 'z-1', tenant_id: 'ten-1', zone_name: 'internal', cidr: '10.0.0.0/8' },
];

describe('IdentityCache', () => {
  let redis: Redis;
  let cache: IdentityCache;

  beforeEach(() => {
    redis = makeRedis();
    cache = new IdentityCache(redis);
  });

  describe('accounts', () => {
    it('returns null on cache miss', async () => {
      expect(await cache.getAccount('ten-1', 'acc-1')).toBeNull();
    });

    it('stores and retrieves account', async () => {
      await cache.setAccount(account);
      const result = await cache.getAccount('ten-1', 'acc-1');
      expect(result?.account_id).toBe('acc-1');
      expect(result?.status).toBe('ACTIVE');
    });

    it('invalidates account on status change', async () => {
      await cache.setAccount(account);
      await cache.invalidateAccount('ten-1', 'acc-1');
      expect(await cache.getAccount('ten-1', 'acc-1')).toBeNull();
    });

    it('uses correct Redis key format', async () => {
      await cache.setAccount(account);
      expect(redis.setex).toHaveBeenCalledWith(
        'account:ten-1:acc-1', 60, expect.any(String),
      );
    });
  });

  describe('devices', () => {
    it('returns null on cache miss', async () => {
      expect(await cache.getDevice('ten-1', 'dev-1')).toBeNull();
    });

    it('stores and retrieves device', async () => {
      await cache.setDevice(device);
      const result = await cache.getDevice('ten-1', 'dev-1');
      expect(result?.device_id).toBe('dev-1');
    });

    it('invalidates device cache', async () => {
      await cache.setDevice(device);
      await cache.invalidateDevice('ten-1', 'dev-1');
      expect(await cache.getDevice('ten-1', 'dev-1')).toBeNull();
    });

    it('uses 60s TTL for devices', async () => {
      await cache.setDevice(device);
      expect(redis.setex).toHaveBeenCalledWith(
        'device:ten-1:dev-1', 60, expect.any(String),
      );
    });
  });

  describe('zones', () => {
    it('returns null on cache miss', async () => {
      expect(await cache.getZones('ten-1')).toBeNull();
    });

    it('stores and retrieves zones', async () => {
      await cache.setZones('ten-1', zones);
      const result = await cache.getZones('ten-1');
      expect(result).toHaveLength(1);
      expect(result?.[0]?.zone_id).toBe('z-1');
    });

    it('uses 300s TTL for zones', async () => {
      await cache.setZones('ten-1', zones);
      expect(redis.setex).toHaveBeenCalledWith('zones:ten-1', 300, expect.any(String));
    });

    it('invalidates zone cache', async () => {
      await cache.setZones('ten-1', zones);
      await cache.invalidateZones('ten-1');
      expect(await cache.getZones('ten-1')).toBeNull();
    });
  });
});
