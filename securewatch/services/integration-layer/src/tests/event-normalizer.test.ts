import { describe, it, expect } from 'vitest';
import { detectFormat, normalizeEvent } from '../event-normalizer.js';

describe('detectFormat', () => {
  it('detects JSON', () => {
    expect(detectFormat('{"event_type":"LOGIN"}')).toBe('JSON');
  });

  it('detects CEF', () => {
    expect(detectFormat('CEF:0|vendor|product|1.0|100|Login|5|')).toBe('CEF');
  });

  it('detects KEY_VALUE', () => {
    expect(detectFormat('event_type=LOGIN user=alice ip=10.0.0.1')).toBe('KEY_VALUE');
  });

  it('falls back to PLAIN_TEXT', () => {
    expect(detectFormat('some random log line')).toBe('PLAIN_TEXT');
  });
});

describe('normalizeEvent', () => {
  const sourceId = 'sys-001';
  const tenantId = 'tenant-abc';
  const receivedAt = new Date('2026-03-14T10:00:00Z');

  it('produces a valid UniversalEvent from JSON payload', () => {
    const raw = JSON.stringify({
      event_type: 'LOGIN',
      account_id: 'acc-123',
      source_ip:  '192.168.1.10',
      category:   'SESSION',
    });

    const event = normalizeEvent(raw, sourceId, 'API', tenantId, receivedAt);

    expect(event.event_id).toBeTruthy();
    expect(event.tenant_id).toBe(tenantId);
    expect(event.source_system).toBe(sourceId);
    expect(event.source_type).toBe('API');
    expect(event.account_id).toBe('acc-123');
    expect(event.source_ip).toBe('192.168.1.10');
    expect(event.event_category).toBe('SESSION');
    expect(event.event_type).toBe('LOGIN');
    expect(event.outcome).toBe('PENDING');
    expect(event.raw_event).toBe(raw); // Immutable — must equal original
  });

  it('preserves raw_event exactly — never modifies it', () => {
    const raw = '{"event_type":"WRITE","resource_id":"res-999"}';
    const event = normalizeEvent(raw, sourceId, 'SDK', tenantId, receivedAt);
    expect(event.raw_event).toBe(raw);
  });

  it('sets outcome to PENDING — auth engine fills this later', () => {
    const raw = '{"event_type":"READ"}';
    const event = normalizeEvent(raw, sourceId, 'AGENT', tenantId, receivedAt);
    expect(event.outcome).toBe('PENDING');
  });

  it('handles malformed JSON by throwing', () => {
    expect(() =>
      normalizeEvent('{bad json', sourceId, 'API', tenantId, receivedAt)
    ).toThrow();
  });

  it('resolves SESSION category from LOGIN event_type', () => {
    const raw = JSON.stringify({ event_type: 'LOGIN' });
    const event = normalizeEvent(raw, sourceId, 'API', tenantId, receivedAt);
    expect(event.event_category).toBe('SESSION');
  });

  it('resolves RESOURCE category from WRITE event_type', () => {
    const raw = JSON.stringify({ event_type: 'WRITE' });
    const event = normalizeEvent(raw, sourceId, 'API', tenantId, receivedAt);
    expect(event.event_category).toBe('RESOURCE');
  });
});
