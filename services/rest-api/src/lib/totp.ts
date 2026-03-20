/**
 * TOTP implementation — RFC 6238 (HMAC-SHA1, 30s window, 6 digits)
 * Uses Node.js built-in crypto only — no external TOTP library needed.
 * Compatible with Google Authenticator, Authy, and any RFC 6238 app.
 */

import crypto from 'crypto';

// Base32 decode — RFC 4648 alphabet
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(secret: string): Buffer {
  const s = secret.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = Buffer.alloc(Math.floor((s.length * 5) / 8));

  for (const char of s) {
    const charIndex = BASE32_CHARS.indexOf(char);
    if (charIndex === -1) continue;
    value = (value << 5) | charIndex;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  return output.subarray(0, index);
}

function hotp(secret: Buffer, counter: bigint): string {
  // Counter as 8-byte big-endian buffer
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);

  const hmac = crypto.createHmac('sha1', secret).update(counterBuf).digest();

  // Dynamic truncation
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const b0 = hmac[offset]     ?? 0;
  const b1 = hmac[offset + 1] ?? 0;
  const b2 = hmac[offset + 2] ?? 0;
  const b3 = hmac[offset + 3] ?? 0;
  const code =
    ((b0 & 0x7f) << 24) |
    ((b1 & 0xff) << 16) |
    ((b2 & 0xff) << 8)  |
     (b3 & 0xff);

  return (code % 1_000_000).toString().padStart(6, '0');
}

/**
 * Verify a TOTP token against a Base32-encoded secret.
 * window=2 means we accept ±2 time steps (60 seconds tolerance) to handle clock drift.
 */
export function verifyTotp(token: string, secret: string, window = 2): boolean {
  if (!/^\d{6}$/.test(token)) return false;

  const secretBuf = base32Decode(secret);
  const timeStep = BigInt(Math.floor(Date.now() / 1000 / 30));

  for (let i = -window; i <= window; i++) {
    const expected = hotp(secretBuf, timeStep + BigInt(i));
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

/**
 * Generate a TOTP token for a given secret (used in tests / seeding).
 */
export function generateTotp(secret: string): string {
  const secretBuf = base32Decode(secret);
  const timeStep = BigInt(Math.floor(Date.now() / 1000 / 30));
  return hotp(secretBuf, timeStep);
}
