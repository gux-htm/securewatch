/**
 * Resource Access Event Engine
 *
 * Called whenever a file/resource is read or modified.
 * Performs:
 *   1. ACL check  — is this actor allowed to perform this action?
 *   2. Hash check — does the file hash match the stored baseline? (writes only)
 *   3. Audit log  — HMAC-signed record of every event regardless of outcome
 *   4. Alert      — fires HIGH/CRITICAL alert on ACL violation or hash mismatch
 */

import crypto from 'crypto';
import { queryOne, query, execute } from '../db/mysql';
import { writeAuditEvent } from './audit';
import { v4 as uuidv4 } from 'uuid';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccessAction = 'read' | 'write' | 'delete' | 'rename' | 'execute';

export interface AccessEventInput {
  tenantId:    string;
  actorId:     string | null;   // account_id — null if unknown (unregistered process)
  actorIp:     string;
  resourceId:  string | null;   // null if file not registered — still logged
  resourcePath: string;
  action:      AccessAction;
  fileHashSha256: string | null; // SHA-256 of file AFTER the event, hex string
  sourceSystem: string;          // 'watcher' | 'sdk' | 'agent'
}

export interface AccessEventResult {
  outcome:       'ALLOWED' | 'DENIED' | 'FLAGGED';
  aclViolation:  boolean;
  hashMismatch:  boolean;
  hashChanged:   boolean;
  alertFired:    boolean;
  detail:        Record<string, unknown>;
}

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface AclRow {
  acl_id: string;
  permitted_actions: string;  // JSON array
  grantee_id: string;
}

interface ResourceRow {
  resource_id: string;
  resource_name: string;
  owner_account_id: string | null;
  baseline_hash: string | null;
  last_hash: string | null;
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function processAccessEvent(input: AccessEventInput): Promise<AccessEventResult> {
  let aclViolation  = false;
  let hashMismatch  = false;
  let hashChanged   = false;
  let alertFired    = false;
  let outcome: 'ALLOWED' | 'DENIED' | 'FLAGGED' = 'ALLOWED';
  const detail: Record<string, unknown> = {
    action:       input.action,
    resourcePath: input.resourcePath,
    actorId:      input.actorId,
    sourceSystem: input.sourceSystem,
  };

  // ── 1. ACL check ────────────────────────────────────────────────────────────
  if (input.resourceId && input.actorId) {
    const resource = await queryOne<ResourceRow>(
      `SELECT resource_id, resource_name, owner_account_id, baseline_hash, last_hash
       FROM resources
       WHERE resource_id = ? AND tenant_id = ?`,
      [input.resourceId, input.tenantId],
    );

    if (resource) {
      // Owner always has full access
      const isOwner = resource.owner_account_id === input.actorId;

      if (!isOwner) {
        // Check ACL entries for this actor + resource
        const acls = await query<AclRow>(
          `SELECT acl_id, permitted_actions, grantee_id
           FROM acl_entries
           WHERE resource_id = ? AND tenant_id = ?
             AND grantee_type = 'ACCOUNT' AND grantee_id = ?
             AND status = 'ACTIVE'`,
          [input.resourceId, input.tenantId, input.actorId],
        );

        const permitted = acls.some((acl) => {
          try {
            const actions = JSON.parse(acl.permitted_actions) as string[];
            return actions.includes(input.action) || actions.includes('*');
          } catch {
            return false;
          }
        });

        if (!permitted) {
          aclViolation = true;
          outcome = 'DENIED';
          detail['aclViolation'] = true;
          detail['reason'] = `Actor ${input.actorId} has no ACL entry permitting '${input.action}' on this resource`;
        }
      }

      // ── 2. Hash integrity check (for write/delete/rename) ──────────────────
      if (input.fileHashSha256 && (input.action === 'write' || input.action === 'delete' || input.action === 'rename')) {
        const currentHash = input.fileHashSha256;
        detail['fileHash'] = currentHash;

        if (resource.baseline_hash) {
          hashChanged = currentHash !== resource.last_hash;
          hashMismatch = currentHash !== resource.baseline_hash;

          detail['baselineHash']  = resource.baseline_hash;
          detail['previousHash']  = resource.last_hash;
          detail['currentHash']   = currentHash;
          detail['hashChanged']   = hashChanged;
          detail['hashMismatch']  = hashMismatch;

          if (hashMismatch && !aclViolation) {
            // File changed from baseline — flag it (may be legitimate if actor is authorized)
            outcome = 'FLAGGED';
          }
        } else {
          // No baseline yet — set it now (first time we see this file's hash)
          await execute(
            `UPDATE resources SET baseline_hash = ?, last_hash = ?, last_hash_at = NOW()
             WHERE resource_id = ?`,
            [currentHash, currentHash, input.resourceId],
          );
          detail['baselineSet'] = true;
        }

        // Always update last_hash on write events
        if (!aclViolation) {
          await execute(
            `UPDATE resources SET last_hash = ?, last_hash_at = NOW()
             WHERE resource_id = ?`,
            [currentHash, input.resourceId],
          );
        }
      }
    }
  } else if (!input.resourceId && input.actorId === null) {
    // Unknown actor accessing unregistered file — flag it
    outcome = 'FLAGGED';
    detail['reason'] = 'Unregistered resource accessed by unknown actor';
  }

  // ── 3. Write audit event ────────────────────────────────────────────────────
  const eventType = aclViolation
    ? 'RESOURCE_ACCESS_DENIED'
    : hashMismatch
      ? 'RESOURCE_INTEGRITY_VIOLATION'
      : `RESOURCE_${input.action.toUpperCase()}`;

  await writeAuditEvent({
    tenantId:       input.tenantId,
    eventType,
    actorAccountId: input.actorId,
    actorIp:        input.actorIp,
    actorDeviceId:  null,
    resourceId:     input.resourceId,
    resourcePath:   input.resourcePath,
    outcome,
    layerFailed:    aclViolation ? 'ACCOUNT' : null,
    detail,
    severity:       aclViolation ? 'HIGH' : hashMismatch ? 'HIGH' : 'INFO',
    timestamp:      new Date(),
    sourceSystem:   input.sourceSystem,
  });

  // ── 4. Fire alert on violation ──────────────────────────────────────────────
  if (aclViolation || hashMismatch) {
    const alertCode  = aclViolation ? 'R1' : 'R2';
    const severity   = aclViolation ? 'HIGH' : 'HIGH';
    const dedupKey   = `${alertCode}:${input.resourceId ?? input.resourcePath}:${input.actorId ?? 'unknown'}`;

    // Dedup — don't fire same alert twice within 5 minutes
    const recent = await queryOne<{ alert_id: string }>(
      `SELECT alert_id FROM alerts
       WHERE tenant_id = ? AND dedup_key = ?
         AND triggered_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
       LIMIT 1`,
      [input.tenantId, dedupKey],
    );

    if (!recent) {
      await execute(
        `INSERT INTO alerts (alert_id, tenant_id, alert_code, severity, account_id, resource_id, detail, dedup_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          input.tenantId,
          alertCode,
          severity,
          input.actorId,
          input.resourceId,
          JSON.stringify(detail),
          dedupKey,
        ],
      );
      alertFired = true;
    }
  }

  return { outcome, aclViolation, hashMismatch, hashChanged, alertFired, detail };
}

// ── SHA-256 helper (used by watcher) ──────────────────────────────────────────

export function sha256Hex(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
