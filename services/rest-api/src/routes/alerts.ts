import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { writeAuditEvent } from '../lib/audit';

interface AlertRow {
  alert_id: string;
  alert_code: string;
  severity: string;
  triggered_at: Date;
  account_id: string | null;
  device_id: string | null;
  resource_id: string | null;
  system_id: string | null;
  detail: string;
  acknowledged: number;
  ack_at: Date | null;
  username: string | null;
}

export async function alertRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/alerts
  app.get(
    '/api/v1/alerts',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const rows = await query<AlertRow>(
        `SELECT a.alert_id, a.alert_code, a.severity, a.triggered_at,
                a.account_id, a.device_id, a.resource_id, a.system_id,
                a.detail, a.acknowledged, a.ack_at,
                acc.username
         FROM alerts a
         LEFT JOIN accounts acc ON acc.account_id = a.account_id
         WHERE a.tenant_id = ?
         ORDER BY a.triggered_at DESC
         LIMIT 50`,
        [user.tenantId],
      );

      return reply.send(rows.map((r) => ({
        id:           r.alert_id,
        code:         r.alert_code,
        severity:     r.severity,
        triggeredAt:  r.triggered_at,
        accountId:    r.account_id,
        username:     r.username,
        deviceId:     r.device_id,
        resourceId:   r.resource_id,
        systemId:     r.system_id,
        detail:       (() => { try { return JSON.parse(r.detail) as unknown; } catch { return r.detail; } })(),
        acknowledged: r.acknowledged === 1,
        ackedAt:      r.ack_at,
      })));
    },
  );

  // PATCH /api/v1/alerts/:id/acknowledge
  app.patch(
    '/api/v1/alerts/:id/acknowledge',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { id } = req.params as { id: string };

      const existing = await queryOne<{ alert_id: string; tenant_id: string }>(
        `SELECT alert_id, tenant_id FROM alerts WHERE alert_id = ? AND tenant_id = ?`,
        [id, user.tenantId],
      );
      if (!existing) return reply.status(404).send({ error: 'Not found' });

      await execute(
        `UPDATE alerts SET acknowledged = 1, ack_at = NOW() WHERE alert_id = ?`,
        [id],
      );

      await writeAuditEvent({
        tenantId:       user.tenantId,
        eventType:      'ALERT_ACKNOWLEDGED',
        actorAccountId: user.sub,
        actorIp:        req.ip ?? null,
        actorDeviceId:  user.deviceId,
        resourceId:     null,
        resourcePath:   null,
        outcome:        'ALLOWED',
        layerFailed:    null,
        detail:         { alertId: id },
        severity:       'INFO',
        timestamp:      new Date(),
      });

      return reply.send({ id, acknowledged: true, ackedAt: new Date() });
    },
  );
}
