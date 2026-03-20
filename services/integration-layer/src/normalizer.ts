/**
 * Event Normalizer — TDD §4
 *
 * Converts raw IncomingEvents to the UniversalEvent schema.
 * Runs each parser in a sandbox — malformed events never reach Kafka.
 * raw_event is preserved immutably.
 */

import { randomUUID } from 'node:crypto';
import { IncomingEvent, UniversalEvent, EventCategory } from './types';

type RawFormat =
  | 'JSON'
  | 'CEF'
  | 'LEEF'
  | 'SYSLOG_RFC5424'
  | 'SYSLOG_RFC3164'
  | 'WINDOWS_EVT'
  | 'PLAIN_TEXT';

function detectFormat(raw: string): RawFormat {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'JSON';
  if (trimmed.startsWith('CEF:'))  return 'CEF';
  if (trimmed.startsWith('LEEF:')) return 'LEEF';
  if (trimmed.startsWith('<'))     return 'WINDOWS_EVT';
  if (/^<\d+>/.test(trimmed))     return 'SYSLOG_RFC5424';
  if (/^\w{3}\s+\d/.test(trimmed)) return 'SYSLOG_RFC3164';
  return 'PLAIN_TEXT';
}

interface ParsedFields {
  account_id:     string | null;
  device_id:      string | null;
  source_ip:      string;
  event_category: EventCategory;
  event_type:     string;
  resource_id:    string | null;
  resource_type:  string | null;
  occurred_at:    string;
}

function parseJson(raw: string): ParsedFields {
  const obj = JSON.parse(raw) as Record<string, unknown>;
  return {
    account_id:     typeof obj['account_id']    === 'string' ? obj['account_id']    : null,
    device_id:      typeof obj['device_id']     === 'string' ? obj['device_id']     : null,
    source_ip:      typeof obj['source_ip']     === 'string' ? obj['source_ip']     : '0.0.0.0',
    event_category: (typeof obj['event_category'] === 'string'
      ? obj['event_category'] : 'SYSTEM') as EventCategory,
    event_type:     typeof obj['event_type']    === 'string' ? obj['event_type']    : 'UNKNOWN',
    resource_id:    typeof obj['resource_id']   === 'string' ? obj['resource_id']   : null,
    resource_type:  typeof obj['resource_type'] === 'string' ? obj['resource_type'] : null,
    occurred_at:    typeof obj['occurred_at']   === 'string'
      ? obj['occurred_at'] : new Date().toISOString(),
  };
}

function parsePlainText(_raw: string): ParsedFields {
  // Best-effort extraction for unstructured logs
  return {
    account_id:     null,
    device_id:      null,
    source_ip:      '0.0.0.0',
    event_category: 'SYSTEM',
    event_type:     'PLAIN_TEXT_EVENT',
    resource_id:    null,
    resource_type:  null,
    occurred_at:    new Date().toISOString(),
  };
}

/**
 * Normalises a raw incoming event into the UniversalEvent schema.
 * Returns null if the event is malformed — caller must log and discard.
 */
export function normalize(
  incoming: IncomingEvent,
  tenantId: string,
): UniversalEvent | null {
  try {
    const format = detectFormat(incoming.payload);

    let fields: ParsedFields;
    switch (format) {
      case 'JSON':
        fields = parseJson(incoming.payload);
        break;
      default:
        // All non-JSON formats fall back to plain-text extraction for now.
        // Phase 4 (Universal Integration Layer) adds full CEF/LEEF/Syslog parsers.
        fields = parsePlainText(incoming.payload);
        break;
    }

    const event: UniversalEvent = {
      event_id:       randomUUID(),
      tenant_id:      tenantId,
      normalized_at:  new Date().toISOString(),
      source_system:  incoming.source_id,
      source_type:    incoming.source_type,
      raw_event:      incoming.payload,   // IMMUTABLE — never modified
      account_id:     fields.account_id,
      device_id:      fields.device_id,
      source_ip:      fields.source_ip,
      network_zone:   null,               // Resolved by Auth Engine (Layer 2)
      event_category: fields.event_category,
      event_type:     fields.event_type,
      resource_id:    fields.resource_id,
      resource_type:  fields.resource_type,
      occurred_at:    fields.occurred_at,
      ingested_at:    incoming.received_at,
      outcome:        'PENDING',
    };

    return event;
  } catch {
    // Malformed event — caller logs and discards (TDD §4.4)
    return null;
  }
}
