-- Migration 006: admin_operators, admin_sessions, termination_policies
-- Phase 2 — Identity & Authorisation

CREATE TABLE IF NOT EXISTS admin_operators (
  admin_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(tenant_id),
  username           TEXT NOT NULL,
  email              TEXT NOT NULL,
  password_hash      TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'ADMIN'
    CHECK (role IN ('ADMIN','SUPER_ADMIN','READ_ONLY')),
  status             TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','LOCKED')),
  mfa_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_ref     TEXT,          -- Vault path to TOTP secret
  recovery_key_hash  TEXT,          -- SHA-256 of offline recovery key
  failed_auth_count  INTEGER NOT NULL DEFAULT 0,
  locked_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at      TIMESTAMPTZ,
  UNIQUE (tenant_id, username),
  UNIQUE (tenant_id, email)
);
CREATE INDEX idx_admin_tenant_status ON admin_operators(tenant_id, status);
ALTER TABLE admin_operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON admin_operators
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS admin_sessions (
  session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES admin_operators(admin_id),
  tenant_id     UUID NOT NULL REFERENCES tenants(tenant_id),
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  revoked_by    UUID,
  status        TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','EXPIRED','REVOKED')),
  source_ip     INET
);
CREATE INDEX idx_sessions_admin ON admin_sessions(admin_id, status);
CREATE INDEX idx_sessions_tenant ON admin_sessions(tenant_id, status);
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON admin_sessions
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS termination_policies (
  tenant_id               UUID PRIMARY KEY REFERENCES tenants(tenant_id),
  terminate_on_critical   BOOLEAN NOT NULL DEFAULT FALSE,
  terminate_on_layer_fail BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by              UUID
);
ALTER TABLE termination_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON termination_policies
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
