/**
 * AccountStore tests — CRUD, cache-aside, Rule S10 resource locking on revocation.
 * Critical test: tenant A cannot access tenant B data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountStore } from '../account-store.js';
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

const sampleAccount = {
  account_id: 'acc-1', tenant_id: 'ten-1', username: 'alice',
  email: 'alice@example.com', status: 'ACTIVE' as const,
  registered_at: new Date().toISOString(), failed_login_count: 0,
  created_by: 'admin-1', last_verified_at: null,
};

describe('AccountStore', () => {
  let db: Pool;
  let cache: IdentityCache;
  let store: AccountStore;

  beforeEach(() => {
    vi.clearAllMocks();
    db = makeDb([sampleAccount]);
    cache = new IdentityCache(makeRedis());
    store = new AccountStore(db, cache, mockAudit);
  });

  describe('getById', () => {
    it('fetches from DB on cache miss and caches result', async () => {
      const account = await store.getById('ten-1', 'acc-1');
      expect(account?.account_id).toBe('acc-1');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SET app.tenant_id'),
        ['ten-1'],
      );
    });

    it('returns null when account not found', async () => {
      db = makeDb([]);
      store = new AccountStore(db, cache, mockAudit);
      const result = await store.getById('ten-1', 'missing');
      expect(result).toBeNull();
    });

    it('returns cached account without hitting DB again', async () => {
      await store.getById('ten-1', 'acc-1'); // populates cache
      const callCount = (db.query as ReturnType<typeof vi.fn>).mock.calls.length;
      // Second call — cache hit, no new DB query
      const dbFresh = makeDb([sampleAccount]);
      const storeFresh = new AccountStore(dbFresh, cache, mockAudit);
      await storeFresh.getById('ten-1', 'acc-1');
      expect(dbFresh.query).not.toHaveBeenCalled();
      expect(callCount).toBeGreaterThan(0);
    });
  });

  describe('create', () => {
    it('writes audit entry before DB insert', async () => {
      const callOrder: string[] = [];
      const auditSpy: AuditWriter = vi.fn(async () => { callOrder.push('audit'); });
      const dbSpy = makeDb([sampleAccount]);
      (dbSpy.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT')) callOrder.push('db');
        return { rows: [sampleAccount], rowCount: 1 };
      });
      const s = new AccountStore(dbSpy, cache, auditSpy);
      await s.create({ tenant_id: 'ten-1', username: 'bob', email: 'bob@x.com', created_by: 'admin-1' });
      expect(callOrder[0]).toBe('audit');
      expect(callOrder[1]).toBe('db');
    });

    it('sets tenant context before insert', async () => {
      await store.create({ tenant_id: 'ten-1', username: 'bob', email: 'bob@x.com', created_by: 'admin-1' });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SET app.tenant_id'),
        ['ten-1'],
      );
    });
  });

  describe('updateStatus', () => {
    it('invalidates cache after status update', async () => {
      const redis = makeRedis();
      const c = new IdentityCache(redis);
      await c.setAccount(sampleAccount);
      const s = new AccountStore(db, c, mockAudit);
      await s.updateStatus('ten-1', 'acc-1', 'SUSPENDED', 'admin-1');
      expect(redis.del).toHaveBeenCalledWith('account:ten-1:acc-1');
    });

    // Critical test — Rule S10: revocation locks owned resources
    it('locks owned resources when account is REVOKED', async () => {
      const queries: string[] = [];
      const dbSpy = makeDb([]);
      (dbSpy.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
        queries.push(sql as string);
        return { rows: [], rowCount: 0 };
      });
      const s = new AccountStore(dbSpy, cache, mockAudit);
      await s.updateStatus('ten-1', 'acc-1', 'REVOKED', 'admin-1');
      const hasLockQuery = queries.some(q => q.includes('LOCKED') && q.includes('resources'));
      expect(hasLockQuery).toBe(true);
    });

    it('does NOT lock resources for SUSPENDED status', async () => {
      const queries: string[] = [];
      const dbSpy = makeDb([]);
      (dbSpy.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
        queries.push(sql as string);
        return { rows: [], rowCount: 0 };
      });
      const s = new AccountStore(dbSpy, cache, mockAudit);
      await s.updateStatus('ten-1', 'acc-1', 'SUSPENDED', 'admin-1');
      const hasLockQuery = queries.some(q => q.includes('LOCKED') && q.includes('resources'));
      expect(hasLockQuery).toBe(false);
    });
  });

  describe('list', () => {
    it('sets tenant context and returns paginated results', async () => {
      const dbMulti = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 })   // SET app.tenant_id
          .mockResolvedValueOnce({ rows: [sampleAccount], rowCount: 1 })
          .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 }),
      } as unknown as Pool;
      const s = new AccountStore(dbMulti, cache, mockAudit);
      const result = await s.list('ten-1', 1, 20);
      expect(result.rows).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
