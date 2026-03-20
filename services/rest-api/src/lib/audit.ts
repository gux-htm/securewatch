/**
 * HMAC Audit Writer — STEP 1
 *
 * Every audit event is HMAC-SHA256 signed before INSERT.
 * Deletion is permanently blocked — any attempt throws + fires CRITICAL alert C3.
 * This module is imported by every service that writes audit events.
 */

import crypto from 'crypto';
import { execute } from '../db/mysql';
import type { AuditPayload } from './types';

// ── HMAC helpers ──────────────────────────────────────────────────────────────

function getHmacKey(): string {
  const key = process.env['AUDIT_HMAC_KEY'];
  if (!key || key.length < 16) {
    throw new Error('AUDIT_HMAC_KEY env var is missing or too short (min 16 chars)');
  }
  return key;
}

function computeHmac(payload: AuditPayload): string {
  // Canonical JSON — sorted keys, deterministic serialisation
  const canonical = JSON.stringify({
    tenantId:       payload.tenantId,
    eventType:      payload.eventType,
    actorAccountId: payload.actorAccountId,
    actorIp:        payload.actorIp,
    actorDeviceId:  payload.actorDeviceId,
    resourceId:     payload.resourceId,
    resourcePath:   payload.resourcePath,
    outcome:        payload.outcome,
    layerFailed:    payload.layerFailed,
    severity:       payload.severity,
    timestamp:      payload.timestamp.toISOString(),
  });

  return crypto
    .createHmac('sha256', getHmacKey())
    .update(canonical, 'utf8')
    .digest('hex');
}

// ── Public write function ─────────────────────────────────────────────────────

export async function writeAuditEvent(payload: AuditPayload): Promise<void> {
  // Compute HMAC BEFORE any INSERT — throws if key is missing
  const hmacSignature = computeHmac(payload);

  const sql = `
    INSERT INTO audit_events (
      tenant_id, occurred_at, event_category, event_type,
      account_id, source_ip, device_id,
      resource_id, resource_path,
      outcome, failed_layer,
      denial_reason, hmac_signature, source_system
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // outcome already matches DB ENUM: ALLOWED | DENIED | FLAGGED
  const dbOutcome = payload.outcome;

  const denialReason =
    Object.keys(payload.detail).length > 0
      ? JSON.stringify(payload.detail)
      : null;

  await execute(sql, [
    payload.tenantId,
    payload.timestamp,
    deriveCategory(payload.eventType),
    payload.eventType,
    payload.actorAccountId,
    payload.actorIp,
    payload.actorDeviceId,
    payload.resourceId,
    payload.resourcePath,
    dbOutcome,
    payload.layerFailed,
    denialReason,
    hmacSignature,
    payload.sourceSystem ?? null,
  ]);
}

// ── Deletion guard — RULE S2 ──────────────────────────────────────────────────

export async function deleteAuditEvent(_id: never): Promise<never> {
  // Log the attempt before throwing
  try {
    await writeAuditEvent({
      tenantId:       'system',
      eventType:      'AUDIT_LOG_DELETE_ATTEMPTED',
      actorAccountId: null,
      actorIp:        null,
      actorDeviceId:  null,
      resourceId:     null,
      resourcePath:   null,
      outcome:        'DENIED',
      layerFailed:    null,
      detail:         { alertCode: 'C3' },
      severity:       'CRITICAL',
      timestamp:      new Date(),
    });
  } catch {
    // Even if the self-log fails, we still throw — never silently allow
  }
  throw new Error('AUDIT_LOG_DELETION_PROHIBITED: Audit log deletion is permanently blocked (C3)');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveCategory(eventType: string): string {
  if (eventType.startsWith('AUTH'))     return 'AUTH';
  if (eventType.startsWith('SESSION'))  return 'SESSION';
  if (eventType.startsWith('RESOURCE')) return 'RESOURCE';
  if (eventType.startsWith('AUDIT'))    return 'AUDIT';
  if (eventType.startsWith('ALERT'))    return 'ALERT';
  if (eventType.startsWith('ACCOUNT'))  return 'ACCOUNT';
  if (eventType.startsWith('FS_'))      return 'FILESYSTEM';
  return 'SYSTEM';
}
