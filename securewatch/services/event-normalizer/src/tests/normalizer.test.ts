/**
 * Event Normalizer tests — TDD section 4.
 * Verifies format detection, sandboxing, raw_event immutability.
 */

import { describe, it, expect } from 'vitest';
import { detectFormat, normalizeEvent } from '../normalizer.js';

const SOURCE_ID = 'sys-001';
const TENANT_ID = 'tenant-abc';
const RECEIVED_AT = new Date('2026-03-14T10:00:00Z');

describe('detectFormat', () => {
  it('detects JSON object', () => {
    expect(detectFormat('{"event_type":"LOGIN"}')).toBe('JSON');
  });

  it('detects JSON array', () => {
    expect(detectFormat('[{"event_type":"LOGIN"}]')).toBe('JSON');
  });

  it('detects CEF', () => {
    expect(detectFormat('CEF:0|vendor|product|1.0|100|Login|5|src=10.0.0.1')).toBe('CEF');
  });

  it('detects LEEF', () => {
    expect(detectFormat('LEEF:1.0|vendor|product|1.0|Login|')).toBe('LEEF');
  });

  it('detects KEY_VALUE', () => {
    expect(detectFormat('event_type=LOGIN user=alice ip=10.0.0.1')).toBe('KEY_VALUE');
  });

  it('detects WINDOWS_EVT (XML)', () => {
    expect(detectFormat('<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">')).toBe('WINDOWS_EVT');
  });

  it('falls back to PLAIN_TEXT for unrecognised format', () => {
    expect(detectFormat('some random log line without structure')).toBe('PLAIN_TEXT');
  });
});

describe('normalizeEvent', () => {
  it('produces a valid UniversalEvent from JSON payload', () => {
    const raw = JSON.stringify({
      event_type: 'LOGIN',
      account_id: 'acc-123',
      source_ip:  '192.168.1.10',
      category:   'SESSION',
    });

    const event = normalizeEvent(raw, SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT);

    expect(event.event_id).toBeTruthy();
    expect(event.tenant_id).toBe(TENANT_ID);
    expect(event.source_system).toBe(SOURCE_ID);
    expect(event.source_type).toBe('API');
    expect(event.account_id).toBe('acc-123');
    expect(event.source_ip).toBe('192.168.1.10');
    expect(event.event_category).toBe('SESSION');
    expect(event.event_type).toBe('LOGIN');
    expect(event.outcome).toBe('PENDING');
  });

  // raw_event immutability — critical requirement
  it('preserves raw_event exactly — never modifies it', () => {
    const raw = '{"event_type":"WRITE","resource_id":"res-999","extra":"data"}';
    const event = normalizeEvent(raw, SOURCE_ID, 'SDK', TENANT_ID, RECEIVED_AT);
    expect(event.raw_event).toBe(raw);
  });

  it('sets outcome to PENDING — auth engine fills this later', () => {
    const raw = '{"event_type":"READ"}';
    const event = normalizeEvent(raw, SOURCE_ID, 'AGENT', TENANT_ID, RECEIVED_AT);
    expect(event.outcome).toBe('PENDING');
  });

  it('throws on malformed JSON — sandboxed', () => {
    expect(() =>
      normalizeEvent('{bad json', SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT)
    ).toThrow();
  });

  it('resolves SESSION category from LOGIN event_type', () => {
    const raw = JSON.stringify({ event_type: 'LOGIN' });
    const event = normalizeEvent(raw, SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT);
    expect(event.event_category).toBe('SESSION');
  });

  it('resolves SESSION category from LOGOUT event_type', () => {
    const raw = JSON.stringify({ event_type: 'LOGOUT' });
    const event = normalizeEvent(raw, SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT);
    expect(event.event_category).toBe('SESSION');
  });

  it('resolves RESOURCE category from WRITE event_type', () => {
    const raw = JSON.stringify({ event_type: 'WRITE' });
    const event = normalizeEvent(raw, SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT);
    expect(event.event_category).toBe('RESOURCE');
  });

  it('resolves RESOURCE category from DELETE event_type', () => {
    const raw = JSON.stringify({ event_type: 'DELETE' });
    const event = normalizeEvent(raw, SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT);
    expect(event.event_category).toBe('RESOURCE');
  });

  it('resolves INTEGRATION category from INTEGRATION_SILENT event_type', () => {
    const raw = JSON.stringify({ event_type: 'INTEGRATION_SILENT' });
    const event = normalizeEvent(raw, SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT);
    expect(event.event_category).toBe('INTEGRATION');
  });

  it('uses occurred_at from payload when present', () => {
    const occurred = '2026-01-15T08:30:00Z';
    const raw = JSON.stringify({ event_type: 'LOGIN', occurred_at: occurred });
    const event = normalizeEvent(raw, SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT);
    expect(event.occurred_at.toISOString()).toBe(new Date(occurred).toISOString());
  });

  it('uses ingested_at from receivedAt parameter', () => {
    const raw = JSON.stringify({ event_type: 'LOGIN' });
    const event = normalizeEvent(raw, SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT);
    expect(event.ingested_at).toBe(RECEIVED_AT);
  });

  it('parses KEY_VALUE format', () => {
    const raw = 'event_type=LOGIN account_id=acc-456 source_ip=10.1.2.3';
    const event = normalizeEvent(raw, SOURCE_ID, 'LOG_PARSER', TENANT_ID, RECEIVED_AT);
    expect(event.event_type).toBe('LOGIN');
    expect(event.account_id).toBe('acc-456');
    expect(event.source_ip).toBe('10.1.2.3');
  });

  it('parses CEF format and extracts event_type', () => {
    const raw = 'CEF:0|Vendor|Product|1.0|100|UserLogin|5|src=10.0.0.1 suser=alice';
    const event = normalizeEvent(raw, SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT);
    expect(event.event_type).toBe('UserLogin');
    expect(event.source_ip).toBe('10.0.0.1');
    expect(event.account_id).toBe('alice');
  });

  it('generates unique event_id for each call', () => {
    const raw = JSON.stringify({ event_type: 'LOGIN' });
    const e1 = normalizeEvent(raw, SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT);
    const e2 = normalizeEvent(raw, SOURCE_ID, 'API', TENANT_ID, RECEIVED_AT);
    expect(e1.event_id).not.toBe(e2.event_id);
  });
});
