/**
 * Event Normalizer service — Phase 1, build priority 2.
 * Consumes raw events from Integration Layer via Kafka,
 * normalises to UniversalEvent schema, republishes to typed topics.
 * TDD section 4.
 */

import 'dotenv/config';
import { createConsumerAndProducer, disconnect } from './kafka-consumer.js';
import { normalizeEvent } from './normalizer.js';
import type { UniversalEvent, SourceType } from '@securewatch/types';

const TOPICS = {
  SESSION:     'sw.events.session',
  RESOURCE:    'sw.events.resource',
  INTEGRATION: 'sw.events.integration',
  SYSTEM:      'sw.events.system',
} as const;

function topicForCategory(category: UniversalEvent['event_category']): string {
  switch (category) {
    case 'SESSION':     return TOPICS.SESSION;
    case 'RESOURCE':    return TOPICS.RESOURCE;
    case 'INTEGRATION': return TOPICS.INTEGRATION;
    case 'SYSTEM':      return TOPICS.SYSTEM;
  }
}

async function main(): Promise<void> {
  const kafkaBrokers = process.env['KAFKA_BROKERS'];
  if (!kafkaBrokers) throw new Error('KAFKA_BROKERS must be set');

  const { consumer, producer } = await createConsumerAndProducer(kafkaBrokers);

  // Subscribe to raw integration events
  await consumer.subscribe({ topic: 'sw.events.integration', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const raw = message.value.toString();

      // Parse the envelope written by integration-layer
      let envelope: {
        source_id?: string;
        source_type?: string;
        tenant_id?: string;
        payload?: string;
        received_at?: string;
      };
      try {
        envelope = JSON.parse(raw) as typeof envelope;
      } catch {
        return; // Malformed envelope — discard silently
      }

      const payload = envelope.payload ?? raw;
      const sourceId = envelope.source_id ?? 'unknown';
      const sourceType = (envelope.source_type ?? 'API') as SourceType;
      const tenantId = envelope.tenant_id ?? 'unknown';
      const receivedAt = envelope.received_at ? new Date(envelope.received_at) : new Date();

      // Sandboxed normalisation — malformed events never reach Kafka
      let event: UniversalEvent;
      try {
        event = normalizeEvent(payload, sourceId, sourceType, tenantId, receivedAt);
      } catch {
        return; // Sandboxed — never propagate
      }

      const topic = topicForCategory(event.event_category);
      await producer.send({
        topic,
        messages: [{
          key: event.account_id ?? event.resource_id ?? event.tenant_id,
          value: JSON.stringify(event),
        }],
      });
    },
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`Received ${signal} — shutting down event-normalizer`);
    await disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));

  console.log('Event Normalizer running');
}

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
