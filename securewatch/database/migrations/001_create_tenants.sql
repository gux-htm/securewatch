-- Migration 001: tenants table
-- node-pg-migrate compatible

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status     TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','TERMINATED'))
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
