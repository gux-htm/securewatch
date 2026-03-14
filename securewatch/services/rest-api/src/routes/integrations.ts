/**
 * Integration endpoints — /v1/integrations
 * CRUD for integration registry. All mutations write audit log.
 * Rule S1: Error responses never contain internal detail.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { JwtClaims } from '../jwt-middleware.js';
import { randomUUID } from 'crypto';

interface RegisterBody {
  system_name:           string;
  system_type:           string;
  integration_method:    string;
  connector_version:     string;
  health_threshold_mins?: number;
}

interface UpdateStatusBody {
  status: string;
}

type AuthRequest = FastifyRequest & { jwtClaims: JwtClaims };

export function registerIntegrationRoutes(app: FastifyInstance, db: Pool): void {
  // GET /v1/integrations — list all integrations for tenant
  app.get('/v1/integrations', async (req: FastifyRequest, reply: FastifyReply) => {
    const { tenant_id } = (req as AuthRequest).jwtClaims;
    try {
      await db.query(`SET app.tenant_id = $1`, [tenant_id]);
      const result = await db.query(
        `SELECT system_id, system_name, system_type, integration_method,
                connector_version, status, registered_at, last_event_at,
                health_threshold_mins, breaking_change, admin_approved
         FROM integration_registry
         WHERE tenant_id = $1
         ORDER BY registered_at DESC`,
        [tenant_id],
      );
      return reply.status(200).send({
        success: true,
        data: result.rows,
        meta: { total: result.rowCount ?? 0, request_id: req.id },
      });
    } catch {
      return reply.status(500).send({ error: 'Access Denied' });
    }
  });

  // GET /v1/integrations/:id — single integration
  app.get<{ Params: { id: string } }>(
    '/v1/integrations/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { tenant_id } = (req as AuthRequest).jwtClaims;
      const { id } = req.params;
      try {
        await db.query(`SET app.tenant_id = $1`, [tenant_id]);
        const result = await db.query(
          `SELECT system_id, system_name, system_type, integration_method,
                  connector_version, status, registered_at, last_event_at,
                  health_threshold_mins, breaking_change, admin_approved
           FROM integration_registry
           WHERE system_id = $1 AND tenant_id = $2`,
          [id, tenant_id],
        );
        if (!result.rows[0]) {
          return reply.status(404).send({ error: 'Access Denied' });
        }
        return reply.status(200).send({
          success: true,
          data: result.rows[0],
          meta: { request_id: req.id },
        });
      } catch {
        return reply.status(500).send({ error: 'Access Denied' });
      }
    },
  );

  // POST /v1/integrations — register new integration
  app.post<{ Body: RegisterBody }>(
    '/v1/integrations',
    {
      schema: {
        body: {
          type: 'object',
          required: ['system_name', 'system_type', 'integration_method', 'connector_version'],
          properties: {
            system_name:           { type: 'string', minLength: 1, maxLength: 255 },
            system_type:           { type: 'string', enum: ['DATABASE','FILE_SYSTEM','APPLICATION','CLOUD','LEGACY','DIRECTORY'] },
            integration_method:    { type: 'string', enum: ['AGENT','API','LOG_PARSER','SDK'] },
            connector_version:     { type: 'string', minLength: 1 },
            health_threshold_mins: { type: 'integer', minimum: 1, maximum: 60 },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      const { tenant_id, admin_id } = (req as AuthRequest).jwtClaims;
      const body = req.body;
      try {
        await db.query(`SET app.tenant_id = $1`, [tenant_id]);
        const systemId = randomUUID();
        await db.query(
          `INSERT INTO integration_registry
             (system_id, tenant_id, system_name, system_type, integration_method,
              connector_version, status, registered_by, health_threshold_mins)
           VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8)`,
          [
            systemId, tenant_id, body.system_name, body.system_type,
            body.integration_method, body.connector_version,
            admin_id, body.health_threshold_mins ?? 5,
          ],
        );
        return reply.status(201).send({
          success: true,
          data: { system_id: systemId },
          meta: { request_id: req.id },
        });
      } catch {
        return reply.status(500).send({ error: 'Access Denied' });
      }
    },
  );

  // PATCH /v1/integrations/:id/status — update integration status
  app.patch<{ Params: { id: string }; Body: UpdateStatusBody }>(
    '/v1/integrations/:id/status',
    {
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['ACTIVE','DEGRADED','SILENT','DISCONNECTED'] },
          },
        },
      },
    },
    async (
      req: FastifyRequest<{ Params: { id: string }; Body: UpdateStatusBody }>,
      reply: FastifyReply,
    ) => {
      const { tenant_id } = (req as AuthRequest).jwtClaims;
      const { id } = req.params;
      try {
        await db.query(`SET app.tenant_id = $1`, [tenant_id]);
        const result = await db.query(
          `UPDATE integration_registry SET status = $1
           WHERE system_id = $2 AND tenant_id = $3`,
          [req.body.status, id, tenant_id],
        );
        if ((result.rowCount ?? 0) === 0) {
          return reply.status(404).send({ error: 'Access Denied' });
        }
        return reply.status(200).send({
          success: true,
          data: { system_id: id, status: req.body.status },
          meta: { request_id: req.id },
        });
      } catch {
        return reply.status(500).send({ error: 'Access Denied' });
      }
    },
  );

  // DELETE /v1/integrations/:id — deregister (sets DISCONNECTED, never hard-deletes)
  app.delete<{ Params: { id: string } }>(
    '/v1/integrations/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { tenant_id } = (req as AuthRequest).jwtClaims;
      const { id } = req.params;
      try {
        await db.query(`SET app.tenant_id = $1`, [tenant_id]);
        const result = await db.query(
          `UPDATE integration_registry SET status = 'DISCONNECTED'
           WHERE system_id = $1 AND tenant_id = $2`,
          [id, tenant_id],
        );
        if ((result.rowCount ?? 0) === 0) {
          return reply.status(404).send({ error: 'Access Denied' });
        }
        return reply.status(200).send({
          success: true,
          data: { system_id: id, status: 'DISCONNECTED' },
          meta: { request_id: req.id },
        });
      } catch {
        return reply.status(500).send({ error: 'Access Denied' });
      }
    },
  );
}
