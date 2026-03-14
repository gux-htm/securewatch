/**
 * Kafka consumer — subscribes to sw.events.session via consumer group sw-auth-engine.
 * Runs three-layer verification on every session event.
 * Publishes verdict back to sw.events.session (updated outcome field).
 */

import { Kafka, type Consumer, type Producer } from 'kafkajs';
import type { UniversalEvent } from '@securewatch/types';
import type { VerificationEngine } from './verification-engine.js';

let consumer: Consumer | null = null;
let producer: Producer | null = null;

export async function createConsumerAndProducer(
  brokers: string,
): Promise<{ consumer: Consumer; producer: Producer }> {
  const kafka = new Kafka({
    clientId: 'auth-engine',
    brokers: brokers.split(','),
  });

  consumer = kafka.consumer({ groupId: 'sw-auth-engine' });
  producer = kafka.producer();

  await consumer.connect();
  await producer.connect();

  return { consumer, producer };
}

export async function startVerificationPipeline(
  consumer: Consumer,
  producer: Producer,
  engine: VerificationEngine,
): Promise<void> {
  await consumer.subscribe({ topic: 'sw.events.session', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      let event: UniversalEvent;
      try {
        event = JSON.parse(message.value.toString()) as UniversalEvent;
      } catch {
        return; // Malformed — discard
      }

      try {
        const result = await engine.verify(event);
        const enriched: UniversalEvent = {
          ...event,
          outcome: result.verdict === 'CLEAN' ? 'ALLOWED' : 'DENIED',
        };

        await producer.send({
          topic: 'sw.events.session',
          messages: [{
            key: event.account_id ?? event.tenant_id,
            value: JSON.stringify(enriched),
          }],
        });
      } catch {
        // Never crash the consumer on a single event failure
      }
    },
  });
}

export async function disconnect(): Promise<void> {
  await consumer?.disconnect();
  await producer?.disconnect();
}
