/**
 * REST API Gateway — Fastify app factory.
 * Port 3000. JWT (RS256) auth. /v1 prefix.
 * TDD section 13.
 */

import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';
import type { Pool } from 'pg';
import { jwtMiddleware } from './jwt-middleware.js';
import { registerIntegrationRoutes } from './routes/integrations.js';

export function buildApp(db: Pool): FastifyInstance {
  const app = Fastify({ logger: true, genReqId: () => crypto.randomUUID() });

  void app.register(helmet);

  // Health probe — no auth
  app.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ status: 'ok', service: 'rest-api' });
  });

  // JWT auth hook — applied to all /v1/* routes
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url.startsWith('/v1/')) {
      await jwtMiddleware(req, reply);
    }
  });

  // Register route groups
  registerIntegrationRoutes(app, db);

  // Global error handler — Rule S1: never expose internal detail
  app.setErrorHandler((err, _req, reply) => {
    // Fastify schema validation errors are 400 — pass through status code
    if (err.statusCode === 400) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' },
      });
    }
    return reply.status(500).send({ error: 'Access Denied' });
  });

  return app;
}
