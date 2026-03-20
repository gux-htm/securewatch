/**
 * Resource Access Event Routes
 *
 * POST /api/v1/resources/:id/access-event
 *   — Report a read/write/delete on a registered resource.
 *     Checks ACL, compares file hash, writes audit log, fires alert.
 *
 * POST /api/v1/access-events/raw
 *   — Same but for unregistered paths (watcher reports unknown files).
 *     Tries to match path to a registered resource automatically.
 *
 * GET  /api/v1/resources/:id/access-events
 *   — Fetch audit history for a specific resource.
 *
 * GET  /api/v1/resources/:id/acl
 *   — List ACL entries for a resource.
 *
 * POST /api/v1/resources/:id/acl
 *   — Grant access to an account for a resource.
 *
 * DELETE /api/v1/resources/:id/acl/:aclId
 *   — Revoke an ACL entry.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { processAccessEvent, type AccessAction } from '../lib/accessEvent';

const VALID_ACTIONS = new Set<string>(['read', 'write', 'delete', 'rename', 'execute']);
const WATCHER_SECRET = () => process.env['WATCHER_SECRET'] ?? 'dev-watcher-secret';
const DEFAULT_TENANT = () => process.env['DEFAULT_TENANT_ID'] ?? '00000000-0000-0000-0000-000000000001';

interface AclRow {
  acl_id: string;
  grantee_type: string;
  grantee_id: string;
  grantee_username: string | null;
  permitted_actions: string;
  granted_at: Date;
  status: string;
  granted_by_username: string | null;
}

interface AuditRow {
  log_id: string;
  occurred_at: Date;
  event_type: string;
  account_id: string | null;
  actor_username: string | null;
  source_ip: string | null;
  outcome: string;
  denial_reason: string | null;
}

export async function accessEventRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /api/v1/resources/:id/access-event ─────────────────────────────────
  // Called by SDK / agent with a bearer token (authenticated actor)
  app.post(
    '/api/v1/resources/:id/access-event',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { id: resourceId } = req.params as { id: string };
      const body   = req.body as Record<string, unknown>;
      const action = typeof body['action'] === 'string' ? body['action'] : null;
      const hash   = typeof body['fileHashSha256'] === 'string' ? body['fileHashSha256'] : null;

      if (!action || !VALID_ACTIONS.has(action)) {
        return reply.status(400).send({ error: `action must be one of: ${[...VALID_ACTIONS].join(', ')}` });
      }

      // Resolve resource path
      const resource = await queryOne<{ resource_path: string | null }>(
        `SELECT resource_path FROM resources WHERE resource_id = ? AND tenant_id = ?`,
        [resourceId, user.tenantId],
      );
      if (!resource) return reply.status(404).send({ error: 'Resource not found' });

      const result = await processAccessEvent({
        tenantId:       user.tenantId,
        actorId:        user.sub,
        actorIp:        req.ip ?? '127.0.0.1',
        resourceId,
        resourcePath:   resource.resource_path ?? resourceId,
        action:         action as AccessAction,
        fileHashSha256: hash,
        sourceSystem:   'sdk',
      });

      return reply.status(result.outcome === 'DENIED' ? 403 : 200).send(result);
    },
  );

  // ── POST /api/v1/access-events/raw ──────────────────────────────────────────
  // Called by the local file watcher — uses shared secret, not JWT
  app.post(
    '/api/v1/access-events/raw',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (req.headers['x-watcher-secret'] !== WATCHER_SECRET()) {
        return reply.status(401).send({ error: 'Access Denied' });
      }

      const body         = req.body as Record<string, unknown>;
      const filePath     = typeof body['filePath']        === 'string' ? body['filePath']        : null;
      const action       = typeof body['action']          === 'string' ? body['action']          : 'write';
      const fileHash     = typeof body['fileHashSha256']  === 'string' ? body['fileHashSha256']  : null;
      const actorId      = typeof body['actorId']         === 'string' ? body['actorId']         : null;
      const tenantId     = typeof body['tenantId']        === 'string' ? body['tenantId']        : DEFAULT_TENANT();

      if (!filePath) return reply.status(400).send({ error: 'filePath required' });

      // Try to match path to a registered resource
      const resource = await queryOne<{ resource_id: string }>(
        `SELECT resource_id FROM resources
         WHERE tenant_id = ? AND resource_path = ?
         LIMIT 1`,
        [tenantId, filePath],
      );

      const result = await processAccessEvent({
        tenantId,
        actorId,
        actorIp:        '127.0.0.1',
        resourceId:     resource?.resource_id ?? null,
        resourcePath:   filePath,
        action:         (VALID_ACTIONS.has(action) ? action : 'write') as AccessAction,
        fileHashSha256: fileHash,
        sourceSystem:   'watcher',
      });

      return reply.status(201).send(result);
    },
  );

  // ── GET /api/v1/resources/:id/access-events ─────────────────────────────────
  app.get(
    '/api/v1/resources/:id/access-events',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { id: resourceId } = req.params as { id: string };
      const qs    = req.query as Record<string, string>;
      const limit = Math.min(parseInt(qs['limit'] ?? '50', 10), 200);

      const rows = await query<AuditRow>(
        `SELECT ae.log_id, ae.occurred_at, ae.event_type,
                ae.account_id, acc.username AS actor_username,
                ae.source_ip, ae.outcome, ae.denial_reason
         FROM audit_events ae
         LEFT JOIN accounts acc ON acc.account_id = ae.account_id
         WHERE ae.tenant_id = ? AND ae.resource_id = ?
         ORDER BY ae.occurred_at DESC
         LIMIT ?`,
        [user.tenantId, resourceId, limit],
      );

      return reply.send(rows.map((r) => ({
        id:           r.log_id,
        occurredAt:   r.occurred_at,
        eventType:    r.event_type,
        actorId:      r.account_id,
        actorUsername: r.actor_username,
        sourceIp:     r.source_ip,
        outcome:      r.outcome,
        detail:       (() => { try { return JSON.parse(r.denial_reason ?? '{}') as unknown; } catch { return {}; } })(),
      })));
    },
  );

  // ── GET /api/v1/resources/:id/acl ───────────────────────────────────────────
  app.get(
    '/api/v1/resources/:id/acl',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { id: resourceId } = req.params as { id: string };

      const rows = await query<AclRow>(
        `SELECT a.acl_id, a.grantee_type, a.grantee_id,
                acc.username AS grantee_username,
                a.permitted_actions, a.granted_at, a.status,
                gb.username AS granted_by_username
         FROM acl_entries a
         LEFT JOIN accounts acc ON acc.account_id = a.grantee_id
         LEFT JOIN accounts gb  ON gb.account_id  = a.granted_by
         WHERE a.resource_id = ? AND a.tenant_id = ?
         ORDER BY a.granted_at DESC`,
        [resourceId, user.tenantId],
      );

      return reply.send(rows.map((r) => ({
        id:               r.acl_id,
        granteeType:      r.grantee_type,
        granteeId:        r.grantee_id,
        granteeUsername:  r.grantee_username,
        permittedActions: (() => { try { return JSON.parse(r.permitted_actions) as string[]; } catch { return []; } })(),
        grantedAt:        r.granted_at,
        status:           r.status,
        grantedBy:        r.granted_by_username,
      })));
    },
  );

  // ── POST /api/v1/resources/:id/acl ──────────────────────────────────────────
  app.post(
    '/api/v1/resources/:id/acl',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });
      if (user.role !== 'ADMIN') return reply.status(403).send({ error: 'Access Denied' });

      const { id: resourceId } = req.params as { id: string };
      const body    = req.body as Record<string, unknown>;
      const granteeId = typeof body['accountId'] === 'string' ? body['accountId'] : null;
      const actions   = Array.isArray(body['actions']) ? (body['actions'] as string[]) : null;

      if (!granteeId || !actions || actions.length === 0) {
        return reply.status(400).send({ error: 'accountId and actions[] required' });
      }

      // Validate all actions
      const invalid = actions.filter((a) => !VALID_ACTIONS.has(a));
      if (invalid.length > 0) {
        return reply.status(400).send({ error: `Invalid actions: ${invalid.join(', ')}` });
      }

      // Check resource belongs to tenant
      const resource = await queryOne<{ resource_id: string }>(
        `SELECT resource_id FROM resources WHERE resource_id = ? AND tenant_id = ?`,
        [resourceId, user.tenantId],
      );
      if (!resource) return reply.status(404).send({ error: 'Resource not found' });

      const aclId = uuidv4();
      await execute(
        `INSERT INTO acl_entries
           (acl_id, tenant_id, resource_id, grantee_type, grantee_id, permitted_actions, granted_by, status)
         VALUES (?, ?, ?, 'ACCOUNT', ?, ?, ?, 'ACTIVE')`,
        [aclId, user.tenantId, resourceId, granteeId, JSON.stringify(actions), user.sub],
      );

      return reply.status(201).send({ id: aclId, accountId: granteeId, actions, status: 'ACTIVE' });
    },
  );

  // ── DELETE /api/v1/resources/:id/acl/:aclId ─────────────────────────────────
  app.delete(
    '/api/v1/resources/:id/acl/:aclId',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });
      if (user.role !== 'ADMIN') return reply.status(403).send({ error: 'Access Denied' });

      const { id: resourceId, aclId } = req.params as { id: string; aclId: string };

      await execute(
        `UPDATE acl_entries SET status = 'REVOKED', revoked_at = NOW(), revoked_by = ?
         WHERE acl_id = ? AND resource_id = ? AND tenant_id = ?`,
        [user.sub, aclId, resourceId, user.tenantId],
      );

      return reply.send({ id: aclId, status: 'REVOKED' });
    },
  );
}
