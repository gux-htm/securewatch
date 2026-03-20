import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { writeAuditEvent } from '../lib/audit';

interface SessionRow {
  session_id: string;
  account_id: string;
  username: string;
  source_ip: string | null;
  device_id: string | null;
  fingerprint: string | null;
  started_at: Date;
  last_active: Date;
  risk_verdict: string;
  is_terminated: number;
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/sessions
  app.get(
    '/api/v1/sessions',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const rows = await query<SessionRow>(
        `SELECT s.session_id, s.account_id, acc.username,
                s.source_ip, s.device_id, d.fingerprint,
                s.started_at, s.last_active, s.risk_verdict, s.is_terminated
         FROM active_sessions s
         JOIN accounts acc ON acc.account_id = s.account_id
         LEFT JOIN devices d ON d.device_id = s.device_id
         WHERE s.tenant_id = ? AND s.is_terminated = 0
         ORDER BY s.started_at DESC`,
        [user.tenantId],
      );

      return reply.send(rows.map((r) => ({
        id:                r.session_id,
        accountId:         r.account_id,
        username:          r.username,
        sourceIp:          r.source_ip,
        deviceId:          r.device_id,
        deviceFingerprint: r.fingerprint,
        loginAt:           r.started_at,
        lastActive:        r.last_active,
        status:            r.risk_verdict,
      })));
    },
  );

  // DELETE /api/v1/sessions/:id
  app.delete(
    '/api/v1/sessions/:id',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { id } = req.params as { id: string };

      const existing = await queryOne<{ session_id: string; account_id: string }>(
        `SELECT session_id, account_id FROM active_sessions
         WHERE session_id = ? AND tenant_id = ? AND is_terminated = 0`,
        [id, user.tenantId],
      );
      if (!existing) return reply.status(404).send({ error: 'Not found' });

      await execute(
        `UPDATE active_sessions
         SET is_terminated = 1, terminated_at = NOW(), terminated_by = ?
         WHERE session_id = ?`,
        [user.sub, id],
      );

      await writeAuditEvent({
        tenantId:       user.tenantId,
        eventType:      'SESSION_TERMINATED',
        actorAccountId: user.sub,
        actorIp:        req.ip ?? null,
        actorDeviceId:  user.deviceId,
        resourceId:     null,
        resourcePath:   null,
        outcome:        'ALLOWED',
        layerFailed:    null,
        detail:         { sessionId: id, targetAccountId: existing.account_id },
        severity:       'HIGH',
        timestamp:      new Date(),
      });

      return reply.send({ id, terminated: true });
    },
  );
}
