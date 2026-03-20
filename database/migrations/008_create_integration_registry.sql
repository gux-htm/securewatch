CREATE TABLE IF NOT EXISTS integration_registry (
  system_id             CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id             CHAR(36)     NOT NULL,
  system_name           VARCHAR(255) NOT NULL,
  system_type           ENUM('DATABASE','FILE_SYSTEM','APPLICATION',
                            'CLOUD','LEGACY','DIRECTORY') NOT NULL,
  integration_method    ENUM('AGENT','API','LOG_PARSER','SDK','FILE_WATCHER') NOT NULL,
  connector_version     VARCHAR(20)  NOT NULL DEFAULT '1.0.0',
  status                ENUM('ACTIVE','DEGRADED','SILENT','DISCONNECTED') NOT NULL DEFAULT 'ACTIVE',
  registered_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  registered_by         CHAR(36),
  last_event_at         DATETIME,
  health_threshold_mins INT          NOT NULL DEFAULT 5,
  PRIMARY KEY (system_id),
  UNIQUE KEY uq_system_tenant (tenant_id, system_name),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
