-- Migration 005: resources and acl_entries
-- inheritance_active defaults FALSE per steering file 04.

CREATE TABLE IF NOT EXISTS resources (
  resource_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(tenant_id),
  resource_name      TEXT NOT NULL,
  resource_type      TEXT NOT NULL
    CHECK (resource_type IN (
      'FILE','DIRECTORY','DATABASE','TABLE','API',
      'SERVICE','NETWORK_SHARE','APPLICATION','CUSTOM'
    )),
  owner_account_id   UUID REFERENCES accounts(account_id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_resource_id UUID REFERENCES resources(resource_id),
  inheritance_active BOOLEAN NOT NULL DEFAULT FALSE,
  ownership_status   TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (ownership_status IN ('ACTIVE','LOCKED','TRANSFERRED')),
  locked_at          TIMESTAMPTZ,
  lock_reason        TEXT
);
CREATE INDEX idx_resources_tenant ON resources(tenant_id);
CREATE INDEX idx_resources_owner  ON resources(owner_account_id);
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON resources
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS acl_entries (
  acl_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(tenant_id),
  resource_id       UUID NOT NULL REFERENCES resources(resource_id),
  grantee_type      TEXT NOT NULL CHECK (grantee_type IN ('ACCOUNT','GROUP')),
  grantee_id        UUID NOT NULL,
  permitted_actions TEXT[] NOT NULL,
  days_of_week      TEXT[],
  start_time        TIME,
  end_time          TIME,
  granted_by        UUID NOT NULL,
  granted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','REVOKED')),
  revoked_at        TIMESTAMPTZ,
  revoked_by        UUID
);
CREATE INDEX idx_acl_resource ON acl_entries(resource_id, status);
CREATE INDEX idx_acl_grantee  ON acl_entries(grantee_id, tenant_id);
ALTER TABLE acl_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON acl_entries
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
