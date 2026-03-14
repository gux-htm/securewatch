/**
 * Event Normalizer — converts raw payloads to UniversalEvent schema.
 * TDD section 4. Malformed events are sandboxed and never reach Kafka.
 */

import { randomUUID } from 'crypto';
import type { UniversalEvent, SourceType, RawFormat, EventCategory } from '@securewatch/types';

interface RawPayload {
  // Common fields that may exist in any format
  account_id?:    string;
  user?:          string;
  username?:      string;
  device_id?:     string;
  source_ip?:     string;
  ip?:            string;
  event_type?:    string;
  type?:          string;
  action?:        string;
  resource_id?:   string;
  resource_type?: string;
  occurred_at?:   string;
  timestamp?:     string;
  ts?:            string;
  category?:      string;
  network_zone?:  string;
  outcome?:       string;
}

export function detectFormat(raw: string): RawFormat {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'JSON';
  if (trimmed.startsWith('<')) return 'WINDOWS_EVT';
  if (trimmed.startsWith('CEF:')) return 'CEF';
  if (trimmed.startsWith('LEEF:')) return 'LEEF';
  if (trimmed.includes('|') && trimmed.split('|').length > 4) return 'CSV';
  if (/^\w+=/.test(trimmed)) return 'KEY_VALUE';
  // Syslog RFC5424: <priority>version timestamp
  if (/^<\d+>\d+ \d{4}-\d{2}-\d{2}/.test(trimmed)) return 'SYSLOG_RFC5424';
  // Syslog RFC3164: <priority>Month Day
  if (/^<\d+>[A-Z][a-z]{2}\s+\d/.test(trimmed)) return 'SYSLOG_RFC3164';
  return 'PLAIN_TEXT';
}

function parsePayload(raw: string, format: RawFormat): RawPayload {
  switch (format) {
    case 'JSON': {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return {};
      return parsed as RawPayload;
    }
    case 'KEY_VALUE': {
      const result: Record<string, string> = {};
      for (const pair of raw.split(' ')) {
        const idx = pair.indexOf('=');
        if (idx > 0) {
          result[pair.slice(0, idx)] = pair.slice(idx + 1);
        }
      }
      return result as RawPayload;
    }
    default:
      // Best-effort extraction for other formats
      return {};
  }
}

function resolveCategory(parsed: RawPayload): EventCategory {
  const cat = (parsed.category ?? '').toUpperCase();
  if (cat === 'SESSION' || cat === 'RESOURCE' || cat === 'INTEGRATION' || cat === 'SYSTEM') {
    return cat as EventCategory;
  }
  const type = (parsed.event_type ?? parsed.type ?? '').toUpperCase();
  if (['LOGIN', 'LOGOUT', 'AUTH_FAIL', 'SESSION_ACTIVE'].includes(type)) return 'SESSION';
  if (['READ', 'WRITE', 'DELETE', 'EXECUTE', 'EXPORT'].includes(type)) return 'RESOURCE';
  return 'SYSTEM';
}

function resolveTimestamp(parsed: RawPayload): Date {
  const raw = parsed.occurred_at ?? parsed.timestamp ?? parsed.ts;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function normalizeEvent(
  rawString: string,
  sourceId: string,
  sourceType: SourceType,
  tenantId: string,
  receivedAt: Date,
): UniversalEvent {
  const format = detectFormat(rawString);
  const parsed = parsePayload(rawString, format);
  const now = new Date();

  return {
    event_id:       randomUUID(),
    tenant_id:      tenantId,
    normalized_at:  now,
    source_system:  sourceId,
    source_type:    sourceType,
    raw_event:      rawString, // Immutable — never modified after this point
    account_id:     parsed.account_id ?? parsed.user ?? parsed.username ?? null,
    device_id:      parsed.device_id ?? null,
    source_ip:      parsed.source_ip ?? parsed.ip ?? '',
    network_zone:   parsed.network_zone ?? null,
    event_category: resolveCategory(parsed),
    event_type:     parsed.event_type ?? parsed.type ?? parsed.action ?? 'UNKNOWN',
    resource_id:    parsed.resource_id ?? null,
    resource_type:  parsed.resource_type ?? null,
    occurred_at:    resolveTimestamp(parsed),
    ingested_at:    receivedAt,
    outcome:        'PENDING',
  };
}
