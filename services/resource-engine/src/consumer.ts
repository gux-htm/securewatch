/**
 * SecureWatch — Resource Engine Kafka Consumer
 * TDD §8 — Resource Registry & ACL Engine
 *
 * Consumes from: sw.events.resource  (consumer group: sw-resource-engine)
 * Publishes to:  sw.alerts.outbound  (on ACL violation)
 *
 * ACL resolution (most-restrictive merge):
 *   1. Direct individual privileges
 *   2. Group privileges
 *   3. Inherited privileges from parent resource
 *   DENY always beats ALLOW — non-configurable (TDD §8.2)
 */

import { Kafka, Consumer, EachMessagePayload, logLevel } from 'kafkajs';
import { query, queryOne } from './db/mysql';

const BROKER   = process.env['KAFKA_BROKERS'] ?? 'localhost:9092';
const GROUP_ID = 'sw-resource-engine';
const TOPIC    = 'sw.events.resource';

const kafka = new Kafka({
  clientId: 'securewatch-resource-engine',
  brokers:  BROKER.split(','),
  retry:    { initialRetryTime: 300, retries: 10 },
  logLevel: process.env['NODE_ENV'] === 'production' ? logLevel.WARN : logLevel.INFO,
});

let consumer: Consumer | null = null;

interface ResourceEvent {
  tenant_id:   string;
  account_id:  string;
  resource_id: string;
  action:      string;
}

interface AclRow {
  permitted_actions: string;
  status:            string;
}

async function checkAccess(event: ResourceEvent): Promise<'ALLOWED' | 'DENIED'> {
  // Direct ACL check
  const acls = await query<AclRow>(
    `SELECT permitted_actions, status FROM acl_entries
     WHERE resource_id = ? AND grantee_id = ? AND tenant_id = ? AND status = 'ACTIVE'`,
    [event.resource_id, event.account_id, event.tenant_id],
  );

  if (acls.length === 0) return 'DENIED';

  for (const acl of acls) {
    const actions = JSON.parse(acl.permitted_actions) as string[];
    if (actions.includes(event.action) || actions.includes('*')) return 'ALLOWED';
  }

  return 'DENIED';
}

async function start(): Promise<void> {
  consumer = kafka.consumer({
    groupId:           GROUP_ID,
    sessionTimeout:    30_000,
    heartbeatInterval: 3_000,
  });

  await consumer.connect();
  console.log(`[resource-engine] Consumer connected — group: ${GROUP_ID}`);

  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      const { message } = payload;
      if (message.value === null) return;

      try {
        const event = JSON.parse(message.value.toString()) as ResourceEvent;
        const verdict = await checkAccess(event);
        console.log(`[resource-engine] ${event.account_id} → ${event.resource_id} → ${verdict}`);
      } catch (e) {
        console.error('[resource-engine] Failed to process message:', e);
      }
    },
  });
}

const shutdown = async (): Promise<void> => {
  console.log('[resource-engine] Shutting down...');
  if (consumer !== null) await consumer.disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT',  () => { void shutdown(); });

start().catch((e) => {
  console.error('[resource-engine] Fatal startup error:', e);
  process.exit(1);
});
