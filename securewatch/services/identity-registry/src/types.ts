/**
 * Shared internal types for identity-registry service.
 */

import type { Severity } from '@securewatch/types';

export interface AuditEntry {
  tenant_id:      string;
  event_category: string;
  event_type:     string;
  account_id?:    string | null;
  device_id?:     string | null;
  source_ip?:     string | null;
  resource_id?:   string | null;
  action?:        string | null;
  outcome:        string;
  denial_reason?: string | null;
  source_system?: string | null;
  severity?:      Severity;
}

export type AuditWriter = (entry: AuditEntry) => Promise<void>;
