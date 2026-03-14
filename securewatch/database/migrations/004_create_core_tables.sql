-- Migration 004: accounts, devices, network_zones, groups, group_members
-- All tables include tenant_id + RLS per steering file 04.

CREATE TABLE IF NOT EXISTS accounts (
  account_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(tenant_id),
  username           TEXT NOT NULL,
  email              TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED','EXPIRED')),
  registered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID NOT NULL,
  last_verified_at   TIMESTAMPTZ,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, username)
);
CREATE INDEX idx_accounts_tenant_status ON accounts(tenant_id, status);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON accounts
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS devices (
  device_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(tenant_id),
  fingerprint     TEXT NOT NULL,
  mac_address     TEXT NOT NULL,
  hostname        TEXT,
  network_zone_id UUID,
  registered_by   UUID NOT NULL,
  approved_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('REGISTERED','PENDING','BLACKLISTED')),
  blacklist_reason TEXT,
  last_seen       TIMESTAMPTZ,
  UNIQUE (tenant_id, mac_address)
);
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON devices
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS network_zones (
  zone_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(tenant_id),
  zone_name  TEXT NOT NULL,
  cidr       CIDR NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE network_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON network_zones
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS groups (
  group_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(tenant_id),
  group_name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, group_name)
);
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON groups
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS group_members (
  group_id   UUID NOT NULL REFERENCES groups(group_id),
  account_id UUID NOT NULL REFERENCES accounts(account_id),
  added_by   UUID NOT NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, account_id)
);
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
