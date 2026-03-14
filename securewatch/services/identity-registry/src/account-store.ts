/**
 * AccountStore — CRUD for accounts with cache-aside pattern.
 * Every mutation writes audit log entry before DB change (steering 03).
 * Rule S10: account revocation locks all owned resources atomically.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { AccountStatus } from '@securewatch/types';
import type { IdentityCache, CachedAccount } from './identity-cache.js';
import type { AuditWriter } from './types.js';

export interface Account extends CachedAccount {
  created_by:      string;
  last_verified_at: string | null;
}

export interface CreateAccountInput {
  tenant_id:  string;
  username:   string;
  email:      string;
  created_by: string;
}

export class AccountStore {
  constructor(
    private readonly db: Pool,
    private readonly cache: IdentityCache,
    private readonly audit: AuditWriter,
  ) {}

  async getById(tenantId: string, accountId: string): Promise<Account | null> {
    // Cache-aside
    const cached = await this.cache.getAccount(tenantId, accountId);
    if (cached) return cached as Account;

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const res = await this.db.query<Account>(
      `SELECT account_id, tenant_id, username, email, status,
              registered_at, created_by, last_verified_at, failed_login_count
       FROM accounts WHERE account_id = $1 AND tenant_id = $2`,
      [accountId, tenantId],
    );
    const account = res.rows[0] ?? null;
    if (account) await this.cache.setAccount(account);
    return account;
  }

  async list(tenantId: string, page: number, limit: number): Promise<{ rows: Account[]; total: number }> {
    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const offset = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      this.db.query<Account>(
        `SELECT account_id, tenant_id, username, email, status,
                registered_at, created_by, last_verified_at, failed_login_count
         FROM accounts WHERE tenant_id = $1
         ORDER BY registered_at DESC LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset],
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM accounts WHERE tenant_id = $1`,
        [tenantId],
      ),
    ]);
    return { rows: rows.rows, total: parseInt(count.rows[0]?.count ?? '0', 10) };
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const accountId = randomUUID();
    await this.audit({
      tenant_id:      input.tenant_id,
      event_category: 'SYSTEM',
      event_type:     'ACCOUNT_CREATED',
      account_id:     accountId,
      outcome:        'ALLOWED',
      source_system:  input.created_by,
    });

    await this.db.query(`SET app.tenant_id = $1`, [input.tenant_id]);
    const res = await this.db.query<Account>(
      `INSERT INTO accounts (account_id, tenant_id, username, email, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING account_id, tenant_id, username, email, status,
                 registered_at, created_by, last_verified_at, failed_login_count`,
      [accountId, input.tenant_id, input.username, input.email, input.created_by],
    );
    const account = res.rows[0];
    if (!account) throw new Error('Account insert returned no row');
    await this.cache.setAccount(account);
    return account;
  }

  async updateStatus(
    tenantId: string,
    accountId: string,
    status: AccountStatus,
    adminId: string,
  ): Promise<void> {
    await this.audit({
      tenant_id:      tenantId,
      event_category: 'SYSTEM',
      event_type:     `ACCOUNT_STATUS_CHANGED_${status}`,
      account_id:     accountId,
      outcome:        'ALLOWED',
      source_system:  adminId,
    });

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    await this.db.query(
      `UPDATE accounts SET status = $1 WHERE account_id = $2 AND tenant_id = $3`,
      [status, accountId, tenantId],
    );
    await this.cache.invalidateAccount(tenantId, accountId);

    // Rule S10: revocation locks all owned resources atomically
    if (status === 'REVOKED') {
      await this.db.query(
        `UPDATE resources
         SET ownership_status = 'LOCKED', locked_at = NOW(), lock_reason = 'OWNER_REVOKED'
         WHERE owner_account_id = $1 AND tenant_id = $2 AND ownership_status = 'ACTIVE'`,
        [accountId, tenantId],
      );
      await this.audit({
        tenant_id:      tenantId,
        event_category: 'SYSTEM',
        event_type:     'RESOURCES_LOCKED_OWNER_REVOKED',
        account_id:     accountId,
        outcome:        'FLAGGED',
        source_system:  adminId,
        severity:       'CRITICAL',
      });
    }
  }

  async deregister(tenantId: string, accountId: string, adminId: string): Promise<void> {
    await this.updateStatus(tenantId, accountId, 'REVOKED', adminId);
  }
}
