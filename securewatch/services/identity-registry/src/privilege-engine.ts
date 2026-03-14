/**
 * PrivilegeEngine — grant/revoke ACL entries, resolve effective permissions.
 * Most-restrictive conflict resolution: DENY always beats ALLOW — hardcoded, never configurable.
 * Steering file 04: ACL conflict resolution.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { Action } from '@securewatch/types';
import type { AuditWriter } from './types.js';

export interface AclEntry {
  acl_id:            string;
  tenant_id:         string;
  resource_id:       string;
  grantee_type:      'ACCOUNT' | 'GROUP';
  grantee_id:        string;
  permitted_actions: Action[];
  days_of_week:      string[] | null;
  start_time:        string | null;
  end_time:          string | null;
  granted_by:        string;
  granted_at:        string;
  status:            'ACTIVE' | 'REVOKED';
}

export interface GrantInput {
  tenant_id:         string;
  resource_id:       string;
  grantee_type:      'ACCOUNT' | 'GROUP';
  grantee_id:        string;
  permitted_actions: Action[];
  days_of_week?:     string[];
  start_time?:       string;
  end_time?:         string;
  granted_by:        string;
}

export type ResolvedPermissions = Record<Action, boolean>;

const ALL_ACTIONS: Action[] = ['READ', 'WRITE', 'DELETE', 'EXECUTE', 'EXPORT'];

/**
 * Most-restrictive merge — DENY beats ALLOW.
 * Only ALLOW if ALL grant sets allow the action.
 * Hardcoded — never configurable (steering 04).
 */
export function mergeRestrictive(grantSets: Action[][]): ResolvedPermissions {
  const result = {} as ResolvedPermissions;
  for (const action of ALL_ACTIONS) {
    if (grantSets.length === 0) {
      result[action] = false;
    } else {
      // ALLOW only if every grant set includes this action
      result[action] = grantSets.every(set => set.includes(action));
    }
  }
  return result;
}

export class PrivilegeEngine {
  constructor(
    private readonly db: Pool,
    private readonly audit: AuditWriter,
  ) {}

  async grant(input: GrantInput): Promise<AclEntry> {
    const aclId = randomUUID();
    await this.audit({
      tenant_id:      input.tenant_id,
      event_category: 'SYSTEM',
      event_type:     'PRIVILEGE_GRANTED',
      resource_id:    input.resource_id,
      account_id:     input.grantee_type === 'ACCOUNT' ? input.grantee_id : null,
      outcome:        'ALLOWED',
      source_system:  input.granted_by,
      severity:       'LOW',
    });

    await this.db.query(`SET app.tenant_id = $1`, [input.tenant_id]);
    const res = await this.db.query<AclEntry>(
      `INSERT INTO acl_entries
         (acl_id, tenant_id, resource_id, grantee_type, grantee_id,
          permitted_actions, days_of_week, start_time, end_time, granted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING acl_id, tenant_id, resource_id, grantee_type, grantee_id,
                 permitted_actions, days_of_week, start_time, end_time,
                 granted_by, granted_at, status`,
      [
        aclId, input.tenant_id, input.resource_id, input.grantee_type, input.grantee_id,
        input.permitted_actions, input.days_of_week ?? null,
        input.start_time ?? null, input.end_time ?? null, input.granted_by,
      ],
    );
    const entry = res.rows[0];
    if (!entry) throw new Error('ACL insert returned no row');
    return entry;
  }

  async revoke(tenantId: string, aclId: string, adminId: string): Promise<void> {
    await this.audit({
      tenant_id:      tenantId,
      event_category: 'SYSTEM',
      event_type:     'PRIVILEGE_REVOKED',
      outcome:        'ALLOWED',
      source_system:  adminId,
      severity:       'LOW',
    });

    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    await this.db.query(
      `UPDATE acl_entries
       SET status = 'REVOKED', revoked_at = NOW(), revoked_by = $1
       WHERE acl_id = $2 AND tenant_id = $3`,
      [adminId, aclId, tenantId],
    );
  }

  async list(tenantId: string, filter: { account_id?: string; group_id?: string }): Promise<AclEntry[]> {
    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
    const conditions: string[] = ['tenant_id = $1', "status = 'ACTIVE'"];
    const params: unknown[] = [tenantId];

    if (filter.account_id) {
      params.push(filter.account_id);
      conditions.push(`(grantee_type = 'ACCOUNT' AND grantee_id = $${params.length})`);
    }
    if (filter.group_id) {
      params.push(filter.group_id);
      conditions.push(`(grantee_type = 'GROUP' AND grantee_id = $${params.length})`);
    }

    const res = await this.db.query<AclEntry>(
      `SELECT acl_id, tenant_id, resource_id, grantee_type, grantee_id,
              permitted_actions, days_of_week, start_time, end_time,
              granted_by, granted_at, status
       FROM acl_entries WHERE ${conditions.join(' AND ')}
       ORDER BY granted_at DESC`,
      params,
    );
    return res.rows;
  }

  /**
   * Resolve effective permissions for an account on a resource.
   * Collects individual grants + all group grants, applies most-restrictive merge.
   */
  async resolveEffective(
    tenantId: string,
    accountId: string,
    resourceId: string,
    groupIds: string[],
  ): Promise<ResolvedPermissions> {
    await this.db.query(`SET app.tenant_id = $1`, [tenantId]);

    // Individual grant
    const indivRes = await this.db.query<{ permitted_actions: Action[] }>(
      `SELECT permitted_actions FROM acl_entries
       WHERE tenant_id = $1 AND resource_id = $2
         AND grantee_type = 'ACCOUNT' AND grantee_id = $3 AND status = 'ACTIVE'`,
      [tenantId, resourceId, accountId],
    );

    const grantSets: Action[][] = indivRes.rows.map(r => r.permitted_actions);

    // Group grants
    if (groupIds.length > 0) {
      const placeholders = groupIds.map((_, i) => `$${i + 4}`).join(',');
      const groupRes = await this.db.query<{ permitted_actions: Action[] }>(
        `SELECT permitted_actions FROM acl_entries
         WHERE tenant_id = $1 AND resource_id = $2
           AND grantee_type = 'GROUP' AND grantee_id IN (${placeholders}) AND status = 'ACTIVE'`,
        [tenantId, resourceId, ...groupIds],
      );
      for (const row of groupRes.rows) grantSets.push(row.permitted_actions);
    }

    return mergeRestrictive(grantSets);
  }
}
