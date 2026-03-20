import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { testConnection } from '../db/mysql';

interface HealthResponse {
  status: 'ok' | 'degraded';
  mysql: 'connected' | 'disconnected';
  cache: string;
  timestamp: string;
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/v1/health',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const dbOk = await testConnection();

      const result: HealthResponse = {
        status:    dbOk ? 'ok' : 'degraded',
        mysql:     dbOk ? 'connected' : 'disconnected',
        cache:     'in-memory (node-cache)',
        timestamp: new Date().toISOString(),
      };

      return reply.status(dbOk ? 200 : 503).send(result);
    },
  );
}
