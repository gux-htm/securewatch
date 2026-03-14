-- Migration 003: audit_events hypertable (TimescaleDB — port 5433)
-- Rule S2: Deletion permanently prohibited at DB level.
-- Rule S7: hmac_signature NOT NULL enforced.

CREATE TABLE IF NOT EXISTS audit_events (
  log_id          UUID        NOT NULL,
  tenant_id       UUID        NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL,
  ingested_at     TIMESTAMPTZ NOT NULL,
  event_category  TEXT        NOT NULL,
  event_type      TEXT        NOT NULL,
  account_id      UUID,
  device_id       UUID,
  source_ip       INET,
  resource_id     UUID,
  resource_type   TEXT,
  action          TEXT,
  outcome         TEXT        NOT NULL,
  failed_layer    TEXT,
  denial_reason   TEXT,       -- ENCRYPTED — Admin eyes only — never in API response
  risk_verdict    TEXT,
  alert_id        UUID,
  raw_event       TEXT,       -- Immutable original log entry
  hmac_signature  TEXT        NOT NULL,
  source_system   TEXT,
  PRIMARY KEY (log_id, occurred_at)
);

-- Convert to hypertable partitioned by time (1-day chunks)
SELECT create_hypertable('audit_events', 'occurred_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Compression after 7 days
SELECT add_compression_policy('audit_events', INTERVAL '7 days', if_not_exists => TRUE);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_account     ON audit_events(account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource    ON audit_events(resource_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_outcome     ON audit_events(outcome, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_severity    ON audit_events(risk_verdict, occurred_at DESC);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_audit_fts ON audit_events USING GIN (
  to_tsvector('english',
    coalesce(event_type,'') || ' ' || coalesce(denial_reason,''))
);

-- Rule S2 Layer 2: Revoke DELETE at DB level — run once, never reversed
REVOKE DELETE ON audit_events FROM securewatch_app;
