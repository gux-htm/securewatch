/**
 * SecureWatch File System Watcher
 *
 * Watches WATCH_PATH recursively. On every file change:
 *   1. Computes SHA-256 of the file
 *   2. Determines the action (created / changed / deleted / renamed)
 *   3. POSTs a structured access event to /api/v1/access-events/raw
 *      which runs ACL check + hash comparison + audit log + alert
 *
 * Run with: npm run watcher
 *
 * .env variables:
 *   WATCH_PATH=C:\Users\YourName   directory to monitor (default: C:\Users)
 *   WATCHER_SECRET=dev-watcher-secret
 *   API_URL=http://localhost:3001
 *   DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000001
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

const WATCH_PATH     = process.env['WATCH_PATH']        ?? process.env['USERPROFILE'] ?? 'C:\\Users';
const WATCHER_SECRET = process.env['WATCHER_SECRET']    ?? 'dev-watcher-secret';
const API_URL        = process.env['API_URL']           ?? 'http://localhost:3001';
const TENANT_ID      = process.env['DEFAULT_TENANT_ID'] ?? '00000000-0000-0000-0000-000000000001';
const ENDPOINT_PATH  = '/api/v1/access-events/raw';

// Debounce — avoid duplicate events for the same file within 800ms
const debounce = new Map<string, ReturnType<typeof setTimeout>>();

// Skip noisy system files
const SKIP_PATTERNS = [
  /~\$/, /\.tmp$/, /\.lock$/, /\.lnk$/, /desktop\.ini$/i,
  /thumbs\.db$/i, /\.DS_Store$/, /pagefile\.sys$/i,
];

function shouldSkip(filePath: string): boolean {
  const base = path.basename(filePath);
  return SKIP_PATTERNS.some((p) => p.test(base));
}

function sha256File(filePath: string): string | null {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return null; // file deleted or locked
  }
}

function postEvent(payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload);
  const url  = new URL(`${API_URL}${ENDPOINT_PATH}`);

  const options: http.RequestOptions = {
    hostname: url.hostname,
    port:     url.port ? parseInt(url.port, 10) : 3001,
    path:     url.pathname,
    method:   'POST',
    headers: {
      'Content-Type':     'application/json',
      'Content-Length':   Buffer.byteLength(body),
      'x-watcher-secret': WATCHER_SECRET,
    },
  };

  const req = http.request(options, (res) => {
    if (res.statusCode && res.statusCode >= 400) {
      let raw = '';
      res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
      res.on('end', () => {
        console.error(`[watcher] API ${res.statusCode ?? '?'} for ${String(payload['filePath'] ?? '')} — ${raw}`);
      });
    }
  });

  req.on('error', (err) => {
    console.error('[watcher] POST failed:', err.message);
  });

  req.write(body);
  req.end();
}

function resolveAction(eventType: string, filePath: string): 'write' | 'delete' | 'read' {
  if (eventType === 'rename') {
    try { fs.accessSync(filePath); return 'write'; } catch { return 'delete'; }
  }
  // 'change' event — file was modified
  return 'write';
}

function handleEvent(watchDir: string, filename: string | null): void {
  if (!filename) return;

  const filePath = path.join(watchDir, filename);
  if (shouldSkip(filePath)) return;

  const key = filePath;
  const existing = debounce.get(key);
  if (existing) clearTimeout(existing);

  debounce.set(key, setTimeout(() => {
    debounce.delete(key);

    // Determine if file exists (write/create) or was deleted
    let action: 'write' | 'delete' | 'read' = 'write';
    let fileHash: string | null = null;

    try {
      fs.accessSync(filePath);
      // File exists — compute hash
      fileHash = sha256File(filePath);
      action = 'write';
    } catch {
      // File gone — deleted
      action = 'delete';
    }

    const label = action === 'delete' ? 'DELETED ' : 'MODIFIED';
    console.log(`[watcher] ${label} ${filePath}${fileHash ? `  sha256:${fileHash.slice(0, 12)}…` : ''}`);

    postEvent({
      filePath,
      action,
      fileHashSha256: fileHash,
      tenantId: TENANT_ID,
      // actorId is null — watcher doesn't know who did it at OS level
      // The API will match against active sessions if possible
      actorId: null,
    });
  }, 800));
}

function startWatcher(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    console.error(`[watcher] Path does not exist: ${dirPath}`);
    process.exit(1);
  }

  console.log(`\n[watcher] SecureWatch File Integrity Monitor`);
  console.log(`[watcher] Watching : ${dirPath}`);
  console.log(`[watcher] API      : ${API_URL}${ENDPOINT_PATH}`);
  console.log(`[watcher] Tenant   : ${TENANT_ID}`);
  console.log('[watcher] Press Ctrl+C to stop\n');

  try {
    fs.watch(dirPath, { recursive: true }, (_eventType, filename) => {
      handleEvent(dirPath, filename);
    });
  } catch (err) {
    console.error('[watcher] Failed to start:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

startWatcher(WATCH_PATH);
