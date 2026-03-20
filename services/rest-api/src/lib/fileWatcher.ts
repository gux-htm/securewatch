/**
 * FileWatcher — chokidar v5-based real file system monitor.
 *
 * Watches monitored_directories, computes SHA-256 hashes on every event,
 * writes to monitored_file_events, updates file_states, fires alerts on
 * SUSPICIOUS/CRITICAL events, and writes HMAC-signed audit records.
 */

import { watch as chokidarWatch } from 'chokidar';
import { createHash, createHmac } from 'crypto';
import { readFileSync, statSync } from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, execute } from '../db/mysql';
import { writeAuditEvent } from './audit';
import { getCurrentWindowsUser } from './systemUsers';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MonitoredDirectory {
  id: string;
  tenant_id: string;
  resource_id: string;
  path: string;
  label: string | null;
  is_recursive: number;
}

interface FileStateRow {
  id: string;
  hash_sha256: string | null;
  file_size_bytes: number | null;
}

interface AccountRow {
  account_id: string;
}

// Chokidar v5 FSWatcher interface (EventEmitter-based)
interface FSWatcher {
  on(event: string, listener: (...args: unknown[]) => void): this;
  close(): Promise<void>;
}

type EventFlag = 'CLEAN' | 'SUSPICIOUS' | 'CRITICAL';
type EventType = 'created' | 'modified' | 'deleted' | 'accessed' | 'renamed' | 'permission_changed';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHmacKey(): string {
  return process.env['AUDIT_HMAC_KEY'] ?? process.env['HMAC_SECRET'] ?? 'dev-hmac-key-change-me';
}

function computeFileSHA256(filePath: string): string | null {
  try {
    const buffer = readFileSync(filePath);
    return createHash('sha256').update(buffer).digest('hex');
  } catch {
    return null;
  }
}

function getFileSizeBytes(filePath: string): number | null {
  try {
    return statSync(filePath).size;
  } catch {
    return null;
  }
}

function getLocalIp(): string {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '127.0.0.1';
}

function getLocalMac(): string {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') return addr.mac;
    }
  }
  return '00:00:00:00:00:00';
}

function isBusinessHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 20;
}

function computeEventHmac(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHmac('sha256', getHmacKey()).update(canonical, 'utf8').digest('hex');
}

async function matchWindowsUserToAccount(
  windowsUser: string,
  tenantId: string,
): Promise<string | null> {
  const localUser = windowsUser.includes('\\')
    ? (windowsUser.split('\\').pop() ?? windowsUser)
    : windowsUser;
  const row = await queryOne<AccountRow>(
    `SELECT account_id FROM accounts WHERE tenant_id = ? AND (username = ? OR username = ?) LIMIT 1`,
    [tenantId, windowsUser, localUser],
  );
  return row?.account_id ?? null;
}

async function insertAlert(
  tenantId: string,
  severity: 'CRITICAL' | 'HIGH',
  code: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const alertId  = uuidv4();
  const dedupKey = `${code}:${tenantId}:${String(detail['filePath'] ?? '')}`;
  try {
    await execute(
      `INSERT INTO alerts (alert_id, tenant_id, alert_code, severity, detail, dedup_key)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE alert_id = alert_id`,
      [alertId, tenantId, code, severity, JSON.stringify(detail), dedupKey],
    );
  } catch {
    // dedup collision — ignore
  }
}

// ── Debounce map to avoid duplicate events within 800ms ──────────────────────
const debounce = new Map<string, ReturnType<typeof setTimeout>>();

function debounced(key: string, fn: () => void, ms = 800): void {
  const existing = debounce.get(key);
  if (existing) clearTimeout(existing);
  debounce.set(key, setTimeout(() => { debounce.delete(key); fn(); }, ms));
}

// ── Skip noisy system files ───────────────────────────────────────────────────
const SKIP_PATTERNS = [/~\$/, /\.tmp$/, /\.lock$/, /\.lnk$/, /desktop\.ini$/i, /thumbs\.db$/i, /\.DS_Store$/];

function shouldSkip(filePath: string): boolean {
  const base = path.basename(filePath);
  return SKIP_PATTERNS.some((p) => p.test(base));
}

// ── Core event handler ────────────────────────────────────────────────────────

async function handleFileEvent(
  dir: MonitoredDirectory,
  filePath: string,
  eventType: EventType,
): Promise<void> {
  if (shouldSkip(filePath)) return;

  const fileName       = path.basename(filePath);
  const windowsUser    = getCurrentWindowsUser();
  const actorIp        = getLocalIp();
  const actorMac       = getLocalMac();
  const actorHostname  = os.hostname();
  const actorAccountId = await matchWindowsUserToAccount(windowsUser, dir.tenant_id);

  const existing = await queryOne<FileStateRow>(
    `SELECT id, hash_sha256, file_size_bytes FROM file_states
     WHERE directory_id = ? AND file_path = ?`,
    [dir.id, filePath],
  );

  const hashBefore  = existing?.hash_sha256 ?? null;
  const sizeBefore  = existing?.file_size_bytes ?? null;
  const hashAfter   = (eventType !== 'deleted') ? computeFileSHA256(filePath) : null;
  const sizeAfter   = (eventType !== 'deleted') ? getFileSizeBytes(filePath)  : null;
  const hashChanged = hashBefore !== null && hashAfter !== null && hashBefore !== hashAfter;

  // ── Flag logic ────────────────────────────────────────────────────────────
  let flag: EventFlag = 'CLEAN';
  let flagReason: string | null = null;

  if (eventType === 'deleted') {
    flag       = 'CRITICAL';
    flagReason = 'File deleted from monitored directory';
  } else if (eventType === 'renamed') {
    flag       = 'SUSPICIOUS';
    flagReason = 'File renamed — integrity check required';
  } else if (hashChanged) {
    if (!actorAccountId) {
      flag       = 'CRITICAL';
      flagReason = 'File modified by unrecognised actor (no matching SecureWatch account)';
    } else if (!isBusinessHours()) {
      flag       = 'CRITICAL';
      flagReason = 'File modified outside business hours (07:00–20:00)';
    } else {
      flag       = 'CLEAN';
      flagReason = null;
    }
  }

  // ── Build and persist event ───────────────────────────────────────────────
  const eventId    = uuidv4();
  const occurredAt = new Date();

  const hmacPayload: Record<string, unknown> = {
    id: eventId, tenantId: dir.tenant_id, directoryId: dir.id,
    filePath, fileName, eventType, hashBefore, hashAfter,
    actorWindowsUser: windowsUser, actorAccountId, actorIp, actorMac, actorHostname,
    eventFlag: flag, occurredAt: occurredAt.toISOString(),
  };
  const hmacSig = computeEventHmac(hmacPayload);

  await execute(
    `INSERT INTO monitored_file_events
       (id, tenant_id, directory_id, file_path, file_name, event_type,
        hash_before, hash_after, hash_changed,
        actor_windows_user, actor_account_id, actor_ip, actor_mac, actor_hostname,
        file_size_before, file_size_after,
        event_flag, flag_reason, hmac_signature, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId, dir.tenant_id, dir.id, filePath, fileName, eventType,
      hashBefore, hashAfter, hashChanged ? 1 : 0,
      windowsUser, actorAccountId, actorIp, actorMac, actorHostname,
      sizeBefore, sizeAfter,
      flag, flagReason, hmacSig, occurredAt,
    ],
  );

  // ── Update file_states ────────────────────────────────────────────────────
  if (eventType === 'deleted') {
    if (existing) {
      await execute(
        `UPDATE file_states SET hash_sha256 = NULL, last_seen_at = ? WHERE id = ?`,
        [occurredAt, existing.id],
      );
    }
  } else if (existing) {
    await execute(
      `UPDATE file_states SET hash_sha256 = ?, file_size_bytes = ?, last_seen_at = ? WHERE id = ?`,
      [hashAfter, sizeAfter, occurredAt, existing.id],
    );
  } else {
    await execute(
      `INSERT INTO file_states (id, directory_id, file_path, file_name, hash_sha256, file_size_bytes, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), dir.id, filePath, fileName, hashAfter, sizeAfter, occurredAt],
    );
  }

  // ── Fire alert + audit for CRITICAL/SUSPICIOUS ────────────────────────────
  if (flag === 'CRITICAL' || flag === 'SUSPICIOUS') {
    const severity  = flag === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
    const alertCode = flag === 'CRITICAL' ? 'C4' : 'H3';
    await insertAlert(dir.tenant_id, severity, alertCode, {
      filePath, fileName, eventType, flagReason,
      actorWindowsUser: windowsUser, actorIp, directoryId: dir.id,
    });
    await writeAuditEvent({
      tenantId:       dir.tenant_id,
      eventType:      `FILE_${eventType.toUpperCase()}_${flag}`,
      actorAccountId: actorAccountId,
      actorIp:        actorIp,
      actorDeviceId:  null,
      resourceId:     dir.resource_id,
      resourcePath:   filePath,
      outcome:        'FLAGGED',
      layerFailed:    null,
      detail:         { fileName, eventType, flag, flagReason, hashChanged, windowsUser },
      severity:       severity,
      timestamp:      occurredAt,
    });
  }
}

// ── FileWatcher class ─────────────────────────────────────────────────────────

export class FileWatcher {
  private watchers: Map<string, FSWatcher> = new Map();

  async startWatching(dir: MonitoredDirectory): Promise<void> {
    if (this.watchers.has(dir.id)) return;

    const watcher = chokidarWatch(dir.path, {
      persistent:    true,
      ignoreInitial: true,
      depth:         dir.is_recursive === 1 ? undefined : 0,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    }) as unknown as FSWatcher;

    watcher.on('add',    (p: unknown) => {
      const fp = String(p);
      debounced(`add:${fp}`, () => { void handleFileEvent(dir, fp, 'created'); });
    });
    watcher.on('change', (p: unknown) => {
      const fp = String(p);
      debounced(`chg:${fp}`, () => { void handleFileEvent(dir, fp, 'modified'); });
    });
    watcher.on('unlink', (p: unknown) => {
      const fp = String(p);
      debounced(`del:${fp}`, () => { void handleFileEvent(dir, fp, 'deleted'); });
    });
    watcher.on('error',  (err: unknown) => {
      console.error(`[FileWatcher] Error watching ${dir.path}:`, err);
    });

    this.watchers.set(dir.id, watcher);
    console.log(`[FileWatcher] Watching: ${dir.path} (id=${dir.id})`);
  }

  async stopWatching(directoryId: string): Promise<void> {
    const watcher = this.watchers.get(directoryId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(directoryId);
    }
  }

  async startAllActive(): Promise<void> {
    const dirs = await query<MonitoredDirectory>(
      `SELECT id, tenant_id, resource_id, path, label, is_recursive
       FROM monitored_directories WHERE status = 'active'`,
    );
    for (const dir of dirs) {
      await this.startWatching(dir);
    }
    console.log(`[FileWatcher] Started ${dirs.length} active watcher(s)`);
  }
}

export const fileWatcher = new FileWatcher();
