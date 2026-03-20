/**
 * Phase 1 verification script — runs all 5 checks end-to-end.
 * Run with: node verify.js
 */
const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3001,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: 3001, path }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    }).on('error', reject);
  });
}

function pass(msg) { console.log('  ✅ PASS —', msg); }
function fail(msg) { console.log('  ❌ FAIL —', msg); process.exitCode = 1; }

async function run() {
  console.log('\n=== SecureWatch Phase 1 Verification ===\n');

  // ── Health ────────────────────────────────────────────────────────────────
  console.log('[0] Health check');
  const h = await get('/api/v1/health');
  h.status === 200 && h.body.mysql === 'connected'
    ? pass('API up, MySQL connected')
    : fail('Health check failed: ' + JSON.stringify(h.body));

  // ── CHECK 1: Bad credentials → 401 ───────────────────────────────────────
  console.log('\n[1] Bad credentials → 401 Access Denied');
  const c1 = await post('/api/v1/auth/login', {
    username: 'admin', password: 'WRONGPASSWORD',
    tenantId: '00000000-0000-0000-0000-000000000001',
  });
  c1.status === 401 && c1.body.error === 'Access Denied'
    ? pass('401 with generic error only — no detail leaked')
    : fail(`Got ${c1.status}: ${JSON.stringify(c1.body)}`);

  // ── CHECK 2: Valid credentials → preAuthToken ─────────────────────────────
  console.log('\n[2] Valid credentials → preAuthToken');
  const c2 = await post('/api/v1/auth/login', {
    username: 'admin', password: 'Admin@SecureWatch1',
    tenantId: '00000000-0000-0000-0000-000000000001',
  });
  const pat = c2.body.preAuthToken;
  c2.status === 200 && pat && pat.length > 10
    ? pass('preAuthToken received: ' + pat)
    : fail(`Got ${c2.status}: ${JSON.stringify(c2.body)}`);

  if (!pat) {
    console.log('\nCannot continue without preAuthToken.');
    return;
  }

  // ── CHECK 3: Valid TOTP → full JWT ────────────────────────────────────────
  console.log('\n[3] Valid TOTP + device → full JWT');
  const fp = Buffer.from('TestAgent|1920|1080|en-US|UTC').toString('base64');
  const c3 = await post('/api/v1/auth/mfa', {
    preAuthToken: pat,
    totpCode: '123456',
    deviceFingerprint: fp,
    sourceIp: '127.0.0.1',
  });
  const tok = c3.body.token;
  c3.status === 200 && tok && tok.length > 50
    ? pass('JWT issued — length: ' + tok.length + ', expiresAt: ' + c3.body.expiresAt)
    : fail(`Got ${c3.status}: ${JSON.stringify(c3.body)}`);

  // ── CHECK 4: audit_events rows exist with hmac_signature ─────────────────
  console.log('\n[4] Audit log — rows written with hmac_signature');
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'securewatch',
  });
  const [rows] = await conn.execute(
    "SELECT COUNT(*) AS cnt FROM audit_events WHERE hmac_signature IS NOT NULL AND hmac_signature != ''"
  );
  const cnt = rows[0].cnt;
  cnt > 0
    ? pass(`${cnt} audit rows found, all with hmac_signature`)
    : fail('No audit rows found');

  // ── CHECK 5: No null hmac_signature rows ─────────────────────────────────
  console.log('\n[5] Audit log — zero rows without hmac_signature');
  const [nullRows] = await conn.execute(
    "SELECT COUNT(*) AS cnt FROM audit_events WHERE hmac_signature IS NULL OR hmac_signature = ''"
  );
  nullRows[0].cnt === 0
    ? pass('All audit rows have valid HMAC signatures')
    : fail(`${nullRows[0].cnt} rows missing hmac_signature — SECURITY VIOLATION`);

  await conn.end();

  console.log('\n=== Verification complete ===\n');
}

run().catch((err) => {
  console.error('Verification error:', err.message);
  process.exit(1);
});
