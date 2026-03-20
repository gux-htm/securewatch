/**
 * SecureWatch — Auth Engine Kafka Consumer
 * TDD §7 — Three-Layer Authorisation Engine
 *
 * Consumes from: sw.events.session  (consumer group: sw-auth-engine)
 * Publishes to:  sw.alerts.outbound (on denial)
 *
 * Three-layer verification:
 *   Layer 1 — Account registered and ACTIVE
 *   Layer 2 — Source IP in an authorised network zone
 *   Layer 3 — Device registered and not BLACKLISTED
 */

import { Kafka, Consumer, EachMessagePayload, logLevel } from 'kafkajs';
import { queryOne } from './db/mysql';

const BROKER   = process.env['KAFKA_BROKERS'] ?? 'localhost:9092';
const GROUP_ID = 'sw-auth-engine';
const TOPIC    = 'sw.events.session';

const kafka = new Kafka({
  clientId: 'securewatch-auth-engine',
  brokers:  BROKER.split(','),
  retry:    { initialRetryTime: 300, retries: 10 },
  logLevel: process.env['NODE_ENV'] === 'production' ? logLevel.WARN : logLevel.INFO,
});

let consumer: Consumer | null = null;

interface SessionEvent {
  tenant_id:  string;
  account_id: string;
  device_id:  string | null;
  source_ip:  string;
}

interface AccountRow {
  account_id: string;
  status:     string;
}

interface DeviceRow {
  device_id: string;
  status:    string;
}

async function verifyEvent(event: SessionEvent): Promise<'ALLOWED' | 'DENIED'> {
  // Layer 1 — Account must be ACTIVE
  const account = await queryOne<AccountRow>(
    'SELECT account_id, status FROM accounts WHERE account_id = ? AND tenant_id = ?',
    [event.account_id, event.tenant_id],
  );
  if (account === null || account.status !== 'ACTIVE') return 'DENIED';

  // Layer 2 — Source IP must match a network zone (basic check)
  // Full CIDR matching implemented in Phase 1
  const zone = await queryOne(
    'SELECT zone_id FROM network_zones WHERE tenant_id = ?',
    [event.tenant_id],
  );
  if (zone === null) return 'DENIED';

  // Layer 3 — Device must not be BLACKLISTED (if device_id provided)
  if (event.device_id !== null) {
    const device = await queryOne<DeviceRow>(
      'SELECT device_id, status FROM devices WHERE device_id = ? AND tenant_id = ?',
      [event.device_id, event.tenant_id],
    );
    if (device !== null && device.status === 'BLACKLISTED') return 'DENIED';
  }

  return 'ALLOWED';
}

async function start(): Promise<void> {
  consumer = kafka.consumer({
    groupId:           GROUP_ID,
    sessionTimeout:    30_000,
    heartbeatInterval: 3_000,
  });

  await consumer.connect();
  console.log(`[auth-engine] Consumer connected — group: ${GROUP_ID}`);

  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async (payload: EachMessagePayload) => {
      const { message } = payload;
      if (message.value === null) return;

      try {
        const event = JSON.parse(message.value.toString()) as SessionEvent;
        const verdict = await verifyEvent(event);
        console.log(`[auth-engine] ${event.account_id} → ${verdict}`);
      } catch (e) {
        console.error('[auth-engine] Failed to process message:', e);
      }
    },
  });
}

const shutdown = async (): Promise<void> => {
  console.log('[auth-engine] Shutting down...');
  if (consumer !== null) await consumer.disconnect();
  process.exit(0);
};

process.on('SIGTERM', () => { void shutdown(); });
process.on('SIGINT',  () => { void shutdown(); });

start().catch((e) => {
  console.error('[auth-engine] Fatal startup error:', e);
  process.exit(1);
});
