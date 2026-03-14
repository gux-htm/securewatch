/**
 * Audit log writer for the Integration Layer.
 * Rule S2: Audit log is indestructible — delete method permanently prohibited.
 * Rule S7: Every row must have HMAC signature before INSERT.
 */

import { createHmac } from 'crypto';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { Severity } from '@securewatch/types';

export interface AuditEntry {
  tenant_id: string;
  event_category: string;
  event_type: string;
  account_id?: string | null;
  device_id?: string | null;
  source_ip?: string | null;
  resource_id?: string | null;
  action?: string | null;
  outcome: string;
  denial_reason?: string | null; // Admin only — never in HTTP response
  risk_verdict?: string | null;
  alert_id?: string | null;
  raw_event?: string | null;
  source_system?: string | null;
  severity?: Severity;
}

let pool: Pool | null = null;
let hmacKey: string | null = null;

export function initAuditLog(dbPool: Pool, key: string): void {
  pool = dbPool;
  hmacKey = key;
}

function signEntry(entry: AuditEntry & { log_id: string; occurred_at: string }): string {
  if (!hmacKey) throw new Error('HMAC key not initialised');
  const payload = JSON.stringify({
    log_id:         entry.log_id,
    tenant_id:      entry.tenant_id,
    occurred_at:    entry.occurred_at,
    event_type:     entry.event_type,
    outcome:        entry.outcome,
    account_id:     entry.account_id ?? null,
    resource_id:    entry.resource_id ?? null,
  });
  return createHmac('sha256', hmacKey).update(payload).digest('hex');
}

export async function writeAuditEntry(entry: AuditEntry): Promise<void> {
  if (!pool) throw new Error('Audit log DB pool not initialised');

  const log_id = randomUUID();
  const occurred_at = new Date().toISOString();

  // Rule S7: HMAC must be generated BEFORE INSERT
  const hmac_signature = signEntry({ ...entry, log_id, occurred_at });

  await pool.query(
    `INSERT INTO audit_events (
      log_id, tenant_id, occurred_at, ingested_at,
      event_category, event_type,
      account_id, device_id, source_ip,
      resource_id, action, outcome,
      denial_reason, risk_verdict, alert_id,
      raw_event, hmac_signature, source_system
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
    )`,
    [
      log_id,
      entry.tenant_id,
      occurred_at,
      occurred_at,
      entry.event_category,
      entry.event_type,
      entry.account_id ?? null,
      entry.device_id ?? null,
      entry.source_ip ?? null,
      entry.resource_id ?? null,
      entry.action ?? null,
      entry.outcome,
      entry.denial_reason ?? null,
      entry.risk_verdict ?? null,
      entry.alert_id ?? null,
      entry.raw_event ?? null,
      hmac_signature,
      entry.source_system ?? null,
    ]
  );
}

// Rule S2: Deletion is permanently prohibited at the application layer.
export class AuditLogStore {
  async delete(_: never): Promise<never> {
    await writeAuditEntry({
      tenant_id:      'system',
      event_category: 'SYSTEM',
      event_type:     'AUDIT_LOG_DELETE_ATTEMPTED',
      outcome:        'DENIED',
      severity:       'CRITICAL',
    });
    throw new Error('Audit log deletion is permanently prohibited');
  }
}
