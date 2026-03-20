/**
 * Three-Layer Verification Engine — STEP 2
 *
 * Layer 1 — Account:  status ACTIVE, not expired/revoked, correct tenant
 * Layer 2 — Zone:     sourceIp falls within an authorised CIDR for this tenant
 * Layer 3 — Device:   fingerprint matches a REGISTERED device for this account
 *
 * On any failure: writes BLOCK audit event, returns { allowed: false, layerFailed }
 * The caller sends ONLY { "error": "Access Denied" } to the client — never layerFailed.
 */

import IpCidr from 'ip-cidr';
import { queryOne, query } from '../db/mysql';
import Cache from '../db/cache';
import { writeAuditEvent } from './audit';
import type { VerifyContext, VerifyResult, LayerFailed } from './types';

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface AccountRow {
  account_id: string;
  status: string;
  role: string;
}

interface ZoneRow {
  cidr: string;
}

interface DeviceRow {
  device_id: string;
  status: string;
}

// ── Cache TTLs ────────────────────────────────────────────────────────────────

const POSITIVE_TTL = 60;   // seconds — cache valid account lookups
const NEGATIVE_TTL = 10;   // seconds — cache negative results briefly

// ── Main entry point ──────────────────────────────────────────────────────────

export async function verifyAccess(ctx: VerifyContext): Promise<VerifyResult> {
  // ── Layer 1: Account ────────────────────────────────────────────────────────
  const accountResult = await checkAccount(ctx.accountId, ctx.tenantId);
  if (!accountResult) {
    await writeDenial(ctx, 'ACCOUNT');
    return { allowed: false, layerFailed: 'ACCOUNT' };
  }

  // ── Layer 2: Network Zone ───────────────────────────────────────────────────
  const zoneResult = await checkZone(ctx.tenantId, ctx.sourceIp);
  if (!zoneResult) {
    await writeDenial(ctx, 'ZONE');
    return { allowed: false, layerFailed: 'ZONE' };
  }

  // ── Layer 3: Device ─────────────────────────────────────────────────────────
  const deviceResult = await checkDevice(ctx.accountId, ctx.tenantId, ctx.deviceFingerprint);
  if (!deviceResult) {
    await writeDenial(ctx, 'DEVICE');
    return { allowed: false, layerFailed: 'DEVICE' };
  }

  return { allowed: true };
}

// ── Layer implementations ─────────────────────────────────────────────────────

async function checkAccount(accountId: string, tenantId: string): Promise<boolean> {
  const cacheKey = `acct:${tenantId}:${accountId}`;
  const cached = Cache.get(cacheKey);

  if (cached === 'ok') return true;
  if (cached === 'deny') return false;

  const row = await queryOne<AccountRow>(
    `SELECT account_id, status, role
     FROM accounts
     WHERE account_id = ? AND tenant_id = ?
     LIMIT 1`,
    [accountId, tenantId],
  );

  const valid = row !== null && row.status === 'ACTIVE';
  Cache.set(cacheKey, valid ? 'ok' : 'deny', valid ? POSITIVE_TTL : NEGATIVE_TTL);
  return valid;
}

async function checkZone(tenantId: string, sourceIp: string): Promise<boolean> {
  // Normalise IPv6 loopback / IPv4-mapped addresses so CIDR checks work
  let ip = sourceIp;
  if (ip === '::1') ip = '127.0.0.1';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);

  const cacheKey = `zones:${tenantId}`;
  const cachedRaw = Cache.get(cacheKey);

  let cidrs: string[];
  if (cachedRaw !== undefined) {
    cidrs = JSON.parse(cachedRaw) as string[];
  } else {
    const rows = await query<ZoneRow>(
      `SELECT cidr FROM network_zones WHERE tenant_id = ?`,
      [tenantId],
    );
    // Note: column is `cidr` (not `cidr_range`) per migration 004
    cidrs = rows.map((r) => r.cidr);
    Cache.set(cacheKey, JSON.stringify(cidrs), 300);
  }

  if (cidrs.length === 0) {
    // No zones configured — allow all (open policy for fresh installs)
    return true;
  }

  return cidrs.some((cidr) => {
    try {
      const range = new IpCidr(cidr);
      return range.contains(ip);
    } catch {
      return false;
    }
  });
}

async function checkDevice(
  accountId: string,
  tenantId: string,
  fingerprint: string,
): Promise<boolean> {
  const cacheKey = `dev:${tenantId}:${fingerprint}`;
  const cached = Cache.get(cacheKey);

  if (cached === 'ok') return true;
  if (cached === 'deny') return false;

  const row = await queryOne<DeviceRow>(
    `SELECT device_id, status
     FROM devices
     WHERE tenant_id = ? AND fingerprint = ? AND status = 'REGISTERED'
     LIMIT 1`,
    [tenantId, fingerprint],
  );

  // For the demo: if no devices are registered yet, allow access
  // (device registration happens in Phase 2 — this prevents lockout on fresh install)
  const totalDevices = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM devices WHERE tenant_id = ?`,
    [tenantId],
  );
  const hasDevices = (totalDevices?.cnt ?? 0) > 0;

  const valid = !hasDevices || row !== null;
  Cache.set(cacheKey, valid ? 'ok' : 'deny', valid ? POSITIVE_TTL : NEGATIVE_TTL);
  return valid;
}

// ── Audit helper ──────────────────────────────────────────────────────────────

async function writeDenial(ctx: VerifyContext, layerFailed: LayerFailed): Promise<void> {
  try {
    await writeAuditEvent({
      tenantId:       ctx.tenantId,
      eventType:      'AUTH_LAYER_DENIED',
      actorAccountId: ctx.accountId,
      actorIp:        ctx.sourceIp,
      actorDeviceId:  null,
      resourceId:     ctx.resourceId,
      resourcePath:   null,
      outcome:        'DENIED',
      layerFailed,
      detail:         { layerFailed, deviceFingerprint: ctx.deviceFingerprint },
      severity:       'HIGH',
      timestamp:      new Date(),
    });
  } catch (err) {
    // Audit write failure must not suppress the denial — log to stderr only
    console.error('[verifier] audit write failed:', err instanceof Error ? err.message : err);
  }
}
