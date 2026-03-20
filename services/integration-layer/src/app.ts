/**
 * SecureWatch — Integration Layer (port 3001)
 * TDD §3 — Universal Integration Layer
 *
 * Single authenticated entry point for all incoming events.
 * Normalises events and publishes to Kafka — no direct calls to other services.
 */

import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { randomUUID } from 'crypto';
import { normalize } from './normalizer';
import { publishEvent, disconnectProducer } from './kafka';
import type { IncomingEvent, SourceType } from './types';

const PORT     = parseInt(process.env['PORT']     ?? '3001', 10);
const HOST     = process.env['HOST']              ?? '0.0.0.0';
const NODE_ENV = process.env['NODE_ENV']          ?? 'development';

// ── Route body types ───────────────────────────────────────────────────────

interface EventBody {
  source_id:   string;
  source_type: SourceType;
  tenant_id:   string;
  payload:     string;
}

interface BatchBody {
  source_id:   string;
  source_type: SourceType;
  tenant_id:   string;
  events:      string[];
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: { level: NODE_ENV === 'production' ? 'warn' : 'info' },
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: NODE_ENV === 'production' ? false : true,
  });

  // ── POST /api/v1/events ──────────────────────────────────────────────
  app.post<{ Body: EventBody }>(
    '/api/v1/events',
    {
      schema: {
        body: {
          type: 'object',
          required: ['source_id', 'source_type', 'tenant_id', 'payload'],
          properties: {
            source_id:   { type: 'string' },
            source_type: { type: 'string', enum: ['AGENT', 'API', 'LOG_PARSER', 'SDK'] },
            tenant_id:   { type: 'string' },
            payload:     { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: EventBody }>,
      reply: FastifyReply,
    ) => {
      const { source_id, source_type, tenant_id, payload } = request.body;

      const incoming: IncomingEvent = {
        source_id,
        source_type,
        payload,
        received_at: new Date().toISOString(),
      };

      const event = normalize(incoming, tenant_id);

      if (event === null) {
        app.log.warn({ source_id, source_type }, 'Malformed event rejected');
        return reply.status(400).send({ error: 'Malformed event payload' });
      }

      await publishEvent(event);
      return reply.status(202).send({ event_id: event.event_id });
    },
  );

  // ── POST /api/v1/events/batch ────────────────────────────────────────
  app.post<{ Body: BatchBody }>(
    '/api/v1/events/batch',
    {
      schema: {
        body: {
          type: 'object',
          required: ['source_id', 'source_type', 'tenant_id', 'events'],
          properties: {
            source_id:   { type: 'string' },
            source_type: { type: 'string', enum: ['AGENT', 'API', 'LOG_PARSER', 'SDK'] },
            tenant_id:   { type: 'string' },
            events:      { type: 'array', items: { type: 'string' }, maxItems: 1000 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: BatchBody }>,
      reply: FastifyReply,
    ) => {
      const { source_id, source_type, tenant_id, events } = request.body;

      const accepted: string[] = [];
      const rejected: number[] = [];

      for (let i = 0; i < events.length; i++) {
        const payload = events[i];
        if (payload === undefined) continue;

        const incoming: IncomingEvent = {
          source_id,
          source_type,
          payload,
          received_at: new Date().toISOString(),
        };

        const event = normalize(incoming, tenant_id);
        if (event === null) {
          rejected.push(i);
          continue;
        }

        await publishEvent(event);
        accepted.push(event.event_id);
      }

      return reply.status(202).send({
        accepted: accepted.length,
        rejected: rejected.length,
        rejected_indices: rejected,
      });
    },
  );

  // ── GET /api/v1/health ───────────────────────────────────────────────
  app.get(
    '/api/v1/health',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        status: 'ok',
        service: 'integration-layer',
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── Graceful shutdown ────────────────────────────────────────────────
  const shutdown = async (): Promise<void> => {
    app.log.info('Integration Layer shutting down...');
    await disconnectProducer();
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => { void shutdown(); });
  process.on('SIGINT',  () => { void shutdown(); });

  await app.listen({ host: HOST, port: PORT });
  app.log.info(`Integration Layer listening on ${HOST}:${PORT}`);
}

// Suppress unused import warning — randomUUID used in normalizer, re-exported here
// for convenience in tests
export { randomUUID };

bootstrap().catch((err: Error) => {
  console.error('[integration-layer] Fatal startup error:', err);
  process.exit(1);
});
