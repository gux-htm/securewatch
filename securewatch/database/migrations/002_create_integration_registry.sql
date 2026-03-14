-- Migration 002: integration_registry table
-- Required by Integration Layer before any other service

CREATE TABLE IF NOT EXISTS integration_registry (
  system_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(tenant_id),
  system_name           TEXT NOT NULL,
  system_type           TEXT NOT NULL
    CHECK (system_type IN ('DATABASE','FILE_SYSTEM','APPLICATION','CLOUD','LEGACY','DIRECTORY')),
  integration_method    TEXT NOT NULL
    CHECK (integration_method IN ('AGENT','API','LOG_PARSER','SDK')),
  connector_version     TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','DEGRADED','SILENT','DISCONNECTED')),
  registered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_by         UUID NOT NULL,
  last_event_at         TIMESTAMPTZ,
  health_threshold_mins INTEGER NOT NULL DEFAULT 5,
  breaking_change       BOOLEAN NOT NULL DEFAULT FALSE,
  admin_approved        BOOLEAN NOT NULL DEFAULT FALSE,
  api_key_hash          TEXT,  -- SHA-256 hash of API key — never store plaintext
  UNIQUE (tenant_id, system_name)
);

CREATE INDEX idx_integration_tenant ON integration_registry(tenant_id, status);
CREATE INDEX idx_integration_api_key ON integration_registry(api_key_hash) WHERE api_key_hash IS NOT NULL;

ALTER TABLE integration_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON integration_registry
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Grant app role — no DELETE ever (Rule S2 pattern applied to all tables)
REVOKE DELETE ON integration_registry FROM securewatch_app;
