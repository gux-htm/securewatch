/**
 * Admin authentication — credentials → MFA → JWT.
 * Rule S3: No bypass path. JWT issued ONLY after MFA passes.
 * Rule S11: Auth failure escalation: L2 → L2+warning → C6+lock.
 */

import { createHash } from 'crypto';
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import { verifyTotp, verifyBackupCode } from './mfa-service.js';
import { issueJwt } from './jwt-issuer.js';
import type { AuditWriter } from './types.js';

const ADMIN_AUTH_FAIL_PREFIX = 'admin_auth_fail:';
const LOCKOUT_THRESHOLD = 3;

export interface LoginInput {
  username:   string;
  tenant_id:  string;
  password:   string;
  mfa_token:  string;
}

export interface LoginResult {
  jwt:     string;
  warning?: string; // Only on 2nd failure — never contains denial detail
}

interface AdminRow {
  admin_id:          string;
  tenant_id:         string;
  username:          string;
  role:              string;
  status:            string;
  password_hash:     string;
  mfa_enabled:       boolean;
  mfa_secret_ref:    string | null;
  failed_auth_count: number;
}

function hashPassword(password: string): string {
  // In production: use bcrypt/argon2. SHA-256 used here for testability without native deps.
  return createHash('sha256').update(password).digest('hex');
}

export class AdminAuth {
  constructor(
    private readonly db: Pool,
    private readonly redis: Redis,
    private readonly audit: AuditWriter,
    private readonly getMfaSecret: (vaultPath: string) => Promise<string>,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    await this.db.query(`SET app.tenant_id = $1`, [input.tenant_id]);
    const res = await this.db.query<AdminRow>(
      `SELECT admin_id, tenant_id, username, role, status,
              password_hash, mfa_enabled, mfa_secret_ref, failed_auth_count
       FROM admin_operators
       WHERE username = $1 AND tenant_id = $2`,
      [input.username, input.tenant_id],
    );

    const admin = res.rows[0];

    // Credentials check — same error path for not-found and wrong password (Rule S1)
    if (!admin || admin.status === 'LOCKED' || admin.status === 'SUSPENDED') {
      await this.recordFailure(admin?.admin_id ?? 'unknown', input.tenant_id, input.username);
      throw new Error('AUTH_FAILED');
    }

    const passwordHash = hashPassword(input.password);
    if (passwordHash !== admin.password_hash) {
      await this.recordFailure(admin.admin_id, input.tenant_id, input.username);
      const failCount = await this.getFailCount(admin.admin_id);
      if (failCount === 2) {
        return Promise.reject(Object.assign(new Error('AUTH_FAILED'), { warning: true }));
      }
      throw new Error('AUTH_FAILED');
    }

    // MFA verification — Rule S3: cannot be bypassed
    if (!admin.mfa_enabled || !admin.mfa_secret_ref) {
      // MFA not yet set up — force setup before login
      throw new Error('MFA_SETUP_REQUIRED');
    }

    const mfaSecret = await this.getMfaSecret(admin.mfa_secret_ref);
    const mfaValid = verifyTotp(input.mfa_token, mfaSecret);

    if (!mfaValid) {
      await this.recordFailure(admin.admin_id, input.tenant_id, input.username);
      throw new Error('AUTH_FAILED');
    }

    // All checks passed — reset failure counter, issue JWT
    await this.clearFailCount(admin.admin_id);
    await this.db.query(
      `UPDATE admin_operators SET last_login_at = NOW(), failed_auth_count = 0
       WHERE admin_id = $1`,
      [admin.admin_id],
    );

    await this.audit({
      tenant_id:      admin.tenant_id,
      event_category: 'SESSION',
      event_type:     'ADMIN_LOGIN_SUCCESS',
      account_id:     admin.admin_id,
      outcome:        'ALLOWED',
      severity:       'INFO',
    });

    const jwt = issueJwt({
      admin_id:  admin.admin_id,
      tenant_id: admin.tenant_id,
      role:      admin.role,
    });

    return { jwt };
  }

  private async getFailCount(adminId: string): Promise<number> {
    const val = await this.redis.get(`${ADMIN_AUTH_FAIL_PREFIX}${adminId}`);
    return parseInt(val ?? '0', 10);
  }

  private async clearFailCount(adminId: string): Promise<void> {
    await this.redis.del(`${ADMIN_AUTH_FAIL_PREFIX}${adminId}`);
  }

  private async recordFailure(adminId: string, tenantId: string, username: string): Promise<void> {
    const key = `${ADMIN_AUTH_FAIL_PREFIX}${adminId}`;
    const count = await this.redis.incr(key);
    await this.redis.expire(key, 3600); // 1 hour window

    if (count >= LOCKOUT_THRESHOLD) {
      // C6: Lock account in DB + Redis
      if (adminId !== 'unknown') {
        await this.db.query(
          `UPDATE admin_operators SET status = 'LOCKED', locked_at = NOW()
           WHERE admin_id = $1`,
          [adminId],
        );
      }
      await this.audit({
        tenant_id:      tenantId,
        event_category: 'SESSION',
        event_type:     'ADMIN_AUTH_FAILURE_LOCKOUT',
        account_id:     adminId !== 'unknown' ? adminId : null,
        outcome:        'DENIED',
        denial_reason:  `Account locked after ${count} failed attempts`,
        severity:       'CRITICAL',
        source_system:  username,
      });
    } else {
      // L2: LOW alert
      await this.audit({
        tenant_id:      tenantId,
        event_category: 'SESSION',
        event_type:     'ADMIN_AUTH_FAILURE',
        account_id:     adminId !== 'unknown' ? adminId : null,
        outcome:        'DENIED',
        denial_reason:  `Failed attempt ${count}`,
        severity:       'LOW',
        source_system:  username,
      });
    }
  }

  async recoverAccount(
    adminId: string,
    tenantId: string,
    recoveryKey: string,
    newMfaToken: string,
    getMfaSecret: (path: string) => Promise<string>,
  ): Promise<void> {
    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const res = await this.db.query<{ recovery_key_hash: string; mfa_secret_ref: string | null }>(
      `SELECT recovery_key_hash, mfa_secret_ref FROM admin_operators
       WHERE admin_id = $1 AND tenant_id = $2`,
      [adminId, tenantId],
    );
    const admin = res.rows[0];
    if (!admin) throw new Error('AUTH_FAILED');

    const keyHash = createHash('sha256').update(recoveryKey).digest('hex');
    if (keyHash !== admin.recovery_key_hash) throw new Error('AUTH_FAILED');

    if (!admin.mfa_secret_ref) throw new Error('MFA_NOT_CONFIGURED');
    const secret = await getMfaSecret(admin.mfa_secret_ref);
    if (!verifyTotp(newMfaToken, secret)) throw new Error('AUTH_FAILED');

    await this.db.query(
      `UPDATE admin_operators SET status = 'ACTIVE', locked_at = NULL, failed_auth_count = 0
       WHERE admin_id = $1`,
      [adminId],
    );
    await this.clearFailCount(adminId);

    await this.audit({
      tenant_id:      tenantId,
      event_category: 'SESSION',
      event_type:     'ADMIN_ACCOUNT_RECOVERED',
      account_id:     adminId,
      outcome:        'ALLOWED',
      severity:       'CRITICAL', // Recovery always CRITICAL per spec
    });
  }

  // Expose for testing
  async getFailCountPublic(adminId: string): Promise<number> {
    return this.getFailCount(adminId);
  }
}

// Re-export for use in tests
export { verifyBackupCode };
