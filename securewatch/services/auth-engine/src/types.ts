/**
 * Internal types for auth-engine.
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
  denial_reason?: string | null; // Admin only — NEVER in HTTP response
  failed_layer?:  string | null;
  risk_verdict?:  string | null;
  alert_id?:      string | null;
  source_system?: string | null;
  severity?:      Severity;
}

export type AuditWriter = (entry: AuditEntry) => Promise<void>;

export interface TerminationPolicy {
  tenant_id:               string;
  terminate_on_critical:   boolean;
  terminate_on_layer_fail: boolean;
}
