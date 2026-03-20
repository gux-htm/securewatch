/**
 * Agent Routes
 *
 * POST /api/v1/agent/sync-users     — Go agent UPSERTs Windows users into accounts
 * GET  /api/v1/agent/approved-users — returns list of active account usernames
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { query, execute } from '../db/mysql';

const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';

interface WindowsUser {
  username: string;
  status:   string;
}

interface SyncUsersBody {
  users:       WindowsUser[];
  currentUser: string;
  hostname:    string;
}

export async function agentRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /api/v1/agent/sync-users ─────────────────────────────────────────
  // No auth required — agent runs before any JWT is available.
  // Secured by network isolation (localhost only in production).
  app.post(
    '/api/v1/agent/sync-users',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as SyncUsersBody;
      const users       = Array.isArray(body?.users) ? body.users : [];
      const currentUser = typeof body?.currentUser === 'string' ? body.currentUser : '';
      const hostname    = typeof body?.hostname    === 'string' ? body.hostname    : '';

      // Use the default tenant — agent is single-tenant in this deployment
      const tenantId = DEFAULT_TENANT;

      let upserted = 0;
      for (const u of users) {
        if (!u.username || typeof u.username !== 'string') continue;

        const existing = await query<{ account_id: string }>(
          `SELECT account_id FROM accounts WHERE username = ? AND tenant_id = ? LIMIT 1`,
          [u.username, tenantId],
        );

        if (existing.length > 0 && existing[0]) {
          await execute(
            `UPDATE accounts SET last_verified_at = NOW() WHERE account_id = ?`,
            [existing[0].account_id],
          );
        } else {
          const accountId = uuidv4();
          // Agent-managed accounts: no password, role=user, source tracked in email field
          await execute(
            `INSERT INTO accounts
               (account_id, tenant_id, username, email, password_hash, status, role)
             VALUES (?, ?, ?, ?, '', 'ACTIVE', 'USER')`,
            [accountId, tenantId, u.username,
             `${u.username.toLowerCase()}@windows-agent.local`],
          );
          console.log(`[agent] Auto-created account for Windows user: ${u.username}`);
        }
        upserted++;
      }

      console.log(`[agent] sync-users: ${upserted} users from ${hostname} (current: ${currentUser})`);
      return reply.send({ ok: true, upserted, hostname, currentUser });
    },
  );

  // ── GET /api/v1/agent/approved-users ─────────────────────────────────────
  app.get(
    '/api/v1/agent/approved-users',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const rows = await query<{ username: string }>(
        `SELECT username FROM accounts
         WHERE tenant_id = ? AND status = 'ACTIVE'`,
        [DEFAULT_TENANT],
      );
      return reply.send({ usernames: rows.map((r) => r.username) });
    },
  );
}
