CREATE TABLE IF NOT EXISTS alerts (
  alert_id     CHAR(36)    NOT NULL DEFAULT (UUID()),
  tenant_id    CHAR(36)    NOT NULL,
  alert_code   VARCHAR(20) NOT NULL,
  severity     ENUM('CRITICAL','HIGH','MEDIUM','LOW','INFO') NOT NULL,
  triggered_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  account_id   CHAR(36),
  device_id    CHAR(36),
  resource_id  CHAR(36),
  system_id    CHAR(36),
  detail       TEXT        NOT NULL,
  acknowledged TINYINT(1)  NOT NULL DEFAULT 0,
  ack_at       DATETIME,
  dedup_key    VARCHAR(255) NOT NULL,
  PRIMARY KEY (alert_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_alerts_severity ON alerts(tenant_id, severity, triggered_at);
CREATE INDEX idx_alerts_unacked  ON alerts(tenant_id, acknowledged);
