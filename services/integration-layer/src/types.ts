/**
 * SecureWatch — Integration Layer types
 * Mirrors TDD §3 and §4 (Universal Event Schema)
 */

export type SourceType = 'AGENT' | 'API' | 'LOG_PARSER' | 'SDK';

export type EventCategory = 'SESSION' | 'RESOURCE' | 'INTEGRATION' | 'SYSTEM';

export type Outcome = 'PENDING' | 'ALLOWED' | 'DENIED' | 'FLAGGED';

/** Raw event as received from any source */
export interface IncomingEvent {
  source_id:   string;      // Registered system UUID
  source_type: SourceType;
  payload:     string;      // Raw event string — immutable
  received_at: string;      // ISO8601 — integration layer receipt time
}

/** Normalised event published to Kafka (TDD §4.3) */
export interface UniversalEvent {
  event_id:        string;
  tenant_id:       string;
  normalized_at:   string;   // ISO8601
  source_system:   string;   // system_id from Integration Registry
  source_type:     SourceType;
  raw_event:       string;   // IMMUTABLE — original log entry, never modified
  account_id:      string | null;
  device_id:       string | null;
  source_ip:       string;
  network_zone:    string | null;
  event_category:  EventCategory;
  event_type:      string;
  resource_id:     string | null;
  resource_type:   string | null;
  occurred_at:     string;   // ISO8601 — from original log
  ingested_at:     string;   // ISO8601 — when Integration Layer received it
  outcome:         Outcome;
}

/** Kafka topic names — must match init-topics.sh */
export const TOPICS = {
  sessionEvents:     'sw.events.session',
  resourceEvents:    'sw.events.resource',
  integrationEvents: 'sw.events.integration',
  systemEvents:      'sw.events.system',
  alertsOutbound:    'sw.alerts.outbound',
} as const;
