import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { v4 as uuidv4 } from 'uuid';

interface IntegrationRow {
  system_id: string;
  system_name: string;
  system_type: string;
  integration_method: string;
  connector_version: string;
  registered_at: Date;
  last_event_at: Date | null;
  health_threshold_mins: number;
}

function computeStatus(lastEventAt: Date | null, thresholdMins: number): string {
  if (!lastEventAt) return 'DISCONNECTED';
  const diffMins = (Date.now() - new Date(lastEventAt).getTime()) / 60000;
  if (diffMins < 2)             return 'ACTIVE';
  if (diffMins < thresholdMins) return 'DEGRADED';
  return 'SILENT';
}

export async function integrationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/integrations
  app.get(
    '/api/v1/integrations',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const rows = await query<IntegrationRow>(
        `SELECT system_id, system_name, system_type, integration_method,
                connector_version, registered_at, last_event_at, health_threshold_mins
         FROM integration_registry
         WHERE tenant_id = ?
         ORDER BY system_name ASC`,
        [user.tenantId],
      );

      return reply.send(rows.map((r) => ({
        id:          r.system_id,
        name:        r.system_name,
        type:        r.system_type,
        method:      r.integration_method,
        version:     r.connector_version,
        registeredAt: r.registered_at,
        lastEventAt: r.last_event_at,
        status:      computeStatus(r.last_event_at, r.health_threshold_mins),
      })));
    },
  );

  // POST /api/v1/integrations
  app.post(
    '/api/v1/integrations',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const body   = req.body as Record<string, unknown>;
      const name   = typeof body['name']   === 'string' ? body['name']   : null;
      const type   = typeof body['type']   === 'string' ? body['type']   : null;
      const method = typeof body['method'] === 'string' ? body['method'] : null;

      if (!name || !type || !method) {
        return reply.status(400).send({ error: 'name, type, and method are required' });
      }

      const systemId = uuidv4();

      await execute(
        `INSERT INTO integration_registry
           (system_id, tenant_id, system_name, system_type, integration_method, registered_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [systemId, user.tenantId, name, type, method, user.sub],
      );

      return reply.status(201).send({
        id: systemId, name, type, method,
        status: 'DISCONNECTED', lastEventAt: null,
      });
    },
  );
}
