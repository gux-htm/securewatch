import { Kafka, Producer, RecordMetadata } from 'kafkajs';
import type { UniversalEvent } from '@securewatch/types';

// Kafka topic names per steering file 02
export const TOPICS = {
  SESSION:     'sw.events.session',
  RESOURCE:    'sw.events.resource',
  INTEGRATION: 'sw.events.integration',
  SYSTEM:      'sw.events.system',
  ALERTS:      'sw.alerts.outbound',
} as const;

let producer: Producer | null = null;

export async function createProducer(brokers: string): Promise<Producer> {
  const kafka = new Kafka({
    clientId: 'integration-layer',
    brokers: brokers.split(','),
    ssl: process.env['NODE_ENV'] === 'production',
  });

  producer = kafka.producer({
    allowAutoTopicCreation: false,
    transactionTimeout: 30000,
  });

  await producer.connect();
  return producer;
}

export async function publishEvent(event: UniversalEvent): Promise<RecordMetadata[]> {
  if (!producer) {
    throw new Error('Kafka producer not initialised');
  }

  const topic = topicForCategory(event.event_category);
  const partitionKey = event.account_id ?? event.resource_id ?? event.tenant_id;

  const result = await producer.send({
    topic,
    messages: [{
      key: partitionKey,
      value: JSON.stringify(event),
    }],
  });

  return result;
}

function topicForCategory(category: UniversalEvent['event_category']): string {
  switch (category) {
    case 'SESSION':     return TOPICS.SESSION;
    case 'RESOURCE':    return TOPICS.RESOURCE;
    case 'INTEGRATION': return TOPICS.INTEGRATION;
    case 'SYSTEM':      return TOPICS.SYSTEM;
  }
}

export async function disconnectProducer(): Promise<void> {
  await producer?.disconnect();
}
