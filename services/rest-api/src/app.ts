import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
dotenv.config();
import { config } from './config';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { alertRoutes } from './routes/alerts';
import { sessionRoutes } from './routes/sessions';
import { resourceRoutes } from './routes/resources';
import { integrationRoutes } from './routes/integrations';
import { accountRoutes } from './routes/accounts';
import { auditLogRoutes } from './routes/auditLog';
import { mfaSetupRoutes } from './routes/mfaSetup';
import { accessEventRoutes } from './routes/accessEvents';
import { fileEventRoutes } from './routes/fileEvents';
import { agentRoutes } from './routes/agent';
import { monitoringRoutes } from './routes/monitoring';
import { deviceRoutes } from './routes/devices';
import { zoneRoutes } from './routes/zones';
import { groupRoutes } from './routes/groups';
import { startFileEventsConsumer } from './consumers/fileEvents';
import { fileWatcher } from './lib/fileWatcher';

const app = Fastify({
  logger: {
    level: config.server.nodeEnv === 'production' ? 'warn' : 'info',
  },
  trustProxy: true,
});

async function bootstrap(): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'"],
        imgSrc:     ["'self'", 'data:'],
      },
    },
  });

  await app.register(cors, {
    origin:         config.server.nodeEnv === 'production' ? false : true,
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(alertRoutes);
  await app.register(sessionRoutes);
  await app.register(resourceRoutes);
  await app.register(integrationRoutes);
  await app.register(accountRoutes);
  await app.register(auditLogRoutes);
  await app.register(mfaSetupRoutes);
  await app.register(accessEventRoutes);
  await app.register(fileEventRoutes);
  await app.register(agentRoutes);
  await app.register(monitoringRoutes);
  await app.register(deviceRoutes);
  await app.register(zoneRoutes);
  await app.register(groupRoutes);

  await app.listen({
    host: config.server.host,
    port: config.server.port,
  });

  app.log.info(
    `SecureWatch REST API listening on ${config.server.host}:${config.server.port}`,
  );

  // Start Kafka consumers (non-blocking — errors are logged, not fatal)
  startFileEventsConsumer().catch((err) => {
    app.log.error({ err }, '[fileEvents consumer] failed to start');
  });

  // Start file system watchers for all active monitored directories
  fileWatcher.startAllActive().catch((err) => {
    app.log.error({ err }, '[fileWatcher] failed to start active watchers');
  });
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

export { app };
