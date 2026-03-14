/**
 * IdentityCache — Redis cache-aside for accounts, devices, and network zones.
 * TTL: 60s for accounts/devices, 300s for zones (steering file 02).
 * Invalidated on any status change.
 */

import type { Redis } from 'ioredis';
import type { AccountStatus, DeviceStatus } from '@securewatch/types';

export interface CachedAccount {
  account_id:  string;
  tenant_id:   string;
  username:    string;
  email:       string;
  status:      AccountStatus;
  registered_at: string;
  failed_login_count: number;
}

export interface CachedDevice {
  device_id:       string;
  tenant_id:       string;
  fingerprint:     string;
  mac_address:     string;
  hostname:        string | null;
  network_zone_id: string | null;
  status:          DeviceStatus;
  blacklist_reason: string | null;
}

export interface CachedZone {
  zone_id:   string;
  tenant_id: string;
  zone_name: string;
  cidr:      string;
}

const ACCOUNT_TTL = 60;   // seconds
const DEVICE_TTL  = 60;   // seconds
const ZONE_TTL    = 300;  // seconds

export class IdentityCache {
  constructor(private readonly redis: Redis) {}

  // ── Accounts ──────────────────────────────────────────────────────────────

  private accountKey(tenantId: string, accountId: string): string {
    return `account:${tenantId}:${accountId}`;
  }

  async getAccount(tenantId: string, accountId: string): Promise<CachedAccount | null> {
    const raw = await this.redis.get(this.accountKey(tenantId, accountId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedAccount;
  }

  async setAccount(account: CachedAccount): Promise<void> {
    await this.redis.setex(
      this.accountKey(account.tenant_id, account.account_id),
      ACCOUNT_TTL,
      JSON.stringify(account),
    );
  }

  async invalidateAccount(tenantId: string, accountId: string): Promise<void> {
    await this.redis.del(this.accountKey(tenantId, accountId));
  }

  // ── Devices ───────────────────────────────────────────────────────────────

  private deviceKey(tenantId: string, deviceId: string): string {
    return `device:${tenantId}:${deviceId}`;
  }

  async getDevice(tenantId: string, deviceId: string): Promise<CachedDevice | null> {
    const raw = await this.redis.get(this.deviceKey(tenantId, deviceId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedDevice;
  }

  async setDevice(device: CachedDevice): Promise<void> {
    await this.redis.setex(
      this.deviceKey(device.tenant_id, device.device_id),
      DEVICE_TTL,
      JSON.stringify(device),
    );
  }

  async invalidateDevice(tenantId: string, deviceId: string): Promise<void> {
    await this.redis.del(this.deviceKey(tenantId, deviceId));
  }

  // ── Network Zones ─────────────────────────────────────────────────────────

  private zonesKey(tenantId: string): string {
    return `zones:${tenantId}`;
  }

  async getZones(tenantId: string): Promise<CachedZone[] | null> {
    const raw = await this.redis.get(this.zonesKey(tenantId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedZone[];
  }

  async setZones(tenantId: string, zones: CachedZone[]): Promise<void> {
    await this.redis.setex(this.zonesKey(tenantId), ZONE_TTL, JSON.stringify(zones));
  }

  async invalidateZones(tenantId: string): Promise<void> {
    await this.redis.del(this.zonesKey(tenantId));
  }
}
