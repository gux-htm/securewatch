CREATE TABLE IF NOT EXISTS accounts (
  account_id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id           CHAR(36)     NOT NULL,
  username            VARCHAR(100) NOT NULL,
  email               VARCHAR(255),
  password_hash       TEXT         NOT NULL,
  status              ENUM('ACTIVE','SUSPENDED','REVOKED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  role                ENUM('ADMIN','USER','SERVICE') NOT NULL DEFAULT 'USER',
  registered_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by          CHAR(36),
  last_verified_at    DATETIME,
  failed_login_count  INT          NOT NULL DEFAULT 0,
  mfa_secret          TEXT,
  mfa_enabled         TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id),
  UNIQUE KEY uq_username_tenant (tenant_id, username),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_accounts_tenant_status ON accounts(tenant_id, status);

-- Default admin account (password: Admin@1234, mfa_enabled=0)
INSERT INTO accounts (
  account_id, tenant_id, username, email, password_hash, status, role, mfa_enabled
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'admin@securewatch.local',
  '$2b$12$cl7JVbPQoIbbnlkHZkf/SuaSyAfIp34kTyWWnvjHe9cpse/WkbK/u',
  'ACTIVE',
  'ADMIN',
  0
) ON DUPLICATE KEY UPDATE
  password_hash = '$2b$12$cl7JVbPQoIbbnlkHZkf/SuaSyAfIp34kTyWWnvjHe9cpse/WkbK/u',
  mfa_enabled   = 0,
  status        = 'ACTIVE';
