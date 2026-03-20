/**
 * One-shot fix: resets admin password to Admin@1234, regenerates a valid BASE32
 * TOTP secret, and sets mfa_enabled=0 so the admin can re-scan and enable MFA.
 * Run with: npm run fix-admin
 */
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// Generate a valid BASE32 TOTP secret (20 random bytes → 32 base32 chars)
function generateBase32Secret(): string {
  const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const rawBytes = crypto.randomBytes(20);
  return Array.from(rawBytes).map((b) => BASE32[b & 31]).join('');
}

async function fixAdmin(): Promise<void> {
  const conn = await mysql.createConnection({
    host:     process.env['DB_HOST']     ?? 'localhost',
    port:     Number(process.env['DB_PORT'] ?? 3306),
    user:     process.env['DB_USER']     ?? 'root',
    password: process.env['DB_PASSWORD'] ?? '',
    database: process.env['DB_NAME']     ?? 'securewatch',
  });

  const hash = await bcrypt.hash('Admin@1234', 12);
  const totpSecret = generateBase32Secret();

  const [result] = await conn.execute(
    `UPDATE accounts
     SET password_hash = ?, mfa_secret = ?, mfa_enabled = 0, status = 'ACTIVE'
     WHERE account_id = '00000000-0000-0000-0000-000000000002'`,
    [hash, totpSecret],
  );

  const r = result as { affectedRows: number };
  if (r.affectedRows === 0) {
    console.log('⚠  Admin account not found — run npm run seed first');
  } else {
    const issuer  = 'SecureWatch';
    const label   = encodeURIComponent(`${issuer}:admin@securewatch.local`);
    const otpauth = `otpauth://totp/${label}?secret=${totpSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    console.log('✅ Admin password reset to Admin@1234');
    console.log(`✅ New BASE32 TOTP secret: ${totpSecret}`);
    console.log(`✅ MFA disabled — enable via Settings after scanning QR`);
    console.log(`\n📱 OTPAuth URL (paste into authenticator or generate QR):\n${otpauth}\n`);
  }

  // Also ensure tenant exists
  await conn.execute(
    `INSERT IGNORE INTO tenants (tenant_id, name, status)
     VALUES ('00000000-0000-0000-0000-000000000001', 'SecureWatch Demo', 'ACTIVE')`,
  );

  // Ensure network zones exist (needed for login zone check)
  await conn.execute(
    `INSERT IGNORE INTO network_zones (tenant_id, zone_name, cidr, created_by)
     VALUES ('00000000-0000-0000-0000-000000000001', 'Loopback', '127.0.0.0/8',
             '00000000-0000-0000-0000-000000000002')`,
  );
  await conn.execute(
    `INSERT IGNORE INTO network_zones (tenant_id, zone_name, cidr, created_by)
     VALUES ('00000000-0000-0000-0000-000000000001', 'Local LAN', '192.168.0.0/16',
             '00000000-0000-0000-0000-000000000002')`,
  );
  await conn.execute(
    `INSERT IGNORE INTO network_zones (tenant_id, zone_name, cidr, created_by)
     VALUES ('00000000-0000-0000-0000-000000000001', 'Private 10.x', '10.0.0.0/8',
             '00000000-0000-0000-0000-000000000002')`,
  );
  await conn.execute(
    `INSERT IGNORE INTO network_zones (tenant_id, zone_name, cidr, created_by)
     VALUES ('00000000-0000-0000-0000-000000000001', 'Private 172.x', '172.16.0.0/12',
             '00000000-0000-0000-0000-000000000002')`,
  );
  console.log('✅ Network zones ensured (127/8, 192.168/16, 10/8, 172.16/12)');

  await conn.end();
}

fixAdmin().catch((err) => {
  console.error('fix-admin failed:', err);
  process.exit(1);
});
