/**
 * Device Routes
 *
 * GET   /api/v1/devices      — list all devices for tenant
 * PATCH /api/v1/devices/:id  — update status (TRUSTED / REVOKED / PENDING)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { writeAuditEvent } from '../lib/audit';

interface DeviceRow {
  device_id: string;
  fingerprint: string;
  label: string | null;
  os_type: string | null;
  hostname: string | null;
  status: string;
  registered_at: Date;
  last_seen_at: Date | null;
  account_id: string | null;
  username: string | null;
}

export async function deviceRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/v1/devices
  app.get(
    '/api/v1/devices',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const rows = await query<DeviceRow>(
        `SELECT d.device_id, d.fingerprint, d.label, d.os_type, d.hostname,
                d.status, d.registered_at, d.last_seen_at,
                d.account_id, acc.username
         FROM devices d
         LEFT JOIN accounts acc ON acc.account_id = d.account_id
         WHERE d.tenant_id = ?
         ORDER BY d.registered_at DESC`,
        [user.tenantId],
      );

      return reply.send(rows.map((r) => ({
        id:           r.device_id,
        fingerprint:  r.fingerprint,
        label:        r.label,
        os:           r.os_type,
        hostname:     r.hostname,
        status:       r.status,
        registeredAt: r.registered_at,
        lastSeenAt:   r.last_seen_at,
        accountId:    r.account_id,
        username:     r.username,
      })));
    },
  );

  // PATCH /api/v1/devices/:id
  app.patch(
    '/api/v1/devices/:id',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { id } = req.params as { id: string };
      const body   = req.body as Record<string, unknown>;
      const status = typeof body['status'] === 'string' ? body['status'] : null;

      const allowed = ['TRUSTED', 'UNTRUSTED', 'PENDING', 'REVOKED'];
      if (!status || !allowed.includes(status)) {
        return reply.status(400).send({ error: `status must be one of: ${allowed.join(', ')}` });
      }

      const existing = await queryOne<{ device_id: string; fingerprint: string }>(
        `SELECT device_id, fingerprint FROM devices WHERE device_id = ? AND tenant_id = ?`,
        [id, user.tenantId],
      );
      if (!existing) return reply.status(404).send({ error: 'Not found' });

      await execute(`UPDATE devices SET status = ? WHERE device_id = ?`, [status, id]);

      await writeAuditEvent({
        tenantId:       user.tenantId,
        eventType:      'DEVICE_STATUS_CHANGED',
        actorAccountId: user.sub,
        actorIp:        req.ip ?? null,
        actorDeviceId:  user.deviceId,
        resourceId:     null,
        resourcePath:   null,
        outcome:        'ALLOWED',
        layerFailed:    null,
        detail:         { deviceId: id, fingerprint: existing.fingerprint, newStatus: status },
        severity:       status === 'REVOKED' ? 'HIGH' : 'INFO',
        timestamp:      new Date(),
      });

      return reply.send({ id, status });
    },
  );
}
