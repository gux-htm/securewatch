/**
 * GroupStore — CRUD for groups and group membership management.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { AuditWriter } from './types.js';

export interface Group {
  group_id:   string;
  tenant_id:  string;
  group_name: string;
  created_by: string;
  created_at: string;
}

export class GroupStore {
  constructor(
    private readonly db: Pool,
    private readonly audit: AuditWriter,
  ) {}

  async list(tenantId: string): Promise<Group[]> {
    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const res = await this.db.query<Group>(
      `SELECT group_id, tenant_id, group_name, created_by, created_at
       FROM groups WHERE tenant_id = $1 ORDER BY group_name`,
      [tenantId],
    );
    return res.rows;
  }

  async create(tenantId: string, groupName: string, createdBy: string): Promise<Group> {
    const groupId = randomUUID();
    await this.audit({
      tenant_id:      tenantId,
      event_category: 'SYSTEM',
      event_type:     'GROUP_CREATED',
      outcome:        'ALLOWED',
      source_system:  createdBy,
    });

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const res = await this.db.query<Group>(
      `INSERT INTO groups (group_id, tenant_id, group_name, created_by)
       VALUES ($1,$2,$3,$4)
       RETURNING group_id, tenant_id, group_name, created_by, created_at`,
      [groupId, tenantId, groupName, createdBy],
    );
    const group = res.rows[0];
    if (!group) throw new Error('Group insert returned no row');
    return group;
  }

  async delete(tenantId: string, groupId: string, adminId: string): Promise<void> {
    await this.audit({
      tenant_id:      tenantId,
      event_category: 'SYSTEM',
      event_type:     'GROUP_DELETED',
      outcome:        'ALLOWED',
      source_system:  adminId,
    });

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    await this.db.query(
      `DELETE FROM groups WHERE group_id = $1 AND tenant_id = $2`,
      [groupId, tenantId],
    );
  }

  async addMember(tenantId: string, groupId: string, accountId: string, addedBy: string): Promise<void> {
    await this.audit({
      tenant_id:      tenantId,
      event_category: 'SYSTEM',
      event_type:     'GROUP_MEMBER_ADDED',
      account_id:     accountId,
      outcome:        'ALLOWED',
      source_system:  addedBy,
    });

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    await this.db.query(
      `INSERT INTO group_members (group_id, account_id, added_by)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [groupId, accountId, addedBy],
    );
  }

  async removeMember(tenantId: string, groupId: string, accountId: string, adminId: string): Promise<void> {
    await this.audit({
      tenant_id:      tenantId,
      event_category: 'SYSTEM',
      event_type:     'GROUP_MEMBER_REMOVED',
      account_id:     accountId,
      outcome:        'ALLOWED',
      source_system:  adminId,
    });

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    await this.db.query(
      `DELETE FROM group_members WHERE group_id = $1 AND account_id = $2`,
      [groupId, accountId],
    );
  }

  async getMembers(tenantId: string, groupId: string): Promise<string[]> {
    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const res = await this.db.query<{ account_id: string }>(
      `SELECT gm.account_id FROM group_members gm
       JOIN groups g ON g.group_id = gm.group_id
       WHERE gm.group_id = $1 AND g.tenant_id = $2`,
      [groupId, tenantId],
    );
    return res.rows.map(r => r.account_id);
  }
}
