/**
 * Integration Registry — tracks all connected systems.
 * Manages source authentication and connection state in Redis.
 */

import { Pool } from 'pg';
import type { Redis } from 'ioredis';
import type { IntegrationStatus, SourceType } from '@securewatch/types';

export interface RegisteredSystem {
  system_id: string;
  tenant_id: string;
  system_name: string;
  system_type: string;
  integration_method: SourceType;
  connector_version: string;
  status: IntegrationStatus;
  health_threshold_mins: number;
  api_key_hash?: string | null;
}

export interface ConnectionState {
  system_id: string;
  tenant_id: string;
  last_event_at: Date;
  status: IntegrationStatus;
  event_count_1m: number;
  threshold_mins: number;
}

export class IntegrationRegistry {
  constructor(
    private readonly db: Pool,
    private readonly redis: Redis,
  ) {}

  async findByApiKey(apiKeyHash: string): Promise<RegisteredSystem | null> {
    const res = await this.db.query<RegisteredSystem>(
      `SELECT system_id, tenant_id, system_name, system_type,
              integration_method, connector_version, status,
              health_threshold_mins
       FROM integration_registry
       WHERE api_key_hash = $1 AND status != 'DISCONNECTED'`,
      [apiKeyHash]
    );
    return res.rows[0] ?? null;
  }

  async findById(systemId: string, tenantId: string): Promise<RegisteredSystem | null> {
    const cacheKey = `integration_state:${systemId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as RegisteredSystem;
    }

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const res = await this.db.query<RegisteredSystem>(
      `SELECT system_id, tenant_id, system_name, system_type,
              integration_method, connector_version, status,
              health_threshold_mins
       FROM integration_registry
       WHERE system_id = $1`,
      [systemId]
    );

    const system = res.rows[0] ?? null;
    if (system) {
      await this.redis.setex(cacheKey, 30, JSON.stringify(system));
    }
    return system;
  }

  async getAllActive(): Promise<RegisteredSystem[]> {
    const res = await this.db.query<RegisteredSystem>(
      `SELECT system_id, tenant_id, system_name, integration_method,
              status, health_threshold_mins
       FROM integration_registry
       WHERE status IN ('ACTIVE','DEGRADED','SILENT')`
    );
    return res.rows;
  }

  async updateStatus(systemId: string, status: IntegrationStatus): Promise<void> {
    await this.db.query(
      `UPDATE integration_registry SET status = $1 WHERE system_id = $2`,
      [status, systemId]
    );
    // Invalidate cache
    await this.redis.del(`integration_state:${systemId}`);
  }

  async recordEvent(systemId: string, tenantId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.query(
      `UPDATE integration_registry SET last_event_at = $1 WHERE system_id = $2`,
      [now, systemId]
    );

    // Increment rolling 1-minute event counter in Redis
    const countKey = `ratelimit:${systemId}:${Math.floor(Date.now() / 60000)}`;
    await this.redis.incr(countKey);
    await this.redis.expire(countKey, 120);

    // Update status to ACTIVE if it was degraded/silent
    await this.db.query(
      `UPDATE integration_registry
       SET status = 'ACTIVE', last_event_at = $1
       WHERE system_id = $2 AND status IN ('DEGRADED','SILENT')`,
      [now, systemId]
    );

    // Invalidate cache
    await this.redis.del(`integration_state:${systemId}`);
  }

  async getConnectionState(systemId: string): Promise<ConnectionState | null> {
    const system = await this.db.query<{
      system_id: string;
      tenant_id: string;
      last_event_at: Date;
      status: IntegrationStatus;
      health_threshold_mins: number;
    }>(
      `SELECT system_id, tenant_id, last_event_at, status, health_threshold_mins
       FROM integration_registry WHERE system_id = $1`,
      [systemId]
    );

    const row = system.rows[0];
    if (!row) return null;

    const countKey = `ratelimit:${systemId}:${Math.floor(Date.now() / 60000)}`;
    const count = parseInt((await this.redis.get(countKey)) ?? '0', 10);

    return {
      system_id:      row.system_id,
      tenant_id:      row.tenant_id,
      last_event_at:  row.last_event_at,
      status:         row.status,
      event_count_1m: count,
      threshold_mins: row.health_threshold_mins,
    };
  }
}
