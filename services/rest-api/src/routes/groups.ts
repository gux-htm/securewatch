/**
 * Group Routes
 *
 * GET    /api/v1/groups                        — list groups
 * POST   /api/v1/groups                        — create group
 * GET    /api/v1/groups/:id/members            — list members
 * POST   /api/v1/groups/:id/members            — add member
 * DELETE /api/v1/groups/:id/members/:accountId — remove member
 * DELETE /api/v1/groups/:id                    — delete group
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { writeAuditEvent } from '../lib/audit';

interface GroupRow {
  group_id: string;
  group_name: string;
  description: string | null;
  created_at: Date;
  member_count: number;
}

interface MemberRow {
  account_id: string;
  username: string;
  email: string | null;
  role: string;
  status: string;
  added_at: Date;
}

export async function groupRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/v1/groups
  app.get(
    '/api/v1/groups',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const rows = await query<GroupRow>(
        `SELECT g.group_id, g.group_name, g.description, g.created_at,
                COUNT(gm.account_id) AS member_count
         FROM groups g
         LEFT JOIN group_members gm ON gm.group_id = g.group_id
         WHERE g.tenant_id = ?
         GROUP BY g.group_id
         ORDER BY g.created_at DESC`,
        [user.tenantId],
      );

      return reply.send(rows.map((r) => ({
        id:          r.group_id,
        name:        r.group_name,
        description: r.description,
        createdAt:   r.created_at,
        memberCount: Number(r.member_count),
      })));
    },
  );

  // POST /api/v1/groups
  app.post(
    '/api/v1/groups',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const body        = req.body as Record<string, unknown>;
      const name        = typeof body['name']        === 'string' ? body['name']        : null;
      const description = typeof body['description'] === 'string' ? body['description'] : null;

      if (!name) return reply.status(400).send({ error: 'name is required' });

      const groupId = uuidv4();
      await execute(
        `INSERT INTO groups (group_id, tenant_id, group_name, description, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [groupId, user.tenantId, name, description, user.sub],
      );

      await writeAuditEvent({
        tenantId: user.tenantId, eventType: 'GROUP_CREATED',
        actorAccountId: user.sub, actorIp: req.ip ?? null, actorDeviceId: user.deviceId,
        resourceId: null, resourcePath: null, outcome: 'ALLOWED', layerFailed: null,
        detail: { groupId, name }, severity: 'INFO', timestamp: new Date(),
      });

      return reply.status(201).send({ id: groupId, name, description, memberCount: 0 });
    },
  );

  // GET /api/v1/groups/:id/members
  app.get(
    '/api/v1/groups/:id/members',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { id } = req.params as { id: string };

      const group = await queryOne<{ group_id: string }>(
        `SELECT group_id FROM groups WHERE group_id = ? AND tenant_id = ?`,
        [id, user.tenantId],
      );
      if (!group) return reply.status(404).send({ error: 'Not found' });

      const members = await query<MemberRow>(
        `SELECT a.account_id, a.username, a.email, a.role, a.status, gm.added_at
         FROM group_members gm
         JOIN accounts a ON a.account_id = gm.account_id
         WHERE gm.group_id = ?
         ORDER BY gm.added_at DESC`,
        [id],
      );

      return reply.send(members.map((m) => ({
        accountId: m.account_id,
        username:  m.username,
        email:     m.email,
        role:      m.role,
        status:    m.status,
        addedAt:   m.added_at,
      })));
    },
  );

  // POST /api/v1/groups/:id/members
  app.post(
    '/api/v1/groups/:id/members',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { id } = req.params as { id: string };
      const body   = req.body as Record<string, unknown>;
      const accountId = typeof body['accountId'] === 'string' ? body['accountId'] : null;

      if (!accountId) return reply.status(400).send({ error: 'accountId is required' });

      const group = await queryOne<{ group_id: string }>(
        `SELECT group_id FROM groups WHERE group_id = ? AND tenant_id = ?`,
        [id, user.tenantId],
      );
      if (!group) return reply.status(404).send({ error: 'Group not found' });

      const account = await queryOne<{ account_id: string; username: string }>(
        `SELECT account_id, username FROM accounts WHERE account_id = ? AND tenant_id = ?`,
        [accountId, user.tenantId],
      );
      if (!account) return reply.status(404).send({ error: 'Account not found' });

      await execute(
        `INSERT IGNORE INTO group_members (group_id, account_id, added_by) VALUES (?, ?, ?)`,
        [id, accountId, user.sub],
      );

      return reply.status(201).send({ groupId: id, accountId, username: account.username });
    },
  );

  // DELETE /api/v1/groups/:id/members/:accountId
  app.delete(
    '/api/v1/groups/:id/members/:accountId',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { id, accountId } = req.params as { id: string; accountId: string };

      await execute(
        `DELETE FROM group_members WHERE group_id = ? AND account_id = ?`,
        [id, accountId],
      );

      return reply.send({ groupId: id, accountId, removed: true });
    },
  );

  // DELETE /api/v1/groups/:id
  app.delete(
    '/api/v1/groups/:id',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { id } = req.params as { id: string };

      const existing = await queryOne<{ group_id: string }>(
        `SELECT group_id FROM groups WHERE group_id = ? AND tenant_id = ?`,
        [id, user.tenantId],
      );
      if (!existing) return reply.status(404).send({ error: 'Not found' });

      await execute(`DELETE FROM group_members WHERE group_id = ?`, [id]);
      await execute(`DELETE FROM groups WHERE group_id = ?`, [id]);

      return reply.send({ id, deleted: true });
    },
  );
}
