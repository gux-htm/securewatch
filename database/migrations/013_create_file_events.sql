-- File integrity monitoring events table
-- Tracks every file system event with actor identity, hashes, and integrity flag.

CREATE TABLE IF NOT EXISTS file_events (
  id                CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id         CHAR(36)     NOT NULL,
  resource_id       CHAR(36)     NOT NULL,
  resource_path     VARCHAR(512) NOT NULL,
  event_type        ENUM('CREATED','MODIFIED','DELETED','ACCESSED','PERMISSION_CHANGE','UNAUTHORISED_ACCESS_ATTEMPT') NOT NULL,
  actor_username    VARCHAR(128) NOT NULL,
  actor_ip          VARCHAR(45)  NOT NULL,
  actor_mac         VARCHAR(17)  NOT NULL,
  hash_before       CHAR(64)     NULL,
  hash_after        CHAR(64)     NULL,
  hash_changed      TINYINT(1)   NOT NULL DEFAULT 0,
  integrity_flag    ENUM('CLEAN','SUSPICIOUS','CRITICAL') NOT NULL DEFAULT 'CLEAN',
  flag_reason       VARCHAR(255) NULL,
  digital_sig       VARCHAR(512) NOT NULL,
  occurred_at       DATETIME(3)  NOT NULL,
  acknowledged      TINYINT(1)   NOT NULL DEFAULT 0,
  acknowledged_by   CHAR(36)     NULL,
  acknowledged_at   DATETIME     NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (resource_id) REFERENCES resources(resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_file_events_resource
  ON file_events(resource_id, occurred_at DESC);

CREATE INDEX idx_file_events_flag
  ON file_events(tenant_id, integrity_flag, occurred_at DESC);

-- Add integrity tracking columns to resources table
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS current_flag   ENUM('CLEAN','SUSPICIOUS','CRITICAL') NOT NULL DEFAULT 'CLEAN',
  ADD COLUMN IF NOT EXISTS last_event_at  DATETIME NULL,
  ADD COLUMN IF NOT EXISTS last_event_id  CHAR(36) NULL;
