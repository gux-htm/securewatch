/**
 * ZoneStore — CRUD for network zones.
 * Invalidates zone cache on any change so NetworkZoneResolver reloads.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { IdentityCache, CachedZone } from './identity-cache.js';
import type { AuditWriter } from './types.js';

export class ZoneStore {
  constructor(
    private readonly db: Pool,
    private readonly cache: IdentityCache,
    private readonly audit: AuditWriter,
  ) {}

  async list(tenantId: string): Promise<CachedZone[]> {
    const cached = await this.cache.getZones(tenantId);
    if (cached) return cached;

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const res = await this.db.query<CachedZone>(
      `SELECT zone_id, tenant_id, zone_name, cidr::text AS cidr
       FROM network_zones WHERE tenant_id = $1 ORDER BY zone_name`,
      [tenantId],
    );
    await this.cache.setZones(tenantId, res.rows);
    return res.rows;
  }

  async create(tenantId: string, zoneName: string, cidr: string, createdBy: string): Promise<CachedZone> {
    const zoneId = randomUUID();
    await this.audit({
      tenant_id:      tenantId,
      event_category: 'SYSTEM',
      event_type:     'NETWORK_ZONE_CREATED',
      outcome:        'ALLOWED',
      source_system:  createdBy,
    });

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const res = await this.db.query<CachedZone>(
      `INSERT INTO network_zones (zone_id, tenant_id, zone_name, cidr, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING zone_id, tenant_id, zone_name, cidr::text AS cidr`,
      [zoneId, tenantId, zoneName, cidr, createdBy],
    );
    const zone = res.rows[0];
    if (!zone) throw new Error('Zone insert returned no row');
    await this.cache.invalidateZones(tenantId);
    return zone;
  }

  async delete(tenantId: string, zoneId: string, adminId: string): Promise<void> {
    await this.audit({
      tenant_id:      tenantId,
      event_category: 'SYSTEM',
      event_type:     'NETWORK_ZONE_DELETED',
      outcome:        'ALLOWED',
      source_system:  adminId,
    });

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    await this.db.query(
      `DELETE FROM network_zones WHERE zone_id = $1 AND tenant_id = $2`,
      [zoneId, tenantId],
    );
    await this.cache.invalidateZones(tenantId);
  }
}
