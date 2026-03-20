import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { writeAuditEvent } from '../lib/audit';

interface AccountListRow {
  account_id: string;
  username: string;
  email: string | null;
  role: string;
  status: string;
  registered_at: Date;
  last_verified_at: Date | null;
}

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/accounts — list all accounts for tenant
  app.get(
    '/api/v1/accounts',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const rows = await query<AccountListRow>(
        `SELECT account_id, username, email, role, status, registered_at, last_verified_at
         FROM accounts
         WHERE tenant_id = ?
         ORDER BY registered_at DESC`,
        [user.tenantId],
      );

      return reply.send(rows.map((r) => ({
        id:             r.account_id,
        username:       r.username,
        email:          r.email,
        role:           r.role,
        status:         r.status,
        registeredAt:   r.registered_at,
        lastVerifiedAt: r.last_verified_at,
      })));
    },
  );
  app.post(
    '/api/v1/accounts',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });
      if (user.role !== 'ADMIN') return reply.status(403).send({ error: 'Access Denied' });

      const body     = req.body as Record<string, unknown>;
      const username = typeof body['username'] === 'string' ? body['username'] : null;
      const email    = typeof body['email']    === 'string' ? body['email']    : null;
      const password = typeof body['password'] === 'string' ? body['password'] : null;
      const role     = typeof body['role']     === 'string' ? body['role']     : 'USER';

      if (!username || !password) {
        return reply.status(400).send({ error: 'username and password are required' });
      }

      // Check uniqueness
      const existing = await queryOne<{ account_id: string }>(
        `SELECT account_id FROM accounts WHERE username = ? AND tenant_id = ?`,
        [username, user.tenantId],
      );
      if (existing) return reply.status(409).send({ error: 'Username already exists' });

      const accountId    = uuidv4();
      const passwordHash = await bcrypt.hash(password, 12);

      // Generate base32 TOTP secret (20 random bytes)
      const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      const rawBytes = crypto.randomBytes(20);
      const totpSecret = Array.from(rawBytes)
        .map((b) => BASE32[b & 31])
        .join('');

      await execute(
        `INSERT INTO accounts
           (account_id, tenant_id, username, email, password_hash, status, role,
            mfa_secret, mfa_enabled, created_by)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, 1, ?)`,
        [accountId, user.tenantId, username, email ?? null, passwordHash,
         role.toUpperCase(), totpSecret, user.sub],
      );

      await writeAuditEvent({
        tenantId:       user.tenantId,
        eventType:      'ACCOUNT_CREATED',
        actorAccountId: user.sub,
        actorIp:        req.ip ?? null,
        actorDeviceId:  user.deviceId,
        resourceId:     null,
        resourcePath:   null,
        outcome:        'ALLOWED',
        layerFailed:    null,
        detail:         { newAccountId: accountId, username, role },
        severity:       'INFO',
        timestamp:      new Date(),
      });

      // totpSecret returned ONCE — never again
      return reply.status(201).send({
        id: accountId, username, email, role: role.toUpperCase(),
        status: 'ACTIVE', totpSecret,
      });
    },
  );
}
