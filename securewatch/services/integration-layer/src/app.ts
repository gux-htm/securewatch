/**
 * Fastify application — Universal Integration Layer.
 * Port 3001. Authenticated entry point for all incoming events.
 * TDD section 3.
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import type { Producer } from 'kafkajs';

import { IntegrationRegistry } from './integration-registry.js';
import { authenticateSource } from './source-auth.js';
import { checkRateLimit } from './rate-limiter.js';
import { normalizeEvent } from './event-normalizer.js';
import { publishEvent } from './kafka-producer.js';
import { writeAuditEntry } from './audit-log.js';

interface EventBody {
  payload: string; // Raw event string
}

export function buildApp(db: Pool, redis: Redis, _producer: Producer): FastifyInstance {
  const app = Fastify({ logger: true });
  const registry = new IntegrationRegistry(db, redis);

  void app.register(helmet);

  // Health probe — no auth required
  app.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ status: 'ok', service: 'integration-layer' });
  });

  // ── POST /v1/events ────────────────────────────────────────────────────
  // Accepts events from all source types (AGENT, API, LOG_PARSER, SDK).
  app.post<{ Body: EventBody }>(
    '/v1/events',
    {
      schema: {
        body: {
          type: 'object',
          required: ['payload'],
          properties: {
            payload: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: EventBody }>, reply: FastifyReply) => {
      const receivedAt = new Date();

      // ── Step 1: Source authentication (Rule S9) ──────────────────────
      const auth = await authenticateSource(req, registry).catch(() => null);

      if (!auth) {
        // Rule S9: reject before examining payload, fire C7, log with source IP
        await writeAuditEntry({
          tenant_id:      'unknown',
          event_category: 'SYSTEM',
          event_type:     'UNREGISTERED_SOURCE_ATTEMPT',
          source_ip:      req.ip,
          outcome:        'DENIED',
          severity:       'CRITICAL',
          // C7 alert will be fired by alert-manager consuming the audit event
        }).catch(() => undefined);

        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { system } = auth;

      // ── Step 2: Rate limiting (TDD 3.3) ─────────────────────────────
      const rateResult = await checkRateLimit(redis, system.system_id, system.integration_method);

      if (!rateResult.allowed) {
        // Excess events are dropped and logged — source is not blocked
        await writeAuditEntry({
          tenant_id:      system.tenant_id,
          event_category: 'SYSTEM',
          event_type:     'RATE_LIMIT_EXCEEDED',
          source_system:  system.system_id,
          outcome:        'DENIED',
          severity:       'MEDIUM',
        }).catch(() => undefined);

        return reply.status(429).send({ error: 'Rate limit exceeded' });
      }

      // ── Step 3: Normalize to Universal Event Schema (TDD 4) ──────────
      let event;
      try {
        event = normalizeEvent(
          req.body.payload,
          system.system_id,
          system.integration_method,
          system.tenant_id,
          receivedAt,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await writeAuditEntry({
          tenant_id:      system.tenant_id,
          event_category: 'SYSTEM',
          event_type:     'MALFORMED_EVENT_REJECTED',
          source_system:  system.system_id,
          outcome:        'DENIED',
          severity:       'HIGH',
          denial_reason:  message,
          raw_event:      req.body.payload.slice(0, 1000), // Truncate for safety
        }).catch(() => undefined);

        return reply.status(400).send({ error: 'Invalid event payload' });
      }

      // ── Step 4: Publish to Kafka ─────────────────────────────────────
      await publishEvent(event);

      // ── Step 5: Record event receipt for health monitoring ───────────
      await registry.recordEvent(system.system_id, system.tenant_id);

      return reply.status(202).send({
        success: true,
        data: { event_id: event.event_id },
        meta: { request_id: req.id },
      });
    }
  );

  // ── POST /v1/events/batch ──────────────────────────────────────────────
  // Batch ingestion for log parsers and SDK bulk sends.
  app.post<{ Body: { events: string[] } }>(
    '/v1/events/batch',
    {
      schema: {
        body: {
          type: 'object',
          required: ['events'],
          properties: {
            events: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              minItems: 1,
              maxItems: 1000,
            },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: { events: string[] } }>, reply: FastifyReply) => {
      const receivedAt = new Date();

      const auth = await authenticateSource(req, registry).catch(() => null);
      if (!auth) {
        await writeAuditEntry({
          tenant_id:      'unknown',
          event_category: 'SYSTEM',
          event_type:     'UNREGISTERED_SOURCE_ATTEMPT',
          source_ip:      req.ip,
          outcome:        'DENIED',
          severity:       'CRITICAL',
        }).catch(() => undefined);
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { system } = auth;
      const rateResult = await checkRateLimit(redis, system.system_id, system.integration_method);
      if (!rateResult.allowed) {
        return reply.status(429).send({ error: 'Rate limit exceeded' });
      }

      const accepted: string[] = [];
      const rejected: string[] = [];

      for (const rawPayload of req.body.events) {
        try {
          const event = normalizeEvent(
            rawPayload,
            system.system_id,
            system.integration_method,
            system.tenant_id,
            receivedAt,
          );
          await publishEvent(event);
          accepted.push(event.event_id);
        } catch {
          rejected.push(rawPayload.slice(0, 64));
        }
      }

      if (accepted.length > 0) {
        await registry.recordEvent(system.system_id, system.tenant_id);
      }

      return reply.status(202).send({
        success: true,
        data: { accepted: accepted.length, rejected: rejected.length },
        meta: { request_id: req.id },
      });
    }
  );

  return app;
}
