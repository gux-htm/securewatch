-- File monitoring tables: monitored_directories, file_states, file_events (new schema)
-- This replaces/extends the earlier file_events table with full forensic detail.

CREATE TABLE IF NOT EXISTS monitored_directories (
  id            CHAR(36)       NOT NULL DEFAULT (UUID()),
  tenant_id     CHAR(36)       NOT NULL,
  resource_id   CHAR(36)       NOT NULL,
  path          VARCHAR(1024)  NOT NULL,
  label         VARCHAR(255)   NULL,
  is_recursive  TINYINT(1)     NOT NULL DEFAULT 1,
  status        ENUM('active','paused') NOT NULL DEFAULT 'active',
  created_at    DATETIME       NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  INDEX idx_md_tenant (tenant_id),
  INDEX idx_md_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS file_states (
  id                CHAR(36)       NOT NULL DEFAULT (UUID()),
  directory_id      CHAR(36)       NOT NULL,
  file_path         VARCHAR(1024)  NOT NULL,
  file_name         VARCHAR(255)   NOT NULL,
  hash_sha256       CHAR(64)       NULL,
  file_size_bytes   BIGINT         NULL,
  last_seen_at      DATETIME       NULL,
  created_at        DATETIME       NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_file_state (directory_id, file_path(512)),
  INDEX idx_fs_directory (directory_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS monitored_file_events (
  id                  CHAR(36)       NOT NULL DEFAULT (UUID()),
  tenant_id           CHAR(36)       NOT NULL,
  directory_id        CHAR(36)       NOT NULL,
  file_path           VARCHAR(1024)  NOT NULL,
  file_name           VARCHAR(255)   NOT NULL,
  event_type          ENUM('created','modified','deleted','accessed','renamed','permission_changed') NOT NULL,
  hash_before         CHAR(64)       NULL,
  hash_after          CHAR(64)       NULL,
  hash_changed        TINYINT(1)     NOT NULL DEFAULT 0,
  actor_windows_user  VARCHAR(255)   NULL,
  actor_account_id    CHAR(36)       NULL,
  actor_ip            VARCHAR(45)    NULL,
  actor_mac           VARCHAR(17)    NULL,
  actor_hostname      VARCHAR(255)   NULL,
  file_size_before    BIGINT         NULL,
  file_size_after     BIGINT         NULL,
  event_flag          ENUM('CLEAN','SUSPICIOUS','CRITICAL') NOT NULL DEFAULT 'CLEAN',
  flag_reason         VARCHAR(500)   NULL,
  hmac_signature      CHAR(64)       NOT NULL,
  occurred_at         DATETIME       NOT NULL,
  created_at          DATETIME       NOT NULL DEFAULT NOW(),
  acknowledged        TINYINT(1)     NOT NULL DEFAULT 0,
  acknowledged_by     CHAR(36)       NULL,
  acknowledged_at     DATETIME       NULL,
  blocked             TINYINT(1)     NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX idx_mfe_tenant_time (tenant_id, occurred_at DESC),
  INDEX idx_mfe_directory   (directory_id, occurred_at DESC),
  INDEX idx_mfe_flag        (tenant_id, event_flag, occurred_at DESC),
  INDEX idx_mfe_file_path   (directory_id, file_path(512))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
