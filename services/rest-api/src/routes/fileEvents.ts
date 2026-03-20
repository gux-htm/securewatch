/**
 * File Events Routes
 *
 * GET  /api/v1/resources/:resourceId/events   — full event history for one file
 * GET  /api/v1/file-events                    — all recent events (limit 100)
 * PATCH /api/v1/file-events/:eventId/acknowledge — acknowledge / block / escalate
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { writeAuditEvent } from '../lib/audit';

interface FileEventRow {
  id:               string;
  resource_id:      string;
  resource_path:    string;
  event_type:       string;
  actor_username:   string;
  actor_ip:         string;
  actor_mac:        string;
  hash_before:      string | null;
  hash_after:       string | null;
  hash_changed:     number;
  integrity_flag:   string;
  flag_reason:      string | null;
  digital_sig:      string;
  occurred_at:      Date;
  acknowledged:     number;
  acknowledged_by:  string | null;
  acknowledged_at:  Date | null;
}

interface ResourceRow {
  resource_id:    string;
  resource_name:  string;
  resource_path:  string | null;
  current_flag:   string;
  last_event_at:  Date | null;
}

function mapEvent(r: FileEventRow) {
  return {
    id:             r.id,
    eventType:      r.event_type,
    actorUsername:  r.actor_username,
    actorIp:        r.actor_ip,
    actorMac:       r.actor_mac,
    hashBefore:     r.hash_before,
    hashAfter:      r.hash_after,
    hashChanged:    r.hash_changed === 1,
    integrityFlag:  r.integrity_flag,
    flagReason:     r.flag_reason,
    digitalSig:     r.digital_sig,
    occurredAt:     r.occurred_at,
    acknowledged:   r.acknowledged === 1,
    acknowledgedBy: r.acknowledged_by,
    acknowledgedAt: r.acknowledged_at,
  };
}

export async function fileEventRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /api/v1/resources/:resourceId/events ──────────────────────────────
  app.get(
    '/api/v1/resources/:resourceId/events',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { resourceId } = req.params as { resourceId: string };

      const resource = await queryOne<ResourceRow>(
        `SELECT resource_id, resource_name, resource_path, current_flag, last_event_at
         FROM resources WHERE resource_id = ? AND tenant_id = ?`,
        [resourceId, user.tenantId],
      );
      if (!resource) return reply.status(404).send({ error: 'Resource not found' });

      const events = await query<FileEventRow>(
        `SELECT * FROM file_events
         WHERE resource_id = ?
         ORDER BY occurred_at DESC`,
        [resourceId],
      );

      return reply.send({
        resource: {
          id:          resource.resource_id,
          name:        resource.resource_name,
          path:        resource.resource_path,
          currentFlag: resource.current_flag,
          lastEventAt: resource.last_event_at,
          totalEvents: events.length,
        },
        events: events.map(mapEvent),
      });
    },
  );

  // ── GET /api/v1/file-events ───────────────────────────────────────────────
  app.get(
    '/api/v1/file-events',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const qs = req.query as Record<string, string>;
      const flagFilter       = qs['flag']       ?? null;
      const resourceIdFilter = qs['resourceId'] ?? null;

      const conditions: string[] = ['fe.tenant_id = ?'];
      const params: (string | null)[] = [user.tenantId];

      if (flagFilter) {
        conditions.push('fe.integrity_flag = ?');
        params.push(flagFilter);
      }
      if (resourceIdFilter) {
        conditions.push('fe.resource_id = ?');
        params.push(resourceIdFilter);
      }

      const where = conditions.join(' AND ');

      const rows = await query<FileEventRow & { resource_name: string }>(
        `SELECT fe.*, r.resource_name
         FROM file_events fe
         JOIN resources r ON r.resource_id = fe.resource_id
         WHERE ${where}
         ORDER BY fe.occurred_at DESC
         LIMIT 100`,
        params,
      );

      return reply.send(rows.map((r) => ({
        ...mapEvent(r),
        resourceId:   r.resource_id,
        resourcePath: r.resource_path,
        resourceName: r.resource_name,
      })));
    },
  );

  // ── PATCH /api/v1/file-events/:eventId/acknowledge ────────────────────────
  app.patch(
    '/api/v1/file-events/:eventId/acknowledge',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { eventId } = req.params as { eventId: string };
      const body   = req.body as Record<string, unknown>;
      const action = typeof body['action'] === 'string' ? body['action'] : 'acknowledge';

      if (!['acknowledge', 'block_user', 'escalate'].includes(action)) {
        return reply.status(400).send({ error: 'Invalid action' });
      }

      const event = await queryOne<FileEventRow & { tenant_id: string }>(
        `SELECT fe.*, fe.tenant_id FROM file_events fe
         JOIN resources r ON r.resource_id = fe.resource_id
         WHERE fe.id = ? AND r.tenant_id = ?`,
        [eventId, user.tenantId],
      );
      if (!event) return reply.status(404).send({ error: 'Event not found' });

      // Mark acknowledged
      await execute(
        `UPDATE file_events
         SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = NOW()
         WHERE id = ?`,
        [user.sub, eventId],
      );

      if (action === 'block_user') {
        // Suspend the actor account
        await execute(
          `UPDATE accounts SET status = 'SUSPENDED'
           WHERE username = ? AND tenant_id = ?`,
          [event.actor_username, user.tenantId],
        );
        await writeAuditEvent({
          tenantId:       user.tenantId,
          eventType:      'ACCOUNT_SUSPENDED',
          actorAccountId: user.sub,
          actorIp:        req.ip ?? null,
          actorDeviceId:  user.deviceId,
          resourceId:     event.resource_id,
          resourcePath:   event.resource_path,
          outcome:        'ALLOWED',
          layerFailed:    null,
          detail:         { suspendedUsername: event.actor_username, reason: 'admin_block_from_file_event', eventId },
          severity:       'HIGH',
          timestamp:      new Date(),
        });
        // Fire H4 alert
        const alertId = uuidv4();
        await execute(
          `INSERT INTO alerts (alert_id, tenant_id, alert_code, severity, resource_id, detail)
           VALUES (?, ?, 'H4', 'HIGH', ?, ?)`,
          [alertId, user.tenantId, event.resource_id,
           JSON.stringify({ actorUsername: event.actor_username, suspendedBy: user.sub, eventId })],
        );
      }

      if (action === 'escalate') {
        await execute(
          `UPDATE file_events SET integrity_flag = 'CRITICAL' WHERE id = ?`,
          [eventId],
        );
        // Escalate resource flag if needed
        await execute(
          `UPDATE resources SET current_flag = 'CRITICAL'
           WHERE resource_id = ? AND current_flag != 'CRITICAL'`,
          [event.resource_id],
        );
        const alertId = uuidv4();
        await execute(
          `INSERT INTO alerts (alert_id, tenant_id, alert_code, severity, resource_id, detail)
           VALUES (?, ?, 'C1', 'CRITICAL', ?, ?)`,
          [alertId, user.tenantId, event.resource_id,
           JSON.stringify({ escalatedBy: user.sub, eventId, resourcePath: event.resource_path })],
        );
      }

      // After acknowledge: check if resource flag can be reset to CLEAN
      if (action === 'acknowledge') {
        const unacked = await queryOne<{ cnt: number }>(
          `SELECT COUNT(*) AS cnt FROM file_events
           WHERE resource_id = ? AND acknowledged = 0
             AND integrity_flag IN ('SUSPICIOUS','CRITICAL')`,
          [event.resource_id],
        );
        if ((unacked?.cnt ?? 1) === 0) {
          await execute(
            `UPDATE resources SET current_flag = 'CLEAN'
             WHERE resource_id = ?`,
            [event.resource_id],
          );
        }
      }

      await writeAuditEvent({
        tenantId:       user.tenantId,
        eventType:      'FS_EVENT_ACTIONED',
        actorAccountId: user.sub,
        actorIp:        req.ip ?? null,
        actorDeviceId:  user.deviceId,
        resourceId:     event.resource_id,
        resourcePath:   event.resource_path,
        outcome:        'ALLOWED',
        layerFailed:    null,
        detail:         { action, eventId, actorUsername: event.actor_username },
        severity:       'INFO',
        timestamp:      new Date(),
      });

      return reply.send({ ok: true, action, eventId });
    },
  );
}
