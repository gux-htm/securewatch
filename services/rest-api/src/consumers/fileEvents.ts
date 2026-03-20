/**
 * Kafka consumer — topic: securewatch.file-events
 *
 * For each message:
 *  1. Parse + verify HMAC digital signature
 *  2. Look up / auto-register resource by path
 *  3. INSERT into file_events
 *  4. UPDATE resources.current_flag (only escalate, never auto-downgrade)
 *  5. Fire H3 (SUSPICIOUS) or C1 (CRITICAL) alert into the alerts table
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { createConsumer } from '../kafka';
import { query, queryOne, execute } from '../db/mysql';
import { writeAuditEvent } from '../lib/audit';

const TOPIC         = 'securewatch.file-events';
const GROUP_ID      = 'sw-file-events-consumer';
const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001';

interface FileEventPayload {
  tenantId:      string;
  resourcePath:  string;
  eventType:     string;
  actorUsername: string;
  actorIp:       string;
  actorMac:      string;
  hashBefore:    string;
  hashAfter:     string;
  hashChanged:   boolean;
  integrityFlag: string;
  flagReason:    string;
  digitalSig:    string;
  occurredAt:    string;
}

interface ResourceRow {
  resource_id:   string;
  current_flag:  string;
}

// ── HMAC verification ─────────────────────────────────────────────────────────

function verifySignature(payload: FileEventPayload): boolean {
  const key = process.env['AUDIT_HMAC_KEY'];
  if (!key) return false;

  const canonical = JSON.stringify({
    tenantId:      payload.tenantId,
    resourcePath:  payload.resourcePath,
    eventType:     payload.eventType,
    actorUsername: payload.actorUsername,
    actorIp:       payload.actorIp,
    actorMac:      payload.actorMac,
    hashBefore:    payload.hashBefore,
    hashAfter:     payload.hashAfter,
    hashChanged:   payload.hashChanged,
    integrityFlag: payload.integrityFlag,
    flagReason:    payload.flagReason,
    occurredAt:    payload.occurredAt,
  });

  const expected = crypto
    .createHmac('sha256', key)
    .update(canonical, 'utf8')
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(payload.digitalSig, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

// ── Flag escalation helper ────────────────────────────────────────────────────

const FLAG_RANK: Record<string, number> = { CLEAN: 0, SUSPICIOUS: 1, CRITICAL: 2 };

function shouldEscalate(current: string, incoming: string): boolean {
  return (FLAG_RANK[incoming] ?? 0) > (FLAG_RANK[current] ?? 0);
}

// ── Alert writer ──────────────────────────────────────────────────────────────

async function fireAlert(
  tenantId: string,
  code: string,
  severity: string,
  resourceId: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const alertId = uuidv4();
  await execute(
    `INSERT INTO alerts (alert_id, tenant_id, alert_code, severity, resource_id, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [alertId, tenantId, code, severity, resourceId, JSON.stringify(detail)],
  );
}

// ── Resource lookup / auto-register ──────────────────────────────────────────

async function resolveResource(tenantId: string, resourcePath: string): Promise<string> {
  const existing = await queryOne<ResourceRow>(
    `SELECT resource_id, current_flag FROM resources
     WHERE tenant_id = ? AND resource_path = ? LIMIT 1`,
    [tenantId, resourcePath],
  );
  if (existing) return existing.resource_id;

  // Auto-register as discovered FILE resource
  const resourceId = uuidv4();
  const name = resourcePath.split(/[\\/]/).pop() ?? resourcePath;
  await execute(
    `INSERT INTO resources
       (resource_id, tenant_id, resource_name, resource_path, resource_type, ownership_status)
     VALUES (?, ?, ?, ?, 'FILE', 'ACTIVE')`,
    [resourceId, tenantId, name, resourcePath],
  );
  console.log(`[fileEvents] Auto-registered resource: ${resourcePath} (${resourceId})`);
  return resourceId;
}

// ── Main consumer ─────────────────────────────────────────────────────────────

export async function startFileEventsConsumer(): Promise<void> {
  const consumer = await createConsumer(GROUP_ID);

  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      let payload: FileEventPayload;
      try {
        payload = JSON.parse(message.value.toString()) as FileEventPayload;
      } catch {
        console.error('[fileEvents] Failed to parse message');
        return;
      }

      // 1. Verify HMAC signature
      if (!verifySignature(payload)) {
        console.error(`[fileEvents] TAMPERED event from ${payload.actorUsername} — dropping`);
        // Fire CRITICAL alert C3 for tampered event
        const tenantId = payload.tenantId ?? DEFAULT_TENANT;
        const resourceId = await resolveResource(tenantId, payload.resourcePath);
        await fireAlert(tenantId, 'C3', 'CRITICAL', resourceId, {
          reason: 'HMAC signature invalid — event may be tampered',
          actorUsername: payload.actorUsername,
          resourcePath: payload.resourcePath,
        });
        return;
      }

      const tenantId = payload.tenantId ?? DEFAULT_TENANT;

      // 2. Resolve resource
      const resourceId = await resolveResource(tenantId, payload.resourcePath);

      // 3. Get current resource flag
      const resource = await queryOne<ResourceRow>(
        `SELECT resource_id, current_flag FROM resources WHERE resource_id = ?`,
        [resourceId],
      );
      const currentFlag = resource?.current_flag ?? 'CLEAN';

      // 4. INSERT file_events row
      const eventId = uuidv4();
      await execute(
        `INSERT INTO file_events
           (id, tenant_id, resource_id, resource_path, event_type,
            actor_username, actor_ip, actor_mac,
            hash_before, hash_after, hash_changed,
            integrity_flag, flag_reason, digital_sig, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          tenantId,
          resourceId,
          payload.resourcePath,
          payload.eventType,
          payload.actorUsername,
          payload.actorIp,
          payload.actorMac,
          payload.hashBefore || null,
          payload.hashAfter  || null,
          payload.hashChanged ? 1 : 0,
          payload.integrityFlag,
          payload.flagReason || null,
          payload.digitalSig,
          new Date(payload.occurredAt),
        ],
      );

      // 5. Update resource flag (only escalate)
      if (shouldEscalate(currentFlag, payload.integrityFlag)) {
        await execute(
          `UPDATE resources
           SET current_flag = ?, last_event_at = NOW(), last_event_id = ?
           WHERE resource_id = ?`,
          [payload.integrityFlag, eventId, resourceId],
        );
      } else {
        await execute(
          `UPDATE resources SET last_event_at = NOW(), last_event_id = ?
           WHERE resource_id = ?`,
          [eventId, resourceId],
        );
      }

      // 6. Fire alerts
      if (payload.integrityFlag === 'CRITICAL') {
        await fireAlert(tenantId, 'C1', 'CRITICAL', resourceId, {
          eventId,
          actorUsername: payload.actorUsername,
          resourcePath:  payload.resourcePath,
          flagReason:    payload.flagReason,
          hashChanged:   payload.hashChanged,
        });
        await writeAuditEvent({
          tenantId,
          eventType:      'FS_INTEGRITY_CRITICAL',
          actorAccountId: null,
          actorIp:        payload.actorIp,
          actorDeviceId:  null,
          resourceId,
          resourcePath:   payload.resourcePath,
          outcome:        'FLAGGED',
          layerFailed:    null,
          detail:         { alertCode: 'C1', actor: payload.actorUsername, reason: payload.flagReason },
          severity:       'CRITICAL',
          timestamp:      new Date(payload.occurredAt),
        });
      } else if (payload.integrityFlag === 'SUSPICIOUS') {
        await fireAlert(tenantId, 'H3', 'HIGH', resourceId, {
          eventId,
          actorUsername: payload.actorUsername,
          resourcePath:  payload.resourcePath,
          flagReason:    payload.flagReason,
          hashChanged:   payload.hashChanged,
        });
        await writeAuditEvent({
          tenantId,
          eventType:      'FS_INTEGRITY_SUSPICIOUS',
          actorAccountId: null,
          actorIp:        payload.actorIp,
          actorDeviceId:  null,
          resourceId,
          resourcePath:   payload.resourcePath,
          outcome:        'FLAGGED',
          layerFailed:    null,
          detail:         { alertCode: 'H3', actor: payload.actorUsername, reason: payload.flagReason },
          severity:       'HIGH',
          timestamp:      new Date(payload.occurredAt),
        });
      }

      console.log(`[fileEvents] ${payload.integrityFlag} — ${payload.eventType} on ${payload.resourcePath} by ${payload.actorUsername}`);
    },
  });
}
