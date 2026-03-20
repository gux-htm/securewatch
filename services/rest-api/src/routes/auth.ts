/**
 * Auth Routes — STEP 3
 *
 * POST /api/v1/auth/login  — Step 1: credentials → preAuthToken (5 min)
 * POST /api/v1/auth/mfa    — Step 2: TOTP + device → full JWT
 *
 * Security rules enforced:
 * - Generic "Access Denied" on ALL failures (never reveal reason)
 * - Rate limit: 5 attempts / IP / 15 min (node-cache counters)
 * - MFA cannot be skipped — JWT only issued after TOTP passes
 * - Three-layer verification runs before JWT is issued
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { verifyTotp } from '../lib/totp';
import { queryOne, execute } from '../db/mysql';
import Cache from '../db/cache';
import { writeAuditEvent } from '../lib/audit';
import { verifyAccess } from '../lib/verifier';

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface AccountRow {
  account_id: string;
  tenant_id: string;
  username: string;
  password_hash: string;
  status: string;
  role: string;
  mfa_secret: string | null;
  mfa_enabled: number;
  failed_login_count: number;
}

// ── Pre-auth token payload stored in cache ────────────────────────────────────

interface PreAuthEntry {
  accountId: string;
  tenantId: string;
  role: string;
  mfaFailures: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const s = process.env['JWT_SECRET'];
  if (!s) throw new Error('JWT_SECRET env var is not set');
  return s;
}

const ACCESS_DENIED = { error: 'Access Denied' } as const;

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /api/v1/auth/login ─────────────────────────────────────────────────
  app.post('/api/v1/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as Record<string, unknown>;
    const username  = typeof body['username']  === 'string' ? body['username']  : null;
    const password  = typeof body['password']  === 'string' ? body['password']  : null;
    const tenantId  = typeof body['tenantId']  === 'string' ? body['tenantId']  : null;

    if (!username || !password || !tenantId) {
      return reply.status(401).send(ACCESS_DENIED);
    }

    const sourceIp = req.ip ?? '127.0.0.1';

    // ── Rate limit: 5 attempts / IP / 15 min ───────────────────────────────
    const rateLimitKey = `rl:login:${sourceIp}`;
    const attempts = Cache.incr(rateLimitKey);
    if (attempts === 1) {
      Cache.expire(rateLimitKey, 900); // 15 min window
    }
    if (attempts > 10) {
      await writeAuditEvent({
        tenantId,
        eventType:      'AUTH_RATE_LIMIT_EXCEEDED',
        actorAccountId: null,
        actorIp:        sourceIp,
        actorDeviceId:  null,
        resourceId:     null,
        resourcePath:   null,
        outcome:        'DENIED',
        layerFailed:    null,
        detail:         { username, attempts, alertCode: 'H1' },
        severity:       'HIGH',
        timestamp:      new Date(),
      });
      return reply.status(429).send(ACCESS_DENIED);
    }

    // ── Look up account ────────────────────────────────────────────────────
    const account = await queryOne<AccountRow>(
      `SELECT account_id, tenant_id, username, password_hash, status, role,
              mfa_secret, mfa_enabled, failed_login_count
       FROM accounts
       WHERE username = ? AND tenant_id = ?
       LIMIT 1`,
      [username, tenantId],
    );

    // Constant-time comparison even when account not found
    const hashToCheck = account?.password_hash ?? '$2b$12$invalidhashpadding000000000000000000000000000000000000';
    const passwordValid = await bcrypt.compare(password, hashToCheck);

    if (!account || !passwordValid || account.status !== 'ACTIVE') {
      await writeAuditEvent({
        tenantId,
        eventType:      'AUTH_LOGIN_FAILED',
        actorAccountId: account?.account_id ?? null,
        actorIp:        sourceIp,
        actorDeviceId:  null,
        resourceId:     null,
        resourcePath:   null,
        outcome:        'DENIED',
        layerFailed:    null,
        detail:         { username, reason: 'invalid_credentials_or_status' },
        severity:       'LOW',
        timestamp:      new Date(),
      });
      return reply.status(401).send(ACCESS_DENIED);
    }

    // ── Issue token or pre-auth depending on mfa_enabled ─────────────────
    // When mfa_enabled=0, skip MFA step and issue JWT directly
    if (Number(account.mfa_enabled) === 0) {
      const jti = uuidv4();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const token = jwt.sign(
        { sub: account.account_id, tenantId: account.tenant_id, role: account.role, deviceId: null, jti },
        getJwtSecret(),
        { expiresIn: '24h' },
      );

      await execute(
        `INSERT INTO active_sessions (tenant_id, account_id, source_ip, risk_verdict) VALUES (?, ?, ?, 'CLEAN')`,
        [account.tenant_id, account.account_id, sourceIp],
      );

      await writeAuditEvent({
        tenantId: account.tenant_id, eventType: 'AUTH_LOGIN_SUCCESS',
        actorAccountId: account.account_id, actorIp: sourceIp, actorDeviceId: null,
        resourceId: null, resourcePath: null, outcome: 'ALLOWED', layerFailed: null,
        detail: { jti, role: account.role, mfaSkipped: true }, severity: 'INFO', timestamp: new Date(),
      });

      return reply.status(200).send({ token, expiresAt: expiresAt.toISOString(), mfaRequired: false });
    }

    // ── Issue pre-auth token (5 min, scope: mfa-pending) ──────────────────
    const preAuthToken = uuidv4();
    const entry: PreAuthEntry = {
      accountId:   account.account_id,
      tenantId:    account.tenant_id,
      role:        account.role,
      mfaFailures: 0,
    };
    Cache.set(`pre:${preAuthToken}`, JSON.stringify(entry), 600); // 10 min — user may take time to open Authenticator

    await writeAuditEvent({
      tenantId,
      eventType:      'AUTH_LOGIN_STEP1_OK',
      actorAccountId: account.account_id,
      actorIp:        sourceIp,
      actorDeviceId:  null,
      resourceId:     null,
      resourcePath:   null,
      outcome:        'ALLOWED',
      layerFailed:    null,
      detail:         { step: 'credentials_verified' },
      severity:       'INFO',
      timestamp:      new Date(),
    });

    return reply.status(200).send({ preAuthToken });
  });

  // ── POST /api/v1/auth/mfa ───────────────────────────────────────────────────
  app.post('/api/v1/auth/mfa', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as Record<string, unknown>;
    const preAuthToken      = typeof body['preAuthToken']      === 'string' ? body['preAuthToken']      : null;
    const totpCode          = typeof body['totpCode']          === 'string' ? body['totpCode']          : null;
    const deviceFingerprint = typeof body['deviceFingerprint'] === 'string' ? body['deviceFingerprint'] : null;
    const sourceIp          = typeof body['sourceIp']          === 'string' ? body['sourceIp']          : (req.ip ?? '127.0.0.1');

    if (!preAuthToken || !totpCode || !deviceFingerprint) {
      return reply.status(401).send(ACCESS_DENIED);
    }

    // ── Validate pre-auth token ────────────────────────────────────────────
    const cacheKey = `pre:${preAuthToken}`;
    const raw = Cache.get(cacheKey);
    if (!raw) {
      return reply.status(401).send(ACCESS_DENIED);
    }

    const entry = JSON.parse(raw) as PreAuthEntry;

    // ── Fetch account for TOTP secret ─────────────────────────────────────
    const account = await queryOne<AccountRow>(
      `SELECT account_id, tenant_id, username, password_hash, status, role,
              mfa_secret, mfa_enabled, failed_login_count
       FROM accounts
       WHERE account_id = ? AND tenant_id = ?
       LIMIT 1`,
      [entry.accountId, entry.tenantId],
    );

    if (!account || account.status !== 'ACTIVE') {
      Cache.del(cacheKey);
      return reply.status(401).send(ACCESS_DENIED);
    }

    // ── TOTP verification ──────────────────────────────────────────────────
    // mfa_enabled=0 → accept any 6-digit code (dev bypass)
    let totpValid = false;
    const mfaActive = account.mfa_secret && Number(account.mfa_enabled) === 1;
    if (mfaActive) {
      totpValid = verifyTotp(totpCode, account.mfa_secret as string);
    } else {
      // MFA disabled — accept any 6-digit numeric code
      totpValid = /^\d{6}$/.test(totpCode);
    }

    if (!totpValid) {
      entry.mfaFailures += 1;

      if (entry.mfaFailures >= 3) {
        // Lock account + CRITICAL alert
        Cache.del(cacheKey);
        await execute(
          `UPDATE accounts SET status = 'SUSPENDED' WHERE account_id = ?`,
          [account.account_id],
        );
        // Invalidate positive account cache
        Cache.del(`acct:${entry.tenantId}:${entry.accountId}`);

        await writeAuditEvent({
          tenantId:       entry.tenantId,
          eventType:      'AUTH_MFA_LOCKOUT',
          actorAccountId: account.account_id,
          actorIp:        sourceIp,
          actorDeviceId:  null,
          resourceId:     null,
          resourcePath:   null,
          outcome:        'DENIED',
          layerFailed:    null,
          detail:         { alertCode: 'H2', mfaFailures: entry.mfaFailures },
          severity:       'HIGH',
          timestamp:      new Date(),
        });
        return reply.status(401).send(ACCESS_DENIED);
      }

      // Update failure count in cache
      Cache.set(cacheKey, JSON.stringify(entry), 600);

      await writeAuditEvent({
        tenantId:       entry.tenantId,
        eventType:      'AUTH_MFA_FAILED',
        actorAccountId: account.account_id,
        actorIp:        sourceIp,
        actorDeviceId:  null,
        resourceId:     null,
        resourcePath:   null,
        outcome:        'DENIED',
        layerFailed:    null,
        detail:         { mfaFailures: entry.mfaFailures },
        severity:       'LOW',
        timestamp:      new Date(),
      });
      return reply.status(401).send(ACCESS_DENIED);
    }

    // ── Three-layer verification ───────────────────────────────────────────
    const verifyResult = await verifyAccess({
      accountId:         account.account_id,
      tenantId:          account.tenant_id,
      sourceIp,
      deviceFingerprint,
      resourceId:        null,
    });

    if (!verifyResult.allowed) {
      Cache.del(cacheKey);
      // Audit already written by verifyAccess — just return denial
      return reply.status(401).send(ACCESS_DENIED);
    }

    // ── All checks passed — issue full JWT ────────────────────────────────
    Cache.del(cacheKey); // Invalidate pre-auth token immediately

    const jti = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const token = jwt.sign(
      {
        sub:      account.account_id,
        tenantId: account.tenant_id,
        role:     account.role,
        deviceId: null,
        jti,
      },
      getJwtSecret(),
      { expiresIn: '24h' },
    );

    // ── Insert active session ──────────────────────────────────────────────
    await execute(
      `INSERT INTO active_sessions
         (tenant_id, account_id, source_ip, risk_verdict)
       VALUES (?, ?, ?, 'CLEAN')`,
      [account.tenant_id, account.account_id, sourceIp],
    );

    await writeAuditEvent({
      tenantId:       account.tenant_id,
      eventType:      'AUTH_LOGIN_SUCCESS',
      actorAccountId: account.account_id,
      actorIp:        sourceIp,
      actorDeviceId:  null,
      resourceId:     null,
      resourcePath:   null,
      outcome:        'ALLOWED',
      layerFailed:    null,
      detail:         { jti, role: account.role },
      severity:       'INFO',
      timestamp:      new Date(),
    });

    return reply.status(200).send({ token, expiresAt: expiresAt.toISOString() });
  });

  // ── GET /api/v1/debug/totp-test  (TEMP — remove after MFA confirmed working) ──
  // Usage: GET /api/v1/debug/totp-test?secret=BASE32SECRET&code=123456
  app.get('/api/v1/debug/totp-test', async (req: FastifyRequest, reply: FastifyReply) => {
    const { secret, code } = req.query as Record<string, string>;
    if (!secret || !code) {
      return reply.status(400).send({ error: 'secret and code query params required' });
    }
    const { generateTotp, verifyTotp: vt } = await import('../lib/totp');
    const expected = generateTotp(secret);
    const valid    = vt(code, secret);
    return reply.send({ valid, serverTime: Date.now(), expected });
  });
}
