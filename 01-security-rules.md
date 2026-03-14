# Steering File 01 — Security Rules
## These rules are absolute. You never violate them under any circumstance.

---

## RULE S1 — Denial Response

The ONLY response an end user ever receives when any verification layer fails is:

```json
{ "error": "Access Denied" }
```

**Never include in any API error response:**
- Which layer failed (Layer 1, Layer 2, Layer 3)
- Why it failed (account not found, device unregistered, outside zone)
- Account status (SUSPENDED, REVOKED, EXPIRED)
- Device status (BLACKLISTED, PENDING)
- Any internal system detail, service name, or component name
- Stack traces of any kind

Full denial detail is written ONLY to the audit log and sent ONLY to the Admin notification pipeline. It is never in the HTTP response body.

This rule is enforced at the engine level — not the API layer. The Auth Engine writes `denial_reason` to the audit log. The API layer reads only `outcome: DENIED` and returns `{ error: 'Access Denied' }`. The `denial_reason` field is never passed to the API response object.

---

## RULE S2 — Audit Log Is Indestructible

The audit log (`audit_events` table in TimescaleDB) is permanently non-deletable by any role.

**Three enforcement layers — all three must exist:**

**Layer 1 — Application:**
```typescript
class AuditLogStore {
  async delete(_: never): Promise<never> {
    await this.write({
      event_type: 'AUDIT_LOG_DELETE_ATTEMPTED',
      severity: 'CRITICAL',
    });
    await alertManager.fire('C3');
    throw new Error('Audit log deletion is permanently prohibited');
  }
}
```

**Layer 2 — PostgreSQL:**
```sql
REVOKE DELETE ON audit_events FROM securewatch_app;
```
Run once at DB setup. Never reversed.

**Layer 3 — TimescaleDB append-only mode:**
Enforced at storage engine level.

**Any deletion attempt by any role including Admin:**
- Is blocked immediately
- Generates a CRITICAL alert C3
- Is itself logged as a CRITICAL event in the audit log

---

## RULE S3 — MFA Is Non-Negotiable

Admin MFA cannot be disabled. There is no bypass path.

- MFA is TOTP-based (RFC 6238 — Google Authenticator compatible)
- JWT is only issued AFTER successful MFA verification
- The login flow has two steps: credentials → MFA → JWT
- There is no "remember device" option
- There is no "skip MFA" option
- There is no environment variable or config flag that disables MFA
- Recovery requires offline recovery key + MFA re-verification
- Recovery generates a CRITICAL alert

```typescript
// This check cannot be bypassed, skipped, or made conditional
const mfaValid = await mfaService.verify(admin.id, credentials.mfa_token);
if (!mfaValid) {
  await processAdminAuthFailure(admin.id);
  throw new AuthError('MFA verification failed');
}
// JWT is only generated after this point
```

---

## RULE S4 — No Secrets in Code

Zero secrets in:
- Source code files
- Config files (`.env`, `config.yaml`, `appsettings.json`)
- Kubernetes manifests (except references to Secret objects)
- Docker Compose files
- GitHub Actions workflow files
- Log output of any kind

All secrets live in HashiCorp Vault. Services retrieve secrets from Vault at startup.

Vault paths:
```
secret/securewatch/db/postgres
secret/securewatch/db/timescaledb
secret/securewatch/redis
secret/securewatch/kafka
secret/securewatch/jwt/private
secret/securewatch/jwt/public
secret/securewatch/hmac/audit
secret/securewatch/mfa/totp
secret/securewatch/tls/
```

---

## RULE S5 — Multi-Tenant Isolation

Every database table has a `tenant_id` UUID column. Row-Level Security is enabled at the PostgreSQL level on EVERY table — not just the application level.

```sql
ALTER TABLE [every_table] ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON [every_table]
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

Tenant context is set at connection time:
```typescript
await db.query(`SET app.tenant_id = '${tenantId}'`);
```

The test `'tenant A cannot access tenant B data'` must always pass. If you write code that could return cross-tenant data, that code is wrong.

---

## RULE S6 — TLS 1.3 Only

All external connections use TLS 1.3 exclusively. TLS 1.2 and below are not permitted.

```nginx
ssl_protocols TLSv1.3;
```

Agent connections use mutual TLS (mTLS) — client certificates issued at agent registration.

---

## RULE S7 — HMAC on Every Audit Entry

Every row written to `audit_events` must have an `hmac_signature` field populated before the INSERT. The HMAC key is fetched from Vault. No row is ever inserted without a valid HMAC signature.

```typescript
const hmac = await signLogEntry(entry); // Always called before INSERT
entry.hmac_signature = hmac;
await db.audit_events.insert(entry);
```

---

## RULE S8 — View/Edit History Is Admin Only

The `view_history` and `edit_history` arrays on every resource are never returned to the resource owner. They are returned only to the Admin role.

If a non-Admin account somehow requests this data, return 403. Do not filter — deny entirely.

---

## RULE S9 — Unregistered Source Rejection

Any event arriving at the Integration Layer from a source that is not in the Integration Registry:
1. Is rejected before the payload is examined
2. Generates CRITICAL alert C7
3. Is logged with source IP, timestamp, and rejection reason
4. Never reaches the Event Normalizer

```typescript
if (!isAuthenticatedSource(req)) {
  await auditLog.write({ event: 'UNREGISTERED_SOURCE_ATTEMPT', source_ip: req.ip, severity: 'CRITICAL' });
  await alertManager.fire('C7');
  return res.status(401).send({ error: 'Unauthorized' });
}
```

---

## RULE S10 — Resource Locks on Owner Revocation

When an account is revoked, every resource where `owner_account_id` equals that account is immediately and automatically set to `ownership_status: 'LOCKED'`. This happens atomically in the same transaction as the account revocation. No manual step required.

Locked resources generate CRITICAL alert C8. Locked resources are inaccessible to all users until Admin reassigns ownership.

---

## RULE S11 — Admin Auth Failure Lockout

```
1st failure → LOW alert L2
2nd failure → LOW alert L2 + warning message
3rd+ failure → CRITICAL alert C6 + account locked
```

Account lockout is enforced in Redis (counter) AND in the database (Admin account status). Recovery requires offline recovery key + MFA re-verification.

---

## RULE S12 — AES-256 Encryption at Rest

```
PostgreSQL:   pg_crypto on sensitive columns (denial_reason, personal data)
TimescaleDB:  AES-256 at filesystem level (dm-crypt / LUKS)
Redis:        AES-256 on RDB + AOF persistence
Backups:      AES-256-GCM before upload to cold storage
```

---

*SecureWatch Steering 01 — Security Rules • Non-negotiable • March 2026*
