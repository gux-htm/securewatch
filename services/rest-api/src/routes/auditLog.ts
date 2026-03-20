/**
 * Audit Log Routes
 *
 * GET  /api/v1/audit-log          — paginated query with filters
 * POST /api/v1/audit-log/fs-event — ingest a file-system event from the watcher
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { writeAuditEvent } from '../lib/audit';

interface AuditRow {
  log_id: string;
  occurred_at: Date;
  event_type: string;
  event_category: string;
  account_id: string | null;
  source_ip: string | null;
  resource_path: string | null;
  outcome: string;
  failed_layer: string | null;
  raw_event: string | null;
  hmac_signature: string;
  source_system: string | null;
}

interface FsEventBody {
  eventType: string;   // 'created' | 'changed' | 'deleted' | 'renamed'
  filePath: string;
  oldPath?: string;
  processName?: string;
  pid?: number;
}

export async function auditLogRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /api/v1/audit-log ───────────────────────────────────────────────────
  app.get(
    '/api/v1/audit-log',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const qs       = req.query as Record<string, string>;
      const limit    = Math.min(parseInt(qs['limit']  ?? '100', 10), 500);
      const offset   = parseInt(qs['offset'] ?? '0', 10);
      const outcome  = qs['outcome']  ?? null;
      const category = qs['category'] ?? null;
      const search   = qs['search']   ?? null;
      const from     = qs['from']     ?? null;
      const to       = qs['to']       ?? null;

      const conditions: string[] = ['tenant_id = ?'];
      const params: (string | number)[] = [user.tenantId];

      if (outcome)  { conditions.push('outcome = ?');          params.push(outcome); }
      if (category) { conditions.push('event_category = ?');   params.push(category); }
      if (from)     { conditions.push('occurred_at >= ?');     params.push(from); }
      if (to)       { conditions.push('occurred_at <= ?');     params.push(to); }
      if (search) {
        conditions.push('(event_type LIKE ? OR resource_path LIKE ? OR source_ip LIKE ?)');
        const like = `%${search}%`;
        params.push(like, like, like);
      }

      const where = conditions.join(' AND ');

      const rows = await query<AuditRow>(
        `SELECT log_id, occurred_at, event_type, event_category,
                account_id, source_ip, resource_path, outcome,
                failed_layer, raw_event, hmac_signature, source_system
         FROM audit_events
         WHERE ${where}
         ORDER BY occurred_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      const [countRow] = await query<{ total: number }>(
        `SELECT COUNT(*) AS total FROM audit_events WHERE ${where}`,
        params,
      );

      return reply.send({
        total:  countRow?.total ?? 0,
        limit,
        offset,
        rows: rows.map((r) => ({
          id:           r.log_id,
          occurredAt:   r.occurred_at,
          eventType:    r.event_type,
          category:     r.event_category,
          accountId:    r.account_id,
          sourceIp:     r.source_ip,
          resourcePath: r.resource_path,
          outcome:      r.outcome,
          failedLayer:  r.failed_layer,
          sourceSystem: r.source_system,
          hmac:         r.hmac_signature,
        })),
      });
    },
  );

  // ── POST /api/v1/audit-log/fs-event ────────────────────────────────────────
  // Called by the local file-system watcher — no auth token required
  // (watcher runs on same machine, uses a shared secret instead)
  app.post(
    '/api/v1/audit-log/fs-event',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const secret = req.headers['x-watcher-secret'];
      const expected = process.env['WATCHER_SECRET'] ?? 'dev-watcher-secret';
      if (secret !== expected) {
        return reply.status(401).send({ error: 'Access Denied' });
      }

      const body = req.body as FsEventBody;
      if (!body.filePath || !body.eventType) {
        return reply.status(400).send({ error: 'filePath and eventType required' });
      }

      const tenantId = process.env['DEFAULT_TENANT_ID'] ?? '00000000-0000-0000-0000-000000000001';

      await writeAuditEvent({
        tenantId,
        eventType:      `FS_${body.eventType.toUpperCase()}`,
        actorAccountId: null,
        actorIp:        '127.0.0.1',
        actorDeviceId:  null,
        resourceId:     null,
        resourcePath:   body.filePath,
        outcome:        'ALLOWED',
        layerFailed:    null,
        detail: {
          eventType:   body.eventType,
          filePath:    body.filePath,
          oldPath:     body.oldPath ?? null,
          processName: body.processName ?? null,
          pid:         body.pid ?? null,
        },
        severity:  'INFO',
        timestamp: new Date(),
      });

      return reply.status(201).send({ ok: true });
    },
  );

  // ── GET /api/v1/audit-log/categories ───────────────────────────────────────
  app.get(
    '/api/v1/audit-log/categories',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const rows = await query<{ event_category: string; cnt: number }>(
        `SELECT event_category, COUNT(*) AS cnt
         FROM audit_events
         WHERE tenant_id = ?
         GROUP BY event_category
         ORDER BY cnt DESC`,
        [user.tenantId],
      );

      return reply.send(rows.map((r) => ({ category: r.event_category, count: r.cnt })));
    },
  );
}
