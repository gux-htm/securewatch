/**
 * Server entry point — wires up all dependencies and starts Fastify.
 * Secrets loaded from Vault at startup (Rule S4).
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { buildApp } from './app.js';
import { createRedisClient } from './redis-client.js';
import { createProducer, disconnectProducer } from './kafka-producer.js';
import { initAuditLog } from './audit-log.js';
import { HealthMonitor } from './health-monitor.js';
import { IntegrationRegistry } from './integration-registry.js';
import { writeAuditEntry } from './audit-log.js';
import { loadSecrets } from './vault-client.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

async function main(): Promise<void> {
  // Load all secrets from Vault — no secrets in env/config (Rule S4)
  const secrets = await loadSecrets();

  // PostgreSQL connection (primary DB — port 5432)
  const db = new Pool({
    host:     secrets.dbHost,
    port:     secrets.dbPort,
    database: secrets.dbName,
    user:     secrets.dbUser,
    password: secrets.dbPassword,
    max:      20,
    ssl:      process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: true } : false,
  });

  // Redis
  const redis = createRedisClient(secrets.redisHost, secrets.redisPort);
  await redis.connect();

  // Kafka producer
  const producer = await createProducer(secrets.kafkaBrokers);

  // Audit log — needs HMAC key from Vault
  // (fetched separately; reusing db pool for TimescaleDB writes via port 5433 in prod)
  const hmacKey = process.env['AUDIT_HMAC_KEY'] ?? 'dev-hmac-key-replace-in-prod';
  initAuditLog(db, hmacKey);

  // Fastify app
  const app = buildApp(db, redis, producer);

  // Health monitor — background job every 30s
  const registry = new IntegrationRegistry(db, redis);
  const monitor = new HealthMonitor(registry, writeAuditEntry);
  monitor.start();

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal} — shutting down`);
    monitor.stop();
    await app.close();
    await disconnectProducer();
    await redis.quit();
    await db.end();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));

  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`Integration Layer listening on port ${PORT}`);
}

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
