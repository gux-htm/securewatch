CREATE TABLE IF NOT EXISTS resources (
  resource_id        CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id          CHAR(36)     NOT NULL,
  resource_name      VARCHAR(255) NOT NULL,
  resource_path      TEXT,
  resource_type      ENUM('FILE','DIRECTORY','DATABASE','TABLE','API',
                         'SERVICE','NETWORK_SHARE','APPLICATION','CUSTOM')
                         NOT NULL DEFAULT 'FILE',
  owner_account_id   CHAR(36),
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  parent_resource_id CHAR(36),
  inheritance_active TINYINT(1)   NOT NULL DEFAULT 0,
  ownership_status   ENUM('ACTIVE','LOCKED','TRANSFERRED') NOT NULL DEFAULT 'ACTIVE',
  locked_at          DATETIME,
  lock_reason        TEXT,
  PRIMARY KEY (resource_id),
  FOREIGN KEY (tenant_id)          REFERENCES tenants(tenant_id),
  FOREIGN KEY (owner_account_id)   REFERENCES accounts(account_id)  ON DELETE SET NULL,
  FOREIGN KEY (parent_resource_id) REFERENCES resources(resource_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_resources_tenant ON resources(tenant_id);
CREATE INDEX idx_resources_owner  ON resources(owner_account_id);
