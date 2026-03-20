/**
 * MFA Setup Routes
 *
 * GET /api/v1/auth/mfa-qr  — returns a base64 PNG QR code for the caller's TOTP secret
 * POST /api/v1/auth/mfa-enable — marks mfa_enabled=1 after first successful TOTP verify
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import QRCode from 'qrcode';
import { queryOne, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { verifyTotp } from '../lib/totp';

interface AccountRow {
  mfa_secret: string | null;
  mfa_enabled: number;
  username: string;
}

export async function mfaSetupRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /api/v1/auth/mfa-qr ────────────────────────────────────────────────
  // Returns { qrDataUrl: "data:image/png;base64,..." } — render as <img src=...>
  app.get(
    '/api/v1/auth/mfa-qr',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const account = await queryOne<AccountRow>(
        `SELECT mfa_secret, mfa_enabled, username
         FROM accounts
         WHERE account_id = ? AND tenant_id = ?`,
        [user.sub, user.tenantId],
      );

      if (!account || !account.mfa_secret) {
        return reply.status(404).send({ error: 'No MFA secret found for this account' });
      }

      const issuer  = 'SecureWatch';
      const label   = encodeURIComponent(`${issuer}:${account.username}`);
      const otpauth = `otpauth://totp/${label}?secret=${account.mfa_secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

      const qrDataUrl = await QRCode.toDataURL(otpauth, {
        width:          256,
        margin:         2,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      });

      return reply.send({
        qrDataUrl,
        secret:     account.mfa_secret,
        mfaEnabled: account.mfa_enabled === 1,
        otpauth,
      });
    },
  );

  // ── POST /api/v1/auth/mfa-enable ───────────────────────────────────────────
  // Body: { totpCode: "123456" }
  // Verifies the code then flips mfa_enabled=1 — confirms user has scanned correctly
  app.post(
    '/api/v1/auth/mfa-enable',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const body     = req.body as Record<string, unknown>;
      const totpCode = typeof body['totpCode'] === 'string' ? body['totpCode'] : null;

      if (!totpCode || !/^\d{6}$/.test(totpCode)) {
        return reply.status(400).send({ error: 'Valid 6-digit code required' });
      }

      const account = await queryOne<AccountRow>(
        `SELECT mfa_secret, mfa_enabled, username
         FROM accounts
         WHERE account_id = ? AND tenant_id = ?`,
        [user.sub, user.tenantId],
      );

      if (!account || !account.mfa_secret) {
        return reply.status(404).send({ error: 'No MFA secret found' });
      }

      if (!verifyTotp(totpCode, account.mfa_secret)) {
        return reply.status(401).send({ error: 'Invalid code — try again' });
      }

      await execute(
        `UPDATE accounts SET mfa_enabled = 1 WHERE account_id = ?`,
        [user.sub],
      );

      return reply.send({ ok: true, message: 'MFA enabled successfully' });
    },
  );

  // ── POST /api/v1/auth/mfa-disable ──────────────────────────────────────────
  // Admin only — disables MFA for a given account
  app.post(
    '/api/v1/auth/mfa-disable',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });
      if (user.role !== 'ADMIN') return reply.status(403).send({ error: 'Access Denied' });

      const body      = req.body as Record<string, unknown>;
      const accountId = typeof body['accountId'] === 'string' ? body['accountId'] : user.sub;

      await execute(
        `UPDATE accounts SET mfa_enabled = 0 WHERE account_id = ? AND tenant_id = ?`,
        [accountId, user.tenantId],
      );

      return reply.send({ ok: true });
    },
  );
}
