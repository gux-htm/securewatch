CREATE TABLE IF NOT EXISTS devices (
  device_id        CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id        CHAR(36)     NOT NULL,
  fingerprint      VARCHAR(255) NOT NULL,
  mac_address      VARCHAR(17),
  hostname         VARCHAR(255),
  network_zone_id  CHAR(36),
  registered_by    CHAR(36),
  approved_at      DATETIME,
  status           ENUM('REGISTERED','PENDING','BLACKLISTED') NOT NULL DEFAULT 'PENDING',
  blacklist_reason TEXT,
  last_seen        DATETIME,
  PRIMARY KEY (device_id),
  UNIQUE KEY uq_fingerprint_tenant (tenant_id, fingerprint),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
