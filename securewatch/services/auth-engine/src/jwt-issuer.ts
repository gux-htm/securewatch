/**
 * JWT issuer — RS256, private key from Vault.
 * JWT is ONLY issued after successful MFA verification (Rule S3).
 * TTL: 8 hours for Admin sessions.
 * Claims: admin_id, tenant_id, role, exp, iat.
 */

import { createSign } from 'crypto';

export interface JwtClaims {
  admin_id:  string;
  tenant_id: string;
  role:      string;
  exp:       number;
  iat:       number;
}

const JWT_TTL_SECONDS = 8 * 60 * 60; // 8 hours

let privateKey: string | null = null;

export function initJwtIssuer(key: string): void {
  privateKey = key;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function issueJwt(claims: Omit<JwtClaims, 'exp' | 'iat'>): string {
  if (!privateKey) throw new Error('JWT private key not initialised');

  const now = Math.floor(Date.now() / 1000);
  const payload: JwtClaims = {
    ...claims,
    iat: now,
    exp: now + JWT_TTL_SECONDS,
  };

  const header = base64UrlEncode(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body   = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${header}.${body}`;

  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${signingInput}.${signature}`;
}
