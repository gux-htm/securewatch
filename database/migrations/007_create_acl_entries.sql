CREATE TABLE IF NOT EXISTS acl_entries (
  acl_id            CHAR(36)  NOT NULL DEFAULT (UUID()),
  tenant_id         CHAR(36)  NOT NULL,
  resource_id       CHAR(36)  NOT NULL,
  grantee_type      ENUM('ACCOUNT','GROUP') NOT NULL,
  grantee_id        CHAR(36)  NOT NULL,
  permitted_actions JSON      NOT NULL,
  days_of_week      JSON,
  start_time        TIME,
  end_time          TIME,
  granted_by        CHAR(36),
  granted_at        DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status            ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  revoked_at        DATETIME,
  revoked_by        CHAR(36),
  PRIMARY KEY (acl_id),
  FOREIGN KEY (tenant_id)   REFERENCES tenants(tenant_id),
  FOREIGN KEY (resource_id) REFERENCES resources(resource_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_acl_resource ON acl_entries(resource_id, status);
CREATE INDEX idx_acl_grantee  ON acl_entries(grantee_id, tenant_id);
