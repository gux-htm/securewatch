/**
 * Auth Engine server entry point — Port 3002.
 * Starts Kafka consumer pipeline + Fastify HTTP server.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { loadSecrets, fetchVaultSecret } from './vault-client.js';
import { initJwtIssuer } from './jwt-issuer.js';
import { VerificationEngine } from './verification-engine.js';
import { createConsumerAndProducer, startVerificationPipeline, disconnect } from './kafka-consumer.js';
import { IdentityCache, NetworkZoneResolver, ZoneStore } from '@securewatch/identity-registry';
import { buildApp } from './app.js';

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);

async function main(): Promise<void> {
  const secrets = await loadSecrets();

  initJwtIssuer(secrets.jwtPrivateKey);

  const db = new Pool({
    host: secrets.dbHost, port: secrets.dbPort,
    database: secrets.dbName, user: secrets.dbUser, password: secrets.dbPassword,
    max: 20,
    ssl: process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: true } : false,
  });

  const redis = new Redis({ host: secrets.redisHost, port: secrets.redisPort });

  const cache = new IdentityCache(redis);
  const resolver = new NetworkZoneResolver();

  // Load zones into resolver at startup (refreshed periodically)
  const zoneStore = new ZoneStore(db, cache, async () => undefined);
  const loadZones = async (): Promise<void> => {
    const tenants = await db.query<{ tenant_id: string }>(`SELECT tenant_id FROM tenants WHERE status = 'ACTIVE'`);
    for (const { tenant_id } of tenants.rows) {
      const zones = await zoneStore.list(tenant_id);
      resolver.load(zones.map(z => ({ zone_id: z.zone_id, zone_name: z.zone_name, cidr: z.cidr })));
    }
  };
  await loadZones();
  setInterval(() => void loadZones(), 60_000); // Refresh every 60s

  const auditWriter = async (entry: import('./types.js').AuditEntry): Promise<void> => {
    // Writes to TimescaleDB — simplified here; full HMAC implementation in integration-layer
    await db.query(
      `INSERT INTO audit_events (log_id, tenant_id, occurred_at, ingested_at,
        event_category, event_type, account_id, device_id, source_ip,
        outcome, failed_layer, denial_reason, risk_verdict, hmac_signature)
       VALUES (gen_random_uuid(),$1,NOW(),NOW(),$2,$3,$4,$5,$6,$7,$8,$9,$10,'placeholder')`,
      [
        entry.tenant_id, entry.event_category, entry.event_type,
        entry.account_id ?? null, entry.device_id ?? null, entry.source_ip ?? null,
        entry.outcome, entry.failed_layer ?? null, entry.denial_reason ?? null,
        entry.risk_verdict ?? null,
      ],
    );
  };

  const engine = new VerificationEngine(cache, resolver, auditWriter);
  const { consumer, producer } = await createConsumerAndProducer(secrets.kafkaBrokers);
  await startVerificationPipeline(consumer, producer, engine);

  const app = buildApp(db, redis, secrets.jwtPublicKey, fetchVaultSecret, secrets.hmacKey);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal} — shutting down auth-engine`);
    await app.close();
    await disconnect();
    await redis.quit();
    await db.end();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));

  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`Auth Engine listening on port ${PORT}`);
}

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
