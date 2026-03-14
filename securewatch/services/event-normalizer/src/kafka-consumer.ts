/**
 * Kafka consumer for the Event Normalizer service.
 * Consumes raw events, normalises to UniversalEvent, republishes to typed topics.
 */

import { Kafka, type Consumer, type Producer } from 'kafkajs';

let consumer: Consumer | null = null;
let producer: Producer | null = null;

export async function createConsumerAndProducer(brokers: string): Promise<{ consumer: Consumer; producer: Producer }> {
  const kafka = new Kafka({
    clientId: 'event-normalizer',
    brokers: brokers.split(','),
    ssl: process.env['NODE_ENV'] === 'production',
  });

  consumer = kafka.consumer({ groupId: 'sw-event-normalizer-raw' });
  producer = kafka.producer({ allowAutoTopicCreation: false });

  await consumer.connect();
  await producer.connect();

  return { consumer, producer };
}

export async function disconnect(): Promise<void> {
  await consumer?.disconnect();
  await producer?.disconnect();
}
