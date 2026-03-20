CREATE TABLE IF NOT EXISTS network_zones (
  zone_id    CHAR(36)     NOT NULL DEFAULT (UUID()),
  tenant_id  CHAR(36)     NOT NULL,
  zone_name  VARCHAR(100) NOT NULL,
  cidr       VARCHAR(50)  NOT NULL,
  created_by CHAR(36),
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (zone_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO network_zones (tenant_id, zone_name, cidr, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'LOCAL-DEV',
  '127.0.0.1/32',
  '00000000-0000-0000-0000-000000000002'
);

INSERT IGNORE INTO network_zones (tenant_id, zone_name, cidr, created_by)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'LOCAL-NETWORK',
  '192.168.0.0/16',
  '00000000-0000-0000-0000-000000000002'
);
