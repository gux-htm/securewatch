/**
 * MFA Service — TOTP-based (RFC 6238, otplib).
 * Rule S3: MFA cannot be bypassed. JWT issued ONLY after successful MFA.
 * Secret stored in Vault — never in code or DB.
 */

import { authenticator } from 'otplib';
import { randomBytes, createHash } from 'crypto';
import { toDataURL } from 'qrcode';

export interface MfaSetupResult {
  secret_vault_path: string; // Path in Vault where secret is stored
  otpauth_uri:       string; // For QR code generation
  qr_code_data_url:  string; // Base64 PNG for display
  backup_codes:      string[]; // 8 one-time recovery codes (hashed before storage)
}

export interface MfaVerifyResult {
  valid:   boolean;
  used_backup: boolean;
}

/**
 * Generate a new TOTP secret and QR code URI.
 * The secret is returned for storage in Vault — never stored in DB.
 */
export async function generateMfaSetup(
  adminId: string,
  email: string,
  issuer: string = 'SecureWatch',
): Promise<{ secret: string; otpauth_uri: string; qr_code_data_url: string; backup_codes: string[]; backup_code_hashes: string[] }> {
  const secret = authenticator.generateSecret(32);
  const otpauth_uri = authenticator.keyuri(email, issuer, secret);
  const qr_code_data_url = await toDataURL(otpauth_uri);

  // Generate 8 backup codes — 10 random hex chars each
  const backup_codes: string[] = [];
  const backup_code_hashes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const code = randomBytes(5).toString('hex').toUpperCase();
    backup_codes.push(code);
    backup_code_hashes.push(createHash('sha256').update(code).digest('hex'));
  }

  return { secret, otpauth_uri, qr_code_data_url, backup_codes, backup_code_hashes };
}

/**
 * Verify a TOTP token against a secret.
 * Window of 1 allows for clock drift (±30s).
 */
export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Verify a backup code against stored hashes.
 * Returns the index of the matched code (for invalidation), or -1.
 */
export function verifyBackupCode(code: string, hashes: string[]): number {
  const hash = createHash('sha256').update(code.toUpperCase()).digest('hex');
  return hashes.findIndex(h => h === hash);
}
