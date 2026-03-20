/**
 * Network Zone Routes
 *
 * GET    /api/v1/zones      — list all zones for tenant
 * POST   /api/v1/zones      — create zone
 * DELETE /api/v1/zones/:id  — remove zone
 *
 * Schema (migration 004): zone_id, tenant_id, zone_name, cidr, created_by, created_at
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne, execute } from '../db/mysql';
import { authenticate } from '../middleware/authenticate';
import { writeAuditEvent } from '../lib/audit';

interface ZoneRow {
  zone_id: string;
  zone_name: string;
  cidr: string;
  created_at: Date;
}

export async function zoneRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/v1/zones
  app.get(
    '/api/v1/zones',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const rows = await query<ZoneRow>(
        `SELECT zone_id, zone_name, cidr, created_at
         FROM network_zones
         WHERE tenant_id = ?
         ORDER BY created_at DESC`,
        [user.tenantId],
      );

      return reply.send(rows.map((r) => ({
        id:        r.zone_id,
        name:      r.zone_name,
        cidr:      r.cidr,
        createdAt: r.created_at,
      })));
    },
  );

  // POST /api/v1/zones
  app.post(
    '/api/v1/zones',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const body = req.body as Record<string, unknown>;
      const name = typeof body['name'] === 'string' ? body['name'] : null;
      const cidr = typeof body['cidr'] === 'string' ? body['cidr'] : null;

      if (!name || !cidr) {
        return reply.status(400).send({ error: 'name and cidr are required' });
      }

      await execute(
        `INSERT INTO network_zones (tenant_id, zone_name, cidr, created_by) VALUES (?, ?, ?, ?)`,
        [user.tenantId, name, cidr, user.sub],
      );

      // Fetch the inserted row to get the generated zone_id
      const created = await queryOne<ZoneRow>(
        `SELECT zone_id, zone_name, cidr, created_at
         FROM network_zones
         WHERE tenant_id = ? AND zone_name = ? AND cidr = ?
         ORDER BY created_at DESC LIMIT 1`,
        [user.tenantId, name, cidr],
      );

      await writeAuditEvent({
        tenantId: user.tenantId, eventType: 'ZONE_CREATED',
        actorAccountId: user.sub, actorIp: req.ip ?? null, actorDeviceId: user.deviceId,
        resourceId: null, resourcePath: null, outcome: 'ALLOWED', layerFailed: null,
        detail: { zoneId: created?.zone_id, name, cidr }, severity: 'INFO', timestamp: new Date(),
      });

      return reply.status(201).send({
        id: created?.zone_id, name, cidr, createdAt: created?.created_at,
      });
    },
  );

  // DELETE /api/v1/zones/:id
  app.delete(
    '/api/v1/zones/:id',
    { preHandler: authenticate },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user;
      if (!user) return reply.status(401).send({ error: 'Access Denied' });

      const { id } = req.params as { id: string };

      const existing = await queryOne<{ zone_id: string }>(
        `SELECT zone_id FROM network_zones WHERE zone_id = ? AND tenant_id = ?`,
        [id, user.tenantId],
      );
      if (!existing) return reply.status(404).send({ error: 'Not found' });

      await execute(`DELETE FROM network_zones WHERE zone_id = ?`, [id]);

      await writeAuditEvent({
        tenantId: user.tenantId, eventType: 'ZONE_DELETED',
        actorAccountId: user.sub, actorIp: req.ip ?? null, actorDeviceId: user.deviceId,
        resourceId: null, resourcePath: null, outcome: 'ALLOWED', layerFailed: null,
        detail: { zoneId: id }, severity: 'HIGH', timestamp: new Date(),
      });

      return reply.send({ id, deleted: true });
    },
  );
}
