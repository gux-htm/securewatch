/**
 * JWT middleware for REST API Gateway.
 * Algorithm: RS256 (asymmetric). Public key from Vault.
 * Claims: admin_id, tenant_id, role, exp, iat.
 * Rule S1: Denial reason never in HTTP response.
 */

import { createVerify } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface JwtClaims {
  admin_id:  string;
  tenant_id: string;
  role:      string;
  exp:       number;
  iat:       number;
}

let publicKey: string | null = null;

export function initJwt(key: string): void {
  publicKey = key;
}

function base64UrlDecode(str: string): Buffer {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

export function verifyJwt(token: string): JwtClaims {
  if (!publicKey) throw new Error('JWT public key not initialised');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const header = JSON.parse(base64UrlDecode(headerB64).toString('utf8')) as { alg: string };
  if (header.alg !== 'RS256') throw new Error('Only RS256 algorithm is permitted');

  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = base64UrlDecode(signatureB64);

  const verify = createVerify('RSA-SHA256');
  verify.update(signingInput);
  const valid = verify.verify(publicKey, signature);
  if (!valid) throw new Error('JWT signature verification failed');

  const claims = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as JwtClaims;

  if (claims.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT expired');
  }

  return claims;
}

export async function jwtMiddleware(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Access Denied' });
  }

  const token = authHeader.slice(7);
  try {
    const claims = verifyJwt(token);
    // Attach claims to request for downstream handlers
    (req as FastifyRequest & { jwtClaims: JwtClaims }).jwtClaims = claims;
  } catch {
    // Rule S1: Never expose why auth failed
    return reply.status(401).send({ error: 'Access Denied' });
  }
}
