import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { writeAuditEvent } from '../lib/audit';
import { v4 as uuidv4 } from 'uuid';

interface ResourceRow {
  resource_id: string;
  resource_name: string;
  resource_path: string | null;
  resource_type: string;
  owner_account_id: string | null;
  owner_username: string | null;
  ownership_status: string;
  current_flag: string;
  last_event_at: Date | null;
  created_at: Date;
  acl_count: number;
}

export async function resourceRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/resources
  app.get(
    '/api/v1/resources',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const rows = await query<ResourceRow>(
        `SELECT r.resource_id, r.resource_name, r.resource_path, r.resource_type,
                r.owner_account_id, acc.username AS owner_username,
                r.ownership_status, r.current_flag, r.last_event_at, r.created_at,
                COUNT(a.acl_id) AS acl_count
         FROM resources r
         LEFT JOIN accounts acc ON acc.account_id = r.owner_account_id
         LEFT JOIN acl_entries a ON a.resource_id = r.resource_id AND a.status = 'ACTIVE'
         WHERE r.tenant_id = ?
         GROUP BY r.resource_id
         ORDER BY r.created_at DESC`,
        [user.tenantId],
      );

      return reply.send(rows.map((r) => ({
        id:             r.resource_id,
        name:           r.resource_name,
        path:           r.resource_path,
        type:           r.resource_type,
        ownerId:        r.owner_account_id,
        ownerUsername:  r.owner_username,
        status:         r.ownership_status,
        currentFlag:    r.current_flag ?? 'CLEAN',
        lastEventAt:    r.last_event_at ?? null,
        createdAt:      r.created_at,
        aclCount:       Number(r.acl_count),
      })));
    },
  );

  // POST /api/v1/resources
  app.post(
    '/api/v1/resources',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const body = req.body as Record<string, unknown>;
      const name    = typeof body['name']    === 'string' ? body['name']    : null;
      const path    = typeof body['path']    === 'string' ? body['path']    : null;
      const type    = typeof body['type']    === 'string' ? body['type']    : 'FILE';
      const ownerId = typeof body['ownerId'] === 'string' ? body['ownerId'] : user.sub;

      if (!name) return reply.status(400).send({ error: 'name is required' });

      const resourceId = uuidv4();

      await execute(
        `INSERT INTO resources
           (resource_id, tenant_id, resource_name, resource_path, resource_type, owner_account_id, ownership_status)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [resourceId, user.tenantId, name, path, type, ownerId],
      );

      await writeAuditEvent({
        tenantId:       user.tenantId,
        eventType:      'RESOURCE_CREATED',
        actorAccountId: user.sub,
        actorIp:        req.ip ?? null,
        actorDeviceId:  user.deviceId,
        resourceId,
        resourcePath:   path,
        outcome:        'ALLOWED',
        layerFailed:    null,
        detail:         { name, type },
        severity:       'INFO',
        timestamp:      new Date(),
      });

      return reply.status(201).send({ id: resourceId, name, path, type, ownerId, status: 'ACTIVE' });
    },
  );
}
