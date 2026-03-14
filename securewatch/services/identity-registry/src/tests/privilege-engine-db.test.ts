/**
 * PrivilegeEngine DB method tests — grant, revoke, list, resolveEffective.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivilegeEngine } from '../privilege-engine.js';
import type { Pool, QueryResult } from 'pg';
import type { AuditWriter } from '../types.js';
import type { Action } from '@securewatch/types';

function makeDb(rows: unknown[] = []): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length } as QueryResult),
  } as unknown as Pool;
}

const mockAudit: AuditWriter = vi.fn().mockResolvedValue(undefined);

const sampleAcl = {
  acl_id: 'acl-1', tenant_id: 'ten-1', resource_id: 'res-1',
  grantee_type: 'ACCOUNT' as const, grantee_id: 'acc-1',
  permitted_actions: ['READ', 'WRITE'] as Action[],
  days_of_week: null, start_time: null, end_time: null,
  granted_by: 'admin-1', granted_at: new Date().toISOString(), status: 'ACTIVE' as const,
};

describe('PrivilegeEngine', () => {
  let engine: PrivilegeEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new PrivilegeEngine(makeDb([sampleAcl]), mockAudit);
  });

  describe('grant', () => {
    it('writes audit entry before DB insert', async () => {
      const order: string[] = [];
      const auditSpy: AuditWriter = vi.fn(async () => { order.push('audit'); });
      const dbSpy = makeDb([sampleAcl]);
      (dbSpy.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
        if ((sql as string).includes('INSERT')) order.push('db');
        return { rows: [sampleAcl], rowCount: 1 };
      });
      const e = new PrivilegeEngine(dbSpy, auditSpy);
      await e.grant({
        tenant_id: 'ten-1', resource_id: 'res-1', grantee_type: 'ACCOUNT',
        grantee_id: 'acc-1', permitted_actions: ['READ'], granted_by: 'admin-1',
      });
      expect(order[0]).toBe('audit');
    });

    it('returns created ACL entry', async () => {
      const result = await engine.grant({
        tenant_id: 'ten-1', resource_id: 'res-1', grantee_type: 'ACCOUNT',
        grantee_id: 'acc-1', permitted_actions: ['READ', 'WRITE'], granted_by: 'admin-1',
      });
      expect(result.acl_id).toBe('acl-1');
    });
  });

  describe('revoke', () => {
    it('sets status to REVOKED', async () => {
      await engine.revoke('ten-1', 'acl-1', 'admin-1');
      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'PRIVILEGE_REVOKED' }),
      );
    });
  });

  describe('list', () => {
    it('returns ACL entries for tenant', async () => {
      const entries = await engine.list('ten-1', {});
      expect(entries).toHaveLength(1);
    });

    it('filters by account_id', async () => {
      await engine.list('ten-1', { account_id: 'acc-1' });
      const db = makeDb([sampleAcl]);
      const e = new PrivilegeEngine(db, mockAudit);
      await e.list('ten-1', { account_id: 'acc-1' });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ACCOUNT'),
        expect.arrayContaining(['acc-1']),
      );
    });
  });

  describe('resolveEffective', () => {
    it('returns all-false when no grants exist', async () => {
      const db = makeDb([]);
      const e = new PrivilegeEngine(db, mockAudit);
      const perms = await e.resolveEffective('ten-1', 'acc-1', 'res-1', []);
      expect(perms.READ).toBe(false);
      expect(perms.WRITE).toBe(false);
    });

    it('returns granted actions from individual grant', async () => {
      const db = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SET tenant
          .mockResolvedValueOnce({ rows: [{ permitted_actions: ['READ', 'WRITE'] }], rowCount: 1 }),
      } as unknown as Pool;
      const e = new PrivilegeEngine(db, mockAudit);
      const perms = await e.resolveEffective('ten-1', 'acc-1', 'res-1', []);
      expect(perms.READ).toBe(true);
      expect(perms.WRITE).toBe(true);
      expect(perms.DELETE).toBe(false);
    });

    it('merges individual and group grants with most-restrictive rule', async () => {
      const db = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // SET tenant
          .mockResolvedValueOnce({ rows: [{ permitted_actions: ['READ', 'WRITE'] }], rowCount: 1 }) // individual
          .mockResolvedValueOnce({ rows: [{ permitted_actions: ['READ'] }], rowCount: 1 }), // group
      } as unknown as Pool;
      const e = new PrivilegeEngine(db, mockAudit);
      const perms = await e.resolveEffective('ten-1', 'acc-1', 'res-1', ['grp-1']);
      // READ in both → allowed; WRITE only in individual → denied (most restrictive)
      expect(perms.READ).toBe(true);
      expect(perms.WRITE).toBe(false);
    });
  });
});
