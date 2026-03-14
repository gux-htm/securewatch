/**
 * Critical test suite — audit log protection.
 * Rule S2: Deletion must be permanently blocked and fire CRITICAL alert.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLogStore, initAuditLog } from '../audit-log.js';

// Mock the DB pool
const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
const mockPool = { query: mockQuery } as unknown as import('pg').Pool;

beforeEach(() => {
  mockQuery.mockClear();
  initAuditLog(mockPool, 'test-hmac-key-32-chars-minimum!!');
});

describe('AuditLogStore', () => {
  // Critical test 1 — must always pass, blocks deployment if it fails
  it('blocks audit log deletion and fires CRITICAL event', async () => {
    const store = new AuditLogStore();

    await expect(store.delete(undefined as never)).rejects.toThrow(
      'Audit log deletion is permanently prohibited'
    );

    // Verify a CRITICAL audit entry was written before throwing
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO audit_events'),
      expect.arrayContaining([
        expect.any(String), // log_id
        'system',           // tenant_id
        expect.any(String), // occurred_at
        expect.any(String), // ingested_at
        'SYSTEM',           // event_category
        'AUDIT_LOG_DELETE_ATTEMPTED', // event_type
      ])
    );
  });

  it('throws synchronously — no silent failure', async () => {
    const store = new AuditLogStore();
    let threw = false;
    try {
      await store.delete(undefined as never);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
