-- Replaces TimescaleDB hypertable. MySQL InnoDB handles the audit log.
-- Deletion is prevented at the application layer — the app must never issue
-- DELETE on this table. See audit.service.ts for enforcement.

CREATE TABLE IF NOT EXISTS audit_events (
  log_id         CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id      CHAR(36)     NOT NULL,
  occurred_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ingested_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  event_category VARCHAR(50)  NOT NULL,
  event_type     VARCHAR(100) NOT NULL,
  account_id     CHAR(36),
  device_id      CHAR(36),
  source_ip      VARCHAR(45),
  resource_id    CHAR(36),
  resource_type  VARCHAR(50),
  resource_path  TEXT,
  action         VARCHAR(50),
  outcome        ENUM('ALLOWED','DENIED','FLAGGED') NOT NULL,
  failed_layer   VARCHAR(50),
  denial_reason  TEXT,
  risk_verdict   VARCHAR(20),
  alert_id       CHAR(36),
  raw_event      LONGTEXT,
  hmac_signature VARCHAR(64)  NOT NULL,
  source_system  VARCHAR(255),
  PRIMARY KEY (log_id),
  INDEX idx_audit_tenant_time (tenant_id, occurred_at DESC),
  INDEX idx_audit_account     (account_id, occurred_at DESC),
  INDEX idx_audit_resource    (resource_id, occurred_at DESC),
  INDEX idx_audit_outcome     (outcome, occurred_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- To enforce immutability at the DB level, run this in phpMyAdmin after setup:
-- REVOKE DELETE ON securewatch.audit_events FROM 'root'@'localhost';
