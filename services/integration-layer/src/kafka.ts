/**
 * Kafka client for the Integration Layer.
 * Publishes normalised UniversalEvents to the correct topic based on category.
 */

import { Kafka, Producer, CompressionTypes, logLevel } from 'kafkajs';
import { UniversalEvent, TOPICS } from './types';

const kafka = new Kafka({
  clientId: process.env['KAFKA_CLIENT_ID'] ?? 'securewatch-integration-layer',
  brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
  retry: { initialRetryTime: 300, retries: 10 },
  logLevel:
    process.env['NODE_ENV'] === 'production' ? logLevel.WARN : logLevel.INFO,
});

let _producer: Producer | null = null;

export async function getProducer(): Promise<Producer> {
  if (_producer !== null) return _producer;
  _producer = kafka.producer({ idempotent: true });
  await _producer.connect();
  console.log('[integration-layer:kafka] Producer connected');
  return _producer;
}

export async function disconnectProducer(): Promise<void> {
  if (_producer !== null) {
    await _producer.disconnect();
    _producer = null;
  }
}

/**
 * Routes a normalised event to the correct Kafka topic based on event_category.
 * Partition key is chosen per TDD §5.1.
 */
export async function publishEvent(event: UniversalEvent): Promise<void> {
  const producer = await getProducer();

  let topic: string;
  let partitionKey: string;

  switch (event.event_category) {
    case 'SESSION':
      topic = TOPICS.sessionEvents;
      partitionKey = event.account_id ?? event.event_id;
      break;
    case 'RESOURCE':
      topic = TOPICS.resourceEvents;
      partitionKey = event.resource_id ?? event.event_id;
      break;
    case 'INTEGRATION':
      topic = TOPICS.integrationEvents;
      partitionKey = event.source_system;
      break;
    case 'SYSTEM':
      topic = TOPICS.systemEvents;
      partitionKey = event.tenant_id;
      break;
  }

  await producer.send({
    topic,
    compression: CompressionTypes.LZ4,
    messages: [
      {
        key: partitionKey,
        value: JSON.stringify(event),
        headers: {
          source_type: event.source_type,
          tenant_id:   event.tenant_id,
          event_id:    event.event_id,
        },
      },
    ],
  });
}
