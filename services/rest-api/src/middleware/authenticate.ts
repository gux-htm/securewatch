/**
 * JWT Auth Middleware — STEP 4
 *
 * Fastify preHandler hook — attach to all routes except /api/v1/auth/*
 * Verifies signature, expiry, and checks jti revocation list in node-cache.
 * Attaches decoded claims to request.user.
 * On ANY failure → 401 { "error": "Access Denied" } — never reveals why.
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import jwt from 'jsonwebtoken';
import Cache from '../db/cache';
import type { AuthUser } from '../lib/types';

// Augment FastifyRequest to carry the decoded user
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

function getJwtSecret(): string {
  const s = process.env['JWT_SECRET'];
  if (!s) throw new Error('JWT_SECRET env var is not set');
  return s;
}

export function authenticate(
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  req.user = null;

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Access Denied' });
    return;
  }

  const token = authHeader.slice(7);

  let decoded: AuthUser;
  try {
    decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
  } catch {
    // Expired, invalid signature, malformed — all get the same response
    reply.status(401).send({ error: 'Access Denied' });
    return;
  }

  // Check revocation list
  if (Cache.exists(`revoked:${decoded.jti}`)) {
    reply.status(401).send({ error: 'Access Denied' });
    return;
  }

  req.user = decoded;
  done();
}

/**
 * Revoke a JWT by jti — call on logout or account suspension.
 * TTL matches the token's remaining lifetime (max 24h).
 */
export function revokeToken(jti: string, ttlSeconds = 86400): void {
  Cache.set(`revoked:${jti}`, '1', ttlSeconds);
}
