/**
 * REST API app integration tests.
 * Verifies JWT protection, health endpoint, and error response format.
 * Critical test 3: API error response never contains denial reason or layer info.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { buildApp } from '../app.js';
import { initJwt } from '../jwt-middleware.js';
import { generateKeyPairSync, createSign } from 'crypto';
import type { Pool } from 'pg';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

function makeJwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    ...claims,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const sig = sign.sign(privateKeyPem, 'base64url');
  return `${signingInput}.${sig}`;
}

function makeDb(): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  } as unknown as Pool;
}

beforeAll(() => {
  initJwt(publicKeyPem);
});

describe('REST API app', () => {
  it('GET /health returns 200 without auth', async () => {
    const app = buildApp(makeDb());
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { status: string };
    expect(body.status).toBe('ok');
  });

  // Critical test 3 — error response never contains denial reason or layer info
  it('GET /v1/integrations returns 401 with only { error: "Access Denied" } when no token', async () => {
    const app = buildApp(makeDb());
    const res = await app.inject({ method: 'GET', url: '/v1/integrations' });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as Record<string, unknown>;
    expect(body).toEqual({ error: 'Access Denied' });
    // Must NOT contain internal detail
    expect(JSON.stringify(body)).not.toContain('layer');
    expect(JSON.stringify(body)).not.toContain('reason');
    expect(JSON.stringify(body)).not.toContain('LAYER_');
    expect(JSON.stringify(body)).not.toContain('denial');
  });

  it('GET /v1/integrations returns 401 with invalid token', async () => {
    const app = buildApp(makeDb());
    const res = await app.inject({
      method: 'GET',
      url: '/v1/integrations',
      headers: { authorization: 'Bearer bad.token.here' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'Access Denied' });
  });

  it('GET /v1/integrations returns 200 with valid JWT', async () => {
    const db = makeDb();
    const app = buildApp(db);
    const token = makeJwt({ admin_id: 'admin-1', tenant_id: 'tenant-1', role: 'ADMIN' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/integrations',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('POST /v1/integrations validates required fields', async () => {
    const app = buildApp(makeDb());
    const token = makeJwt({ admin_id: 'admin-1', tenant_id: 'tenant-1', role: 'ADMIN' });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/integrations',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ system_name: 'test' }), // missing required fields
    });
    expect(res.statusCode).toBe(400);
  });
});
