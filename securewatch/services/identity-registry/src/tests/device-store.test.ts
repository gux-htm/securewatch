/**
 * DeviceStore tests — CRUD, cache invalidation, blacklist.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceStore } from '../device-store.js';
import { IdentityCache } from '../identity-cache.js';
import type { Pool, QueryResult } from 'pg';
import type { Redis } from 'ioredis';
import type { AuditWriter } from '../types.js';

function makeDb(rows: unknown[] = []): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length } as QueryResult),
  } as unknown as Pool;
}

function makeRedis(): Redis {
  const store = new Map<string, string>();
  return {
    get:    vi.fn(async (k: string) => store.get(k) ?? null),
    setex:  vi.fn(async (k: string, _ttl: number, v: string) => { store.set(k, v); return 'OK'; }),
    del:    vi.fn(async (k: string) => { store.delete(k); return 1; }),
  } as unknown as Redis;
}

const mockAudit: AuditWriter = vi.fn().mockResolvedValue(undefined);

const sampleDevice = {
  device_id: 'dev-1', tenant_id: 'ten-1', fingerprint: 'fp-abc',
  mac_address: 'aa:bb:cc:dd:ee:ff', hostname: 'host1',
  network_zone_id: null, status: 'REGISTERED' as const, blacklist_reason: null,
};

describe('DeviceStore', () => {
  let db: Pool;
  let cache: IdentityCache;
  let store: DeviceStore;

  beforeEach(() => {
    vi.clearAllMocks();
    db = makeDb([sampleDevice]);
    cache = new IdentityCache(makeRedis());
    store = new DeviceStore(db, cache, mockAudit);
  });

  describe('getById', () => {
    it('fetches from DB on cache miss', async () => {
      const device = await store.getById('ten-1', 'dev-1');
      expect(device?.device_id).toBe('dev-1');
    });

    it('returns null when device not found', async () => {
      store = new DeviceStore(makeDb([]), cache, mockAudit);
      expect(await store.getById('ten-1', 'missing')).toBeNull();
    });
  });

  describe('create', () => {
    it('writes audit entry before insert', async () => {
      const order: string[] = [];
      const auditSpy: AuditWriter = vi.fn(async () => { order.push('audit'); });
      const dbSpy = makeDb([sampleDevice]);
      (dbSpy.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
        if ((sql as string).includes('INSERT')) order.push('db');
        return { rows: [sampleDevice], rowCount: 1 };
      });
      const s = new DeviceStore(dbSpy, cache, auditSpy);
      await s.create({ tenant_id: 'ten-1', fingerprint: 'fp', mac_address: 'aa:bb', registered_by: 'admin-1' });
      expect(order[0]).toBe('audit');
    });
  });

  describe('updateStatus', () => {
    it('invalidates cache after status change', async () => {
      const redis = makeRedis();
      const c = new IdentityCache(redis);
      await c.setDevice(sampleDevice);
      const s = new DeviceStore(db, c, mockAudit);
      await s.updateStatus('ten-1', 'dev-1', 'BLACKLISTED', 'admin-1', 'Malware detected');
      expect(redis.del).toHaveBeenCalledWith('device:ten-1:dev-1');
    });

    it('passes blacklist reason to DB', async () => {
      await store.updateStatus('ten-1', 'dev-1', 'BLACKLISTED', 'admin-1', 'Compromised');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE devices'),
        expect.arrayContaining(['BLACKLISTED', 'Compromised']),
      );
    });

    it('fires HIGH severity audit for blacklist', async () => {
      const auditSpy: AuditWriter = vi.fn().mockResolvedValue(undefined);
      const s = new DeviceStore(db, cache, auditSpy);
      await s.updateStatus('ten-1', 'dev-1', 'BLACKLISTED', 'admin-1');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'HIGH' }),
      );
    });

    it('fires LOW severity audit for REGISTERED status', async () => {
      const auditSpy: AuditWriter = vi.fn().mockResolvedValue(undefined);
      const s = new DeviceStore(db, cache, auditSpy);
      await s.updateStatus('ten-1', 'dev-1', 'REGISTERED', 'admin-1');
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'LOW' }),
      );
    });
  });

  describe('create with optional fields', () => {
    it('creates device with hostname and zone', async () => {
      const db2 = makeDb([{ ...sampleDevice, hostname: 'myhost', network_zone_id: 'z-1' }]);
      const s = new DeviceStore(db2, cache, mockAudit);
      const result = await s.create({
        tenant_id: 'ten-1', fingerprint: 'fp', mac_address: 'aa:bb',
        registered_by: 'admin-1', hostname: 'myhost', network_zone_id: 'z-1',
      });
      expect(result.hostname).toBe('myhost');
    });
  });
});
