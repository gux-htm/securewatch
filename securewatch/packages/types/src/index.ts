// Core domain types — mirrors DB schemas exactly per steering file 04

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type Layer = 'LAYER_1_ACCOUNT' | 'LAYER_2_NETWORK' | 'LAYER_3_DEVICE';
export type Outcome = 'ALLOWED' | 'DENIED' | 'FLAGGED' | 'PENDING';
export type RiskVerdict = 'CLEAN' | 'SUSPICIOUS' | 'CRITICAL';
export type SourceType = 'AGENT' | 'API' | 'LOG_PARSER' | 'SDK';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
export type DeviceStatus = 'REGISTERED' | 'PENDING' | 'BLACKLISTED';
export type IntegrationStatus = 'ACTIVE' | 'DEGRADED' | 'SILENT' | 'DISCONNECTED';
export type OwnershipStatus = 'ACTIVE' | 'LOCKED' | 'TRANSFERRED';
export type ResourceType =
  | 'FILE' | 'DIRECTORY' | 'DATABASE' | 'TABLE' | 'API'
  | 'SERVICE' | 'NETWORK_SHARE' | 'APPLICATION' | 'CUSTOM';
export type Action = 'READ' | 'WRITE' | 'DELETE' | 'EXECUTE' | 'EXPORT';
export type EventCategory = 'SESSION' | 'RESOURCE' | 'INTEGRATION' | 'SYSTEM';

export type RawFormat =
  | 'JSON'
  | 'SYSLOG_RFC5424'
  | 'SYSLOG_RFC3164'
  | 'CEF'
  | 'LEEF'
  | 'CSV'
  | 'KEY_VALUE'
  | 'DB_QUERY_LOG'
  | 'WINDOWS_EVT'
  | 'PLAIN_TEXT';

export interface UniversalEvent {
  event_id: string;
  tenant_id: string;
  normalized_at: Date;
  source_system: string;
  source_type: SourceType;
  raw_event: string; // Immutable — never modify
  account_id: string | null;
  device_id: string | null;
  source_ip: string;
  network_zone: string | null;
  event_category: EventCategory;
  event_type: string;
  resource_id: string | null;
  resource_type: string | null;
  occurred_at: Date;
  ingested_at: Date;
  outcome: Outcome;
}

export interface VerificationResult {
  verdict: RiskVerdict;
  layers_passed: Layer[];
  layers_failed: Layer[];
  failed_reason: string | null; // Admin only — NEVER in HTTP response
  alert_code: string | null;
}

export interface Alert {
  alert_id: string;
  tenant_id: string;
  alert_code: string;
  severity: Severity;
  triggered_at: Date;
  account_id: string | null;
  device_id: string | null;
  resource_id: string | null;
  system_id: string | null;
  detail: string; // Admin only — NEVER in HTTP response
  dedup_key: string;
}

export interface SystemConnectionState {
  system_id: string;
  tenant_id: string;
  last_event_at: Date;
  status: IntegrationStatus;
  event_count_1m: number;
  threshold_mins: number;
}

export interface IncomingEvent {
  source_id: string;
  source_type: SourceType;
  payload: unknown;
  received_at: Date;
}

// Rate limit config per source type
export const RATE_LIMITS: Record<SourceType, { requests: number; windowMs: number }> = {
  AGENT:      { requests: 10000, windowMs: 60000 },
  API:        { requests: 5000,  windowMs: 60000 },
  LOG_PARSER: { requests: 2000,  windowMs: 60000 },
  SDK:        { requests: 5000,  windowMs: 60000 },
};

export const DEDUP_WINDOWS: Record<Severity, number> = {
  CRITICAL: 60,
  HIGH:     300,
  MEDIUM:   900,
  LOW:      3600,
  INFO:     3600,
};

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH:     1,
  MEDIUM:   2,
  LOW:      3,
  INFO:     4,
};
