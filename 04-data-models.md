# Steering File 04 — Data Models & Database Schemas
## These are the exact schemas. Do not add, remove, or rename fields without updating this file.

---

## PostgreSQL Tables (Port 5432)

### tenants
```sql
CREATE TABLE tenants (
  tenant_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','TERMINATED'))
);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
```

### accounts
```sql
CREATE TABLE accounts (
  account_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(tenant_id),
  username            TEXT NOT NULL,
  email               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED','EXPIRED')),
  registered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID NOT NULL,
  last_verified_at    TIMESTAMPTZ,
  failed_login_count  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, username)
);
CREATE INDEX idx_accounts_tenant_status ON accounts(tenant_id, status);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON accounts
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### devices
```sql
CREATE TABLE devices (
  device_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(tenant_id),
  fingerprint      TEXT NOT NULL,
  mac_address      TEXT NOT NULL,
  hostname         TEXT,
  network_zone_id  UUID,
  registered_by    UUID NOT NULL,
  approved_at      TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('REGISTERED','PENDING','BLACKLISTED')),
  blacklist_reason TEXT,
  last_seen        TIMESTAMPTZ,
  UNIQUE (tenant_id, mac_address)
);
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON devices
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### network_zones
```sql
CREATE TABLE network_zones (
  zone_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(tenant_id),
  zone_name   TEXT NOT NULL,
  cidr        CIDR NOT NULL,
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE network_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON network_zones
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### groups
```sql
CREATE TABLE groups (
  group_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(tenant_id),
  group_name  TEXT NOT NULL,
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, group_name)
);
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON groups
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### group_members
```sql
CREATE TABLE group_members (
  group_id    UUID NOT NULL REFERENCES groups(group_id),
  account_id  UUID NOT NULL REFERENCES accounts(account_id),
  added_by    UUID NOT NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, account_id)
);
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
```

### resources
```sql
CREATE TABLE resources (
  resource_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(tenant_id),
  resource_name       TEXT NOT NULL,
  resource_type       TEXT NOT NULL
    CHECK (resource_type IN (
      'FILE','DIRECTORY','DATABASE','TABLE','API',
      'SERVICE','NETWORK_SHARE','APPLICATION','CUSTOM'
    )),
  owner_account_id    UUID REFERENCES accounts(account_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_resource_id  UUID REFERENCES resources(resource_id),
  inheritance_active  BOOLEAN NOT NULL DEFAULT FALSE,  -- OFF by default
  ownership_status    TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (ownership_status IN ('ACTIVE','LOCKED','TRANSFERRED')),
  locked_at           TIMESTAMPTZ,
  lock_reason         TEXT
);
CREATE INDEX idx_resources_tenant ON resources(tenant_id);
CREATE INDEX idx_resources_owner ON resources(owner_account_id);
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON resources
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### acl_entries
```sql
CREATE TABLE acl_entries (
  acl_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(tenant_id),
  resource_id         UUID NOT NULL REFERENCES resources(resource_id),
  grantee_type        TEXT NOT NULL CHECK (grantee_type IN ('ACCOUNT','GROUP')),
  grantee_id          UUID NOT NULL,
  permitted_actions   TEXT[] NOT NULL,  -- READ, WRITE, DELETE, EXECUTE, EXPORT
  days_of_week        TEXT[],           -- NULL = all days
  start_time          TIME,             -- NULL = no time restriction
  end_time            TIME,
  granted_by          UUID NOT NULL,
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status              TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','REVOKED')),
  revoked_at          TIMESTAMPTZ,
  revoked_by          UUID
);
CREATE INDEX idx_acl_resource ON acl_entries(resource_id, status);
CREATE INDEX idx_acl_grantee ON acl_entries(grantee_id, tenant_id);
ALTER TABLE acl_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON acl_entries
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

### integration_registry
```sql
CREATE TABLE integration_registry (
  system_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(tenant_id),
  system_name            TEXT NOT NULL,
  system_type            TEXT NOT NULL
    CHECK (system_type IN (
      'DATABASE','FILE_SYSTEM','APPLICATION','CLOUD','LEGACY','DIRECTORY'
    )),
  integration_method     TEXT NOT NULL
    CHECK (integration_method IN ('AGENT','API','LOG_PARSER','SDK')),
  connector_version      TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','DEGRADED','SILENT','DISCONNECTED')),
  registered_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_by          UUID NOT NULL,
  last_event_at          TIMESTAMPTZ,
  health_threshold_mins  INTEGER NOT NULL DEFAULT 5,
  breaking_change        BOOLEAN NOT NULL DEFAULT FALSE,
  admin_approved         BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, system_name)
);
ALTER TABLE integration_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON integration_registry
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

---

## TimescaleDB Table (Port 5433)

### audit_events (Hypertable)
```sql
CREATE TABLE audit_events (
  log_id              UUID          NOT NULL,
  tenant_id           UUID          NOT NULL,
  occurred_at         TIMESTAMPTZ   NOT NULL,
  ingested_at         TIMESTAMPTZ   NOT NULL,
  event_category      TEXT          NOT NULL,
  event_type          TEXT          NOT NULL,
  account_id          UUID,
  device_id           UUID,
  source_ip           INET,
  resource_id         UUID,
  resource_type       TEXT,
  action              TEXT,
  outcome             TEXT          NOT NULL,
  failed_layer        TEXT,
  denial_reason       TEXT,         -- ENCRYPTED — Admin eyes only — never in API response
  risk_verdict        TEXT,
  alert_id            UUID,
  raw_event           TEXT,         -- Immutable original log entry
  hmac_signature      TEXT          NOT NULL,
  source_system       TEXT,
  PRIMARY KEY (log_id, occurred_at)
);

SELECT create_hypertable('audit_events', 'occurred_at',
  chunk_time_interval => INTERVAL '1 day');

SELECT add_compression_policy('audit_events', INTERVAL '7 days');

-- Indexes
CREATE INDEX idx_audit_tenant_time ON audit_events(tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_account     ON audit_events(account_id, occurred_at DESC);
CREATE INDEX idx_audit_resource    ON audit_events(resource_id, occurred_at DESC);
CREATE INDEX idx_audit_outcome     ON audit_events(outcome, occurred_at DESC);
CREATE INDEX idx_audit_severity    ON audit_events(risk_verdict, occurred_at DESC);
CREATE INDEX idx_audit_fts ON audit_events USING GIN (
  to_tsvector('english',
    coalesce(event_type,'') || ' ' || coalesce(denial_reason,''))
);

-- Deletion prevention
REVOKE DELETE ON audit_events FROM securewatch_app;
```

---

## TypeScript Interfaces

These interfaces exactly mirror the database schemas. Use them everywhere.

### Core Event Types
```typescript
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
type Layer = 'LAYER_1_ACCOUNT' | 'LAYER_2_NETWORK' | 'LAYER_3_DEVICE';
type Outcome = 'ALLOWED' | 'DENIED' | 'FLAGGED' | 'PENDING';
type RiskVerdict = 'CLEAN' | 'SUSPICIOUS' | 'CRITICAL';
type SourceType = 'AGENT' | 'API' | 'LOG_PARSER' | 'SDK';
type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
type DeviceStatus = 'REGISTERED' | 'PENDING' | 'BLACKLISTED';
type IntegrationStatus = 'ACTIVE' | 'DEGRADED' | 'SILENT' | 'DISCONNECTED';
type OwnershipStatus = 'ACTIVE' | 'LOCKED' | 'TRANSFERRED';
type ResourceType = 'FILE' | 'DIRECTORY' | 'DATABASE' | 'TABLE' | 'API' | 'SERVICE' | 'NETWORK_SHARE' | 'APPLICATION' | 'CUSTOM';
type Action = 'READ' | 'WRITE' | 'DELETE' | 'EXECUTE' | 'EXPORT';

interface UniversalEvent {
  event_id:        string;
  tenant_id:       string;
  normalized_at:   Date;
  source_system:   string;
  source_type:     SourceType;
  raw_event:       string;       // Immutable — never modify
  account_id:      string | null;
  device_id:       string | null;
  source_ip:       string;
  network_zone:    string | null;
  event_category:  'SESSION' | 'RESOURCE' | 'INTEGRATION' | 'SYSTEM';
  event_type:      string;
  resource_id:     string | null;
  resource_type:   string | null;
  occurred_at:     Date;
  ingested_at:     Date;
  outcome:         Outcome;
}

interface VerificationResult {
  verdict:        RiskVerdict;
  layers_passed:  Layer[];
  layers_failed:  Layer[];
  failed_reason:  string | null;  // Admin only — NEVER in HTTP response
  alert_code:     string | null;
}

interface Alert {
  alert_id:     string;
  tenant_id:    string;
  alert_code:   string;
  severity:     Severity;
  triggered_at: Date;
  account_id:   string | null;
  device_id:    string | null;
  resource_id:  string | null;
  system_id:    string | null;
  detail:       string;     // Admin only — NEVER in HTTP response
  dedup_key:    string;
}
```

---

## ACL Conflict Resolution

When a user belongs to multiple groups with conflicting permissions, the most restrictive rule always wins. This is hardcoded — not configurable.

```typescript
// DENY beats ALLOW — always
function mergeRestrictive(grantSets: Privilege[][]): ResolvedPermissions {
  const all = grantSets.flat();
  const actions: Record<string, boolean> = {};
  for (const grant of all) {
    for (const action of ['READ','WRITE','DELETE','EXECUTE','EXPORT']) {
      if (actions[action] === undefined) {
        actions[action] = grant.permitted_actions.includes(action);
      } else {
        // Most restrictive: only ALLOW if ALL grants allow
        actions[action] = actions[action] && grant.permitted_actions.includes(action);
      }
    }
  }
  return actions as ResolvedPermissions;
}
```

---

## Inheritance Rules

- `inheritance_active` defaults to `FALSE` on every resource
- Inheritance must be explicitly enabled by Admin per resource
- When enabled, child resources inherit parent ACL unless explicitly overridden
- Inheritance change requires Admin confirmation
- Every inheritance change is logged

---

*SecureWatch Steering 04 — Data Models • March 2026*
