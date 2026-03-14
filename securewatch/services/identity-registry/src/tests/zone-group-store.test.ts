/**
 * ZoneStore and GroupStore tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZoneStore } from '../zone-store.js';
import { GroupStore } from '../group-store.js';
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

const sampleZone = { zone_id: 'z-1', tenant_id: 'ten-1', zone_name: 'internal', cidr: '10.0.0.0/8' };
const sampleGroup = { group_id: 'grp-1', tenant_id: 'ten-1', group_name: 'admins', created_by: 'admin-1', created_at: new Date().toISOString() };

describe('ZoneStore', () => {
  let cache: IdentityCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new IdentityCache(makeRedis());
  });

  it('fetches zones from DB on cache miss', async () => {
    const db = makeDb([sampleZone]);
    const store = new ZoneStore(db, cache, mockAudit);
    const zones = await store.list('ten-1');
    expect(zones).toHaveLength(1);
    expect(zones[0]?.zone_id).toBe('z-1');
  });

  it('returns cached zones without hitting DB', async () => {
    await cache.setZones('ten-1', [sampleZone]);
    const db = makeDb([]);
    const store = new ZoneStore(db, cache, mockAudit);
    const zones = await store.list('ten-1');
    expect(zones).toHaveLength(1);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('creates zone and invalidates cache', async () => {
    const redis = makeRedis();
    const c = new IdentityCache(redis);
    await c.setZones('ten-1', [sampleZone]);
    const db = makeDb([sampleZone]);
    const store = new ZoneStore(db, c, mockAudit);
    await store.create('ten-1', 'dmz', '192.168.0.0/16', 'admin-1');
    expect(redis.del).toHaveBeenCalledWith('zones:ten-1');
  });

  it('writes audit entry on create', async () => {
    const auditSpy: AuditWriter = vi.fn().mockResolvedValue(undefined);
    const store = new ZoneStore(makeDb([sampleZone]), cache, auditSpy);
    await store.create('ten-1', 'dmz', '192.168.0.0/16', 'admin-1');
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'NETWORK_ZONE_CREATED' }),
    );
  });

  it('deletes zone and invalidates cache', async () => {
    const redis = makeRedis();
    const c = new IdentityCache(redis);
    const store = new ZoneStore(makeDb([]), c, mockAudit);
    await store.delete('ten-1', 'z-1', 'admin-1');
    expect(redis.del).toHaveBeenCalledWith('zones:ten-1');
  });
});

describe('GroupStore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists groups for tenant', async () => {
    const db = makeDb([sampleGroup]);
    const store = new GroupStore(db, mockAudit);
    const groups = await store.list('ten-1');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.group_id).toBe('grp-1');
  });

  it('creates group with audit entry', async () => {
    const auditSpy: AuditWriter = vi.fn().mockResolvedValue(undefined);
    const db = makeDb([sampleGroup]);
    const store = new GroupStore(db, auditSpy);
    await store.create('ten-1', 'engineers', 'admin-1');
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'GROUP_CREATED' }),
    );
  });

  it('adds member with audit entry', async () => {
    const auditSpy: AuditWriter = vi.fn().mockResolvedValue(undefined);
    const store = new GroupStore(makeDb([]), auditSpy);
    await store.addMember('ten-1', 'grp-1', 'acc-1', 'admin-1');
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'GROUP_MEMBER_ADDED', account_id: 'acc-1' }),
    );
  });

  it('removes member with audit entry', async () => {
    const auditSpy: AuditWriter = vi.fn().mockResolvedValue(undefined);
    const store = new GroupStore(makeDb([]), auditSpy);
    await store.removeMember('ten-1', 'grp-1', 'acc-1', 'admin-1');
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'GROUP_MEMBER_REMOVED' }),
    );
  });

  it('deletes group with audit entry', async () => {
    const auditSpy: AuditWriter = vi.fn().mockResolvedValue(undefined);
    const store = new GroupStore(makeDb([]), auditSpy);
    await store.delete('ten-1', 'grp-1', 'admin-1');
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'GROUP_DELETED' }),
    );
  });

  it('gets members for group', async () => {
    const db = makeDb([{ account_id: 'acc-1' }, { account_id: 'acc-2' }]);
    const store = new GroupStore(db, mockAudit);
    const members = await store.getMembers('ten-1', 'grp-1');
    expect(members).toEqual(['acc-1', 'acc-2']);
  });
});
