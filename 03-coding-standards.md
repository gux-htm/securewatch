# Steering File 03 — Coding Standards
## Every file you generate must follow these standards without exception.

---

## TypeScript Rules

```typescript
// tsconfig.json — these flags are mandatory
{
  "compilerOptions": {
    "strict": true,              // Required
    "noImplicitAny": true,       // Required — no 'any' type ever
    "strictNullChecks": true,    // Required
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

**Never use:**
- `any` type — use `unknown` and narrow with type guards
- Non-null assertion `!.` — use explicit null checks
- `@ts-ignore` or `@ts-expect-error` — fix the underlying issue
- `as SomeType` casts without a preceding type guard
- `Object` type — use specific interfaces

---

## File Naming

```
Services:       kebab-case         integration-layer.ts, auth-engine.ts
Classes:        PascalCase         AuditLogStore, AlertManager
Interfaces:     PascalCase         UniversalEvent, VerificationResult
Types:          PascalCase         Severity, Layer, SourceType
Functions:      camelCase          verifyLayers(), processFailedLogin()
Constants:      SCREAMING_SNAKE    DEDUP_WINDOWS, RATE_LIMITS
DB tables:      snake_case         audit_events, acl_entries, group_members
Kafka topics:   dot.separated      sw.events.session
Redis keys:     colon:separated    account:{tenant_id}:{account_id}
Env vars:       SCREAMING_SNAKE    DB_HOST, KAFKA_BROKERS (dev only — Vault in prod)
```

---

## Error Handling

Every async function uses try/catch. No unhandled promise rejections. No silent failures.

```typescript
// Pattern for all service functions
async function processEvent(event: UniversalEvent): Promise<ProcessResult> {
  try {
    const result = await verify(event);
    return result;
  } catch (err) {
    // Log to audit trail — never swallow errors silently
    await auditLog.write({
      event_type: 'PROCESSING_ERROR',
      error: err instanceof Error ? err.message : 'Unknown error',
      event_id: event.event_id,
    });
    // Re-throw or return error result — never return undefined
    throw err;
  }
}
```

**Never:**
- Return `undefined` when a function signature promises a result
- Catch an error and do nothing (empty catch blocks)
- Log raw error objects to external responses
- Include stack traces in HTTP responses

---

## Audit Logging — Every Data Mutation

Every function that creates, modifies, or deletes data in any database table must write an audit log entry. No exceptions.

```typescript
// Pattern — audit log entry must be written BEFORE the mutation completes
async function revokeAccount(accountId: string, adminId: string, tenantId: string): Promise<void> {
  // 1. Write audit entry
  await auditLog.write({
    event_type: 'ACCOUNT_REVOKED',
    account_id: accountId,
    performed_by: adminId,
    tenant_id: tenantId,
    severity: 'MEDIUM',
  });

  // 2. Perform mutation
  await db.accounts.update({ account_id: accountId }, { status: 'REVOKED' });

  // 3. Side effects
  await lockOwnedResources(accountId, tenantId);
}
```

---

## Database Patterns

**Always use parameterised queries. Never string interpolation in SQL.**

```typescript
// CORRECT
const account = await db.query(
  'SELECT * FROM accounts WHERE account_id = $1 AND tenant_id = $2',
  [accountId, tenantId]
);

// NEVER — SQL injection vulnerability
const account = await db.query(
  `SELECT * FROM accounts WHERE account_id = '${accountId}'`
);
```

**Set tenant context before every query:**
```typescript
await db.query(`SET app.tenant_id = $1`, [tenantId]);
```

**Use transactions for multi-table operations:**
```typescript
await db.transaction(async (trx) => {
  await trx.query(...); // account revocation
  await trx.query(...); // resource locking
  await trx.query(...); // session termination
  // Either all succeed or all rollback
});
```

---

## Kafka Patterns

**Producer — always await confirmation:**
```typescript
const result = await producer.send({
  topic: 'sw.events.session',
  messages: [{ key: event.account_id, value: JSON.stringify(event) }],
});
// result.recordMetadata confirms the write
```

**Consumer — always commit after successful processing:**
```typescript
consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());
    await processEvent(event);
    // Commit is automatic when eachMessage resolves without throwing
  }
});
```

---

## HTTP Response Patterns

**Success:**
```typescript
return res.status(200).send({
  success: true,
  data: result,
  meta: { page: 1, limit: 100, total: count, request_id: requestId }
});
```

**Error (generic — no internal detail):**
```typescript
return res.status(403).send({
  success: false,
  error: {
    code: 'ACCESS_DENIED',
    message: 'Access Denied',
    request_id: requestId
  }
  // NEVER include: denial reason, failed layer, account status, device status
});
```

**Validation error:**
```typescript
return res.status(400).send({
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid request body',
    request_id: requestId
    // Fields: list of invalid fields (not internal system data)
  }
});
```

---

## Testing Standards

```typescript
// Test file naming: [filename].test.ts alongside the source file
// OR: tests/ directory at service root

// Required test structure:
describe('ServiceName', () => {
  describe('functionName', () => {
    it('does the expected thing when given valid input', async () => { ... });
    it('handles the edge case correctly', async () => { ... });
    it('throws/rejects when given invalid input', async () => { ... });
  });
});

// Test database: use a test-specific schema, never production
// Test Redis: use a separate Redis database (DB index 1 for tests)
// Test Kafka: use embedded Kafka (kafkajs testEnvironment)
```

**Four critical tests that must always exist and always pass:**
```typescript
// 1.
it('blocks audit log deletion and fires CRITICAL alert C3', ...);

// 2.
it('tenant A cannot read tenant B resources', ...);

// 3.
it('API error response never contains denial reason or layer info', ...);

// 4.
it('verification is CLEAN only when all three layers pass', ...);
```

---

## Go Coding Standards (Agent)

```go
// gofmt enforced — run before every commit
// golangci-lint must pass with zero warnings
// No CGO — agent must be a single static binary
// Build tags for platform: //go:build linux || darwin || windows

// Error handling — always check, never ignore
result, err := doSomething()
if err != nil {
    return fmt.Errorf("doSomething failed: %w", err)
}

// Agent must:
// - Use minimal memory (target: < 50MB RSS)
// - Forward events only — contain ZERO detection logic
// - Reconnect automatically on connection loss
// - Buffer events locally (max 10,000) during connection outage
```

---

## Environment Configuration

Development only — use `.env` files with these variable names:
```
# .env.development (never commit to git — .gitignore required)
DB_HOST=localhost
DB_PORT=5432
TIMESCALE_PORT=5433
REDIS_HOST=localhost
KAFKA_BROKERS=localhost:9092
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=dev-token-only
NODE_ENV=development
```

Production — all values come from Vault. No `.env` files in production.

---

## Commit Message Format

```
feat(auth-engine): add three-layer verification for session events
fix(audit-log): ensure HMAC is generated before INSERT
test(resource-engine): add ACL conflict resolution test cases
chore(k8s): update integration-layer resource limits
docs(api): add endpoint documentation for /sessions
```

Format: `type(scope): description`
Types: `feat`, `fix`, `test`, `chore`, `docs`, `refactor`, `perf`, `ci`

---

*SecureWatch Steering 03 — Coding Standards • Mandatory • March 2026*
