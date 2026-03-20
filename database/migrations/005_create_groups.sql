CREATE TABLE IF NOT EXISTS `groups` (
  group_id   CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id  CHAR(36)     NOT NULL,
  group_name VARCHAR(100) NOT NULL,
  created_by CHAR(36),
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id),
  UNIQUE KEY uq_group_tenant (tenant_id, group_name),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS group_members (
  group_id   CHAR(36) NOT NULL,
  account_id CHAR(36) NOT NULL,
  added_by   CHAR(36),
  added_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, account_id),
  FOREIGN KEY (group_id)   REFERENCES `groups`(group_id)   ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
