CREATE TABLE IF NOT EXISTS active_sessions (
  session_id    CHAR(36)   NOT NULL DEFAULT (UUID()),
  tenant_id     CHAR(36)   NOT NULL,
  account_id    CHAR(36)   NOT NULL,
  device_id     CHAR(36),
  source_ip     VARCHAR(45),
  network_zone  VARCHAR(100),
  started_at    DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,
  risk_verdict  ENUM('CLEAN','SUSPICIOUS','CRITICAL') NOT NULL DEFAULT 'CLEAN',
  is_terminated TINYINT(1) NOT NULL DEFAULT 0,
  terminated_at DATETIME,
  terminated_by VARCHAR(100),
  PRIMARY KEY (session_id),
  FOREIGN KEY (tenant_id)  REFERENCES tenants(tenant_id),
  FOREIGN KEY (account_id) REFERENCES accounts(account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_sessions_active ON active_sessions(tenant_id, is_terminated);
