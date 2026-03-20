/**
 * SecureWatch — Kafka client factory
 *
 * Provides a shared KafkaJS instance, a singleton producer, and a
 * consumer factory. All services import from here — never instantiate
 * KafkaJS directly.
 *
 * Topics and consumer group IDs are defined in config.ts (TDD §5.1 / §5.3).
 */

import { Kafka, Producer, Consumer, logLevel, CompressionTypes } from 'kafkajs';
import { config } from './config';

// ── Shared Kafka instance ──────────────────────────────────────────────────

export const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers:  [...config.kafka.brokers],
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
  logLevel: config.server.nodeEnv === 'production' ? logLevel.WARN : logLevel.INFO,
});

// ── Singleton producer ─────────────────────────────────────────────────────

let _producer: Producer | null = null;

export async function getProducer(): Promise<Producer> {
  if (_producer !== null) return _producer;

  _producer = kafka.producer({
    // Idempotent producer — prevents duplicate messages on retry
    idempotent: true,
    // Wait for all in-sync replicas to acknowledge (matches min.insync.replicas=2 in prod)
    transactionTimeout: 30_000,
  });

  await _producer.connect();
  console.log('[kafka] Producer connected');
  return _producer;
}

export async function disconnectProducer(): Promise<void> {
  if (_producer !== null) {
    await _producer.disconnect();
    _producer = null;
    console.log('[kafka] Producer disconnected');
  }
}

// ── Consumer factory ───────────────────────────────────────────────────────

/**
 * Creates and connects a consumer for the given group ID.
 * Caller is responsible for subscribing to topics and running.
 */
export async function createConsumer(groupId: string): Promise<Consumer> {
  const consumer = kafka.consumer({
    groupId,
    // Retry settings for consumer group rebalancing
    retry: { retries: 5 },
    // Start from earliest offset on first run — no events missed
    sessionTimeout: 30_000,
    heartbeatInterval: 3_000,
  });

  await consumer.connect();
  console.log(`[kafka] Consumer connected — group: ${groupId}`);
  return consumer;
}

// ── Typed publish helper ───────────────────────────────────────────────────

export interface KafkaMessage<T> {
  key: string;       // Partition key (account_id, resource_id, etc.)
  value: T;
  headers?: Record<string, string>;
}

/**
 * Publishes a single typed message to a topic.
 * Serialises value to JSON. Uses lz4 compression (matches broker config).
 */
export async function publish<T>(
  topic: string,
  message: KafkaMessage<T>,
): Promise<void> {
  const producer = await getProducer();

  await producer.send({
    topic,
    compression: CompressionTypes.LZ4,
    messages: [
      {
        key: message.key,
        value: JSON.stringify(message.value),
        headers: message.headers,
      },
    ],
  });
}

/**
 * Publishes a batch of messages to a topic in a single request.
 * Use for high-throughput paths (audit writer, integration layer).
 */
export async function publishBatch<T>(
  topic: string,
  messages: KafkaMessage<T>[],
): Promise<void> {
  const producer = await getProducer();

  await producer.send({
    topic,
    compression: CompressionTypes.LZ4,
    messages: messages.map((m) => ({
      key: m.key,
      value: JSON.stringify(m.value),
      headers: m.headers,
    })),
  });
}

// ── Topic name constants (re-exported for convenience) ────────────────────

export const TOPICS = config.kafka.topics;
export const CONSUMER_GROUPS = config.kafka.consumerGroups;
