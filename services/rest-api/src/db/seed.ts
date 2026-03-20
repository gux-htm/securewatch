/**
 * Seed script — inserts demo data into MySQL.
 * Run with: npx ts-node src/db/seed.ts
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const TENANT_ID   = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID    = '00000000-0000-0000-0000-000000000002';
const DEVICE_ID   = '00000000-0000-0000-0000-000000000010';
const RESOURCE_ID = '00000000-0000-0000-0000-000000000020';
const ACL_ID      = '00000000-0000-0000-0000-000000000030';

async function seed(): Promise<void> {
  const conn = await mysql.createConnection({
    host:     process.env['DB_HOST']     ?? 'localhost',
    port:     Number(process.env['DB_PORT'] ?? 3306),
    user:     process.env['DB_USER']     ?? 'root',
    password: process.env['DB_PASSWORD'] ?? '',
    database: process.env['DB_NAME']     ?? 'securewatch',
    multipleStatements: false,
  });

  console.log('\n🌱 SecureWatch seed starting...\n');

  // ── Tenant ──────────────────────────────────────────────────────────────────
  await conn.execute(
    `INSERT IGNORE INTO tenants (tenant_id, name, status)
     VALUES (?, 'SecureWatch Demo', 'ACTIVE')`,
    [TENANT_ID],
  );
  console.log(`✓ Tenant: SecureWatch Demo (${TENANT_ID})`);

  // ── Admin account ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  // Generate a random base32 secret (20 bytes → 32 base32 chars)
  const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const rawBytes = crypto.randomBytes(20);
  const totpSecret = Array.from(rawBytes)
    .map((b) => BASE32[b & 31])
    .join('');

  await conn.execute(
    `INSERT INTO accounts
       (account_id, tenant_id, username, email, password_hash, status, role, mfa_secret, mfa_enabled)
     VALUES (?, ?, 'admin', 'admin@securewatch.local', ?, 'ACTIVE', 'ADMIN', ?, 0)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       mfa_secret    = VALUES(mfa_secret),
       mfa_enabled   = 0`,
    [ADMIN_ID, TENANT_ID, passwordHash, totpSecret],
  );
  console.log(`✓ Admin account: admin / Admin@1234  (MFA disabled — any 6 digits work on login)`);

  // ── Network zones ────────────────────────────────────────────────────────────
  await conn.execute(
    `INSERT IGNORE INTO network_zones (tenant_id, zone_name, cidr, created_by)
     VALUES (?, 'Loopback', '127.0.0.0/8', ?)`,
    [TENANT_ID, ADMIN_ID],
  );
  await conn.execute(
    `INSERT IGNORE INTO network_zones (tenant_id, zone_name, cidr, created_by)
     VALUES (?, 'Local LAN', '192.168.0.0/16', ?)`,
    [TENANT_ID, ADMIN_ID],
  );
  console.log(`✓ Network zones: 127.0.0.0/8, 192.168.0.0/16`);

  // ── Device ───────────────────────────────────────────────────────────────────
  await conn.execute(
    `INSERT INTO devices
       (device_id, tenant_id, fingerprint, hostname, status, registered_by, approved_at)
     VALUES (?, ?, 'DEMO-DEVICE-001', 'Dev Machine', 'REGISTERED', ?, NOW())
     ON DUPLICATE KEY UPDATE status = 'REGISTERED'`,
    [DEVICE_ID, TENANT_ID, ADMIN_ID],
  );
  console.log(`✓ Device: DEMO-DEVICE-001 (Dev Machine)`);

  // ── Resource ─────────────────────────────────────────────────────────────────
  await conn.execute(
    `INSERT INTO resources
       (resource_id, tenant_id, resource_name, resource_path, resource_type, owner_account_id, ownership_status)
     VALUES (?, ?, 'monitored', 'C:\\SecureWatch\\monitored', 'DIRECTORY', ?, 'ACTIVE')
     ON DUPLICATE KEY UPDATE ownership_status = 'ACTIVE'`,
    [RESOURCE_ID, TENANT_ID, ADMIN_ID],
  );
  console.log(`✓ Resource: C:\\SecureWatch\\monitored (DIRECTORY)`);

  // ── ACL entry ────────────────────────────────────────────────────────────────
  await conn.execute(
    `INSERT INTO acl_entries
       (acl_id, tenant_id, resource_id, grantee_type, grantee_id, permitted_actions, granted_by, status)
     VALUES (?, ?, ?, 'ACCOUNT', ?, JSON_ARRAY('read','write','delete'), ?, 'ACTIVE')
     ON DUPLICATE KEY UPDATE status = 'ACTIVE'`,
    [ACL_ID, TENANT_ID, RESOURCE_ID, ADMIN_ID, ADMIN_ID],
  );
  console.log(`✓ ACL: admin → monitored [read, write, delete]`);

  // ── Demo integration ─────────────────────────────────────────────────────────
  await conn.execute(
    `INSERT IGNORE INTO integration_registry
       (tenant_id, system_name, system_type, integration_method, status, registered_by, last_event_at)
     VALUES (?, 'SecureWatch Demo Agent', 'APPLICATION', 'AGENT', 'ACTIVE', ?, NOW())`,
    [TENANT_ID, ADMIN_ID],
  );
  console.log(`✓ Integration: SecureWatch Demo Agent`);

  await conn.end();

  // ── TOTP output ──────────────────────────────────────────────────────────────
  const issuer  = 'SecureWatch';
  const label   = encodeURIComponent(`${issuer}:admin`);
  const qrUrl   = `otpauth://totp/${label}?secret=${totpSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  TOTP SECRET (add to Google Authenticator NOW — shown once)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Secret : ${totpSecret}`);
  console.log(`  Account: SecureWatch Admin`);
  console.log(`  QR URL : ${qrUrl}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n  Scan the QR URL at: https://qr.io (paste the otpauth:// URL)');
  console.log('\n✅ Seed complete\n');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
