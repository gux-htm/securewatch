/**
 * REST API Gateway — server entry point.
 * Loads secrets from Vault, wires dependencies, starts Fastify.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { buildApp } from './app.js';
import { initJwt } from './jwt-middleware.js';
import { loadSecrets } from './vault-client.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

async function main(): Promise<void> {
  const secrets = await loadSecrets();

  initJwt(secrets.jwtPublicKey);

  const db = new Pool({
    host:     secrets.dbHost,
    port:     secrets.dbPort,
    database: secrets.dbName,
    user:     secrets.dbUser,
    password: secrets.dbPassword,
    max:      20,
    ssl:      process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: true } : false,
  });

  const app = buildApp(db);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal} — shutting down`);
    await app.close();
    await db.end();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));

  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`REST API Gateway listening on port ${PORT}`);
}

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
