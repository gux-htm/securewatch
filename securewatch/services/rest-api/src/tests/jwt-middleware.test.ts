/**
 * JWT middleware tests.
 * Critical test 3: API error response never contains denial reason or layer info.
 * Rule S1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initJwt, verifyJwt, jwtMiddleware } from '../jwt-middleware.js';
import { generateKeyPairSync, createSign } from 'crypto';

// Generate a real RS256 key pair for tests
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

function makeJwt(claims: Record<string, unknown>, expOffset = 3600): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    ...claims,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expOffset,
  })).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const sig = sign.sign(privateKeyPem, 'base64url');
  return `${signingInput}.${sig}`;
}

beforeEach(() => {
  initJwt(publicKeyPem);
});

describe('verifyJwt', () => {
  it('verifies a valid RS256 JWT', () => {
    const token = makeJwt({ admin_id: 'admin-1', tenant_id: 'tenant-1', role: 'ADMIN' });
    const claims = verifyJwt(token);
    expect(claims.admin_id).toBe('admin-1');
    expect(claims.tenant_id).toBe('tenant-1');
  });

  it('throws on expired token', () => {
    const token = makeJwt({ admin_id: 'admin-1', tenant_id: 'tenant-1', role: 'ADMIN' }, -1);
    expect(() => verifyJwt(token)).toThrow();
  });

  it('throws on tampered payload', () => {
    const token = makeJwt({ admin_id: 'admin-1', tenant_id: 'tenant-1', role: 'ADMIN' });
    const parts = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ admin_id: 'evil', tenant_id: 'other', role: 'ADMIN', exp: 9999999999, iat: 0 })).toString('base64url');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    expect(() => verifyJwt(tampered)).toThrow();
  });

  it('throws on malformed token', () => {
    expect(() => verifyJwt('not.a.valid.jwt.here')).toThrow();
  });
});

describe('jwtMiddleware', () => {
  // Critical test 3 — error response never contains denial reason or layer info
  it('returns Access Denied with no internal detail when no token provided', async () => {
    const req = { headers: {}, url: '/v1/integrations' } as Parameters<typeof jwtMiddleware>[0];
    let sentStatus = 0;
    let sentBody: unknown = null;
    const reply = {
      status: (code: number) => ({ send: (body: unknown) => { sentStatus = code; sentBody = body; } }),
    } as unknown as Parameters<typeof jwtMiddleware>[1];

    await jwtMiddleware(req, reply);

    expect(sentStatus).toBe(401);
    expect(sentBody).toEqual({ error: 'Access Denied' });
    // Must NOT contain any of these fields
    const bodyStr = JSON.stringify(sentBody);
    expect(bodyStr).not.toContain('layer');
    expect(bodyStr).not.toContain('reason');
    expect(bodyStr).not.toContain('detail');
    expect(bodyStr).not.toContain('LAYER_');
  });

  it('returns Access Denied with no internal detail when token is invalid', async () => {
    const req = {
      headers: { authorization: 'Bearer invalid.token.here' },
      url: '/v1/integrations',
    } as unknown as Parameters<typeof jwtMiddleware>[0];
    let sentBody: unknown = null;
    const reply = {
      status: (_code: number) => ({ send: (body: unknown) => { sentBody = body; } }),
    } as unknown as Parameters<typeof jwtMiddleware>[1];

    await jwtMiddleware(req, reply);

    expect(sentBody).toEqual({ error: 'Access Denied' });
  });

  it('attaches claims to request on valid token', async () => {
    const token = makeJwt({ admin_id: 'admin-1', tenant_id: 'tenant-1', role: 'ADMIN' });
    const req = {
      headers: { authorization: `Bearer ${token}` },
      url: '/v1/integrations',
    } as unknown as Parameters<typeof jwtMiddleware>[0] & { jwtClaims?: unknown };
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as Parameters<typeof jwtMiddleware>[1];

    await jwtMiddleware(req, reply);

    expect((req as { jwtClaims?: { admin_id: string } }).jwtClaims?.admin_id).toBe('admin-1');
  });
});
