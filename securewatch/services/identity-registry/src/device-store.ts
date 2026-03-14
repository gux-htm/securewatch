/**
 * DeviceStore — CRUD for devices with cache-aside pattern.
 * Every status change invalidates cache immediately.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { DeviceStatus } from '@securewatch/types';
import type { IdentityCache, CachedDevice } from './identity-cache.js';
import type { AuditWriter } from './types.js';

export interface CreateDeviceInput {
  tenant_id:       string;
  fingerprint:     string;
  mac_address:     string;
  hostname?:       string;
  network_zone_id?: string;
  registered_by:   string;
}

export class DeviceStore {
  constructor(
    private readonly db: Pool,
    private readonly cache: IdentityCache,
    private readonly audit: AuditWriter,
  ) {}

  async getById(tenantId: string, deviceId: string): Promise<CachedDevice | null> {
    const cached = await this.cache.getDevice(tenantId, deviceId);
    if (cached) return cached;

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const res = await this.db.query<CachedDevice>(
      `SELECT device_id, tenant_id, fingerprint, mac_address, hostname,
              network_zone_id, status, blacklist_reason
       FROM devices WHERE device_id = $1 AND tenant_id = $2`,
      [deviceId, tenantId],
    );
    const device = res.rows[0] ?? null;
    if (device) await this.cache.setDevice(device);
    return device;
  }

  async list(tenantId: string, page: number, limit: number): Promise<{ rows: CachedDevice[]; total: number }> {
    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const offset = (page - 1) * limit;
    const [rows, count] = await Promise.all([
      this.db.query<CachedDevice>(
        `SELECT device_id, tenant_id, fingerprint, mac_address, hostname,
                network_zone_id, status, blacklist_reason
         FROM devices WHERE tenant_id = $1
         ORDER BY device_id DESC LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset],
      ),
      this.db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM devices WHERE tenant_id = $1`,
        [tenantId],
      ),
    ]);
    return { rows: rows.rows, total: parseInt(count.rows[0]?.count ?? '0', 10) };
  }

  async create(input: CreateDeviceInput): Promise<CachedDevice> {
    const deviceId = randomUUID();
    await this.audit({
      tenant_id:      input.tenant_id,
      event_category: 'SYSTEM',
      event_type:     'DEVICE_REGISTERED',
      device_id:      deviceId,
      outcome:        'ALLOWED',
      source_system:  input.registered_by,
    });

    await this.db.query(`SET app.tenant_id = $1`, [input.tenant_id]);
    const res = await this.db.query<CachedDevice>(
      `INSERT INTO devices
         (device_id, tenant_id, fingerprint, mac_address, hostname, network_zone_id, registered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING device_id, tenant_id, fingerprint, mac_address, hostname,
                 network_zone_id, status, blacklist_reason`,
      [
        deviceId, input.tenant_id, input.fingerprint, input.mac_address,
        input.hostname ?? null, input.network_zone_id ?? null, input.registered_by,
      ],
    );
    const device = res.rows[0];
    if (!device) throw new Error('Device insert returned no row');
    await this.cache.setDevice(device);
    return device;
  }

  async updateStatus(
    tenantId: string,
    deviceId: string,
    status: DeviceStatus,
    adminId: string,
    blacklistReason?: string,
  ): Promise<void> {
    await this.audit({
      tenant_id:      tenantId,
      event_category: 'SYSTEM',
      event_type:     `DEVICE_STATUS_CHANGED_${status}`,
      device_id:      deviceId,
      outcome:        'ALLOWED',
      source_system:  adminId,
      severity:       status === 'BLACKLISTED' ? 'HIGH' : 'LOW',
    });

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    await this.db.query(
      `UPDATE devices
       SET status = $1, blacklist_reason = $2,
           approved_at = CASE WHEN $1 = 'REGISTERED' THEN NOW() ELSE approved_at END
       WHERE device_id = $3 AND tenant_id = $4`,
      [status, blacklistReason ?? null, deviceId, tenantId],
    );
    await this.cache.invalidateDevice(tenantId, deviceId);
  }
}
