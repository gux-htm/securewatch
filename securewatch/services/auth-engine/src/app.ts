/**
 * Auth Engine Fastify app — Port 3002.
 * Handles admin login, MFA setup/verify, and internal auth endpoints.
 * Rule S1: Error responses never contain denial reason or layer info.
 */

import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import { AdminAuth } from './admin-auth.js';
import { generateMfaSetup } from './mfa-service.js';
import { initJwtIssuer } from './jwt-issuer.js';
import { initAuditLog } from './audit-log-writer.js';
import type { AuditWriter } from './types.js';

interface LoginBody { username: string; tenant_id: string; password: string; mfa_token: string; }
interface MfaSetupBody { admin_id: string; tenant_id: string; email: string; }
interface MfaVerifyBody { admin_id: string; tenant_id: string; mfa_token: string; }

export function buildApp(
  db: Pool,
  redis: Redis,
  jwtPublicKey: string,
  getMfaSecret: (path: string) => Promise<string>,
  hmacKey: string,
): FastifyInstance {
  const app = Fastify({ logger: true, genReqId: () => crypto.randomUUID() });
  void app.register(helmet);

  initJwtIssuer(jwtPublicKey); // public key used for verification in rest-api; private key set in server.ts
  const audit: AuditWriter = initAuditLog(db, hmacKey);

  const adminAuth = new AdminAuth(db, redis, audit, getMfaSecret);

  app.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ status: 'ok', service: 'auth-engine' });
  });

  // POST /v1/auth/login — credentials + MFA → JWT
  app.post<{ Body: LoginBody }>(
    '/v1/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'tenant_id', 'password', 'mfa_token'],
          properties: {
            username:  { type: 'string', minLength: 1 },
            tenant_id: { type: 'string', format: 'uuid' },
            password:  { type: 'string', minLength: 1 },
            mfa_token: { type: 'string', minLength: 6, maxLength: 8 },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      try {
        const result = await adminAuth.login(req.body);
        return reply.status(200).send({ success: true, data: { jwt: result.jwt }, meta: { request_id: req.id } });
      } catch (err) {
        const hasWarning = err instanceof Error && (err as Error & { warning?: boolean }).warning === true;
        if (hasWarning) {
          // 2nd failure — warning in response but NO denial detail (Rule S1)
          return reply.status(401).send({ error: 'Access Denied', warning: 'Account will be locked on next failure' });
        }
        // Rule S1: never expose why auth failed
        return reply.status(401).send({ error: 'Access Denied' });
      }
    },
  );

  // POST /v1/auth/mfa/setup — generate MFA secret + QR code
  app.post<{ Body: MfaSetupBody }>(
    '/v1/auth/mfa/setup',
    {
      schema: {
        body: {
          type: 'object',
          required: ['admin_id', 'tenant_id', 'email'],
          properties: {
            admin_id:  { type: 'string' },
            tenant_id: { type: 'string' },
            email:     { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: MfaSetupBody }>, reply: FastifyReply) => {
      try {
        const setup = await generateMfaSetup(req.body.admin_id, req.body.email);
        // Secret returned for caller to store in Vault — never stored in DB
        return reply.status(200).send({
          success: true,
          data: {
            otpauth_uri:    setup.otpauth_uri,
            qr_code_data_url: setup.qr_code_data_url,
            backup_codes:   setup.backup_codes,
            // secret returned so caller can PUT to Vault
            secret:         setup.secret,
          },
          meta: { request_id: req.id },
        });
      } catch {
        return reply.status(500).send({ error: 'Access Denied' });
      }
    },
  );

  // POST /v1/auth/mfa/verify — verify TOTP token
  app.post<{ Body: MfaVerifyBody }>(
    '/v1/auth/mfa/verify',
    {
      schema: {
        body: {
          type: 'object',
          required: ['admin_id', 'tenant_id', 'mfa_token'],
          properties: {
            admin_id:  { type: 'string' },
            tenant_id: { type: 'string' },
            mfa_token: { type: 'string' },
          },
        },
      },
    },
    async (req: FastifyRequest<{ Body: MfaVerifyBody }>, reply: FastifyReply) => {
      try {
        const res = await db.query<{ mfa_secret_ref: string | null }>(
          `SELECT mfa_secret_ref FROM admin_operators WHERE admin_id = $1 AND tenant_id = $2`,
          [req.body.admin_id, req.body.tenant_id],
        );
        const admin = res.rows[0];
        if (!admin?.mfa_secret_ref) return reply.status(401).send({ error: 'Access Denied' });
        const secret = await getMfaSecret(admin.mfa_secret_ref);
        const { verifyTotp } = await import('./mfa-service.js');
        const valid = verifyTotp(req.body.mfa_token, secret);
        if (!valid) return reply.status(401).send({ error: 'Access Denied' });
        return reply.status(200).send({ success: true, data: { verified: true }, meta: { request_id: req.id } });
      } catch {
        return reply.status(401).send({ error: 'Access Denied' });
      }
    },
  );

  app.setErrorHandler((err, _req, reply) => {
    if (err.statusCode === 400) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } });
    }
    return reply.status(500).send({ error: 'Access Denied' });
  });

  return app;
}
