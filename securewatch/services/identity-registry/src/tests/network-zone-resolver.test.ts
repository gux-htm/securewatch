/**
 * NetworkZoneResolver tests — CIDR matching, most-specific wins.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkZoneResolver } from '../network-zone-resolver.js';
import type { ZoneEntry } from '../network-zone-resolver.js';

const zones: ZoneEntry[] = [
  { zone_id: 'z-1', zone_name: 'internal',  cidr: '10.0.0.0/8' },
  { zone_id: 'z-2', zone_name: 'dmz',       cidr: '10.10.0.0/16' },
  { zone_id: 'z-3', zone_name: 'corporate', cidr: '192.168.1.0/24' },
];

describe('NetworkZoneResolver', () => {
  let resolver: NetworkZoneResolver;

  beforeEach(() => {
    resolver = new NetworkZoneResolver();
    resolver.load(zones);
  });

  it('resolves IP in /8 range', () => {
    const zone = resolver.resolve('10.5.0.1');
    expect(zone?.zone_id).toBe('z-1');
  });

  it('resolves most-specific match — /16 beats /8', () => {
    const zone = resolver.resolve('10.10.5.1');
    expect(zone?.zone_id).toBe('z-2');
  });

  it('resolves /24 range', () => {
    const zone = resolver.resolve('192.168.1.50');
    expect(zone?.zone_id).toBe('z-3');
  });

  it('returns null for IP outside all zones', () => {
    // Critical test — H2 alert fires when this returns null
    expect(resolver.resolve('8.8.8.8')).toBeNull();
  });

  it('returns null for empty zone list', () => {
    const empty = new NetworkZoneResolver();
    empty.load([]);
    expect(resolver.resolve('10.0.0.1')).not.toBeNull();
    expect(empty.resolve('10.0.0.1')).toBeNull();
  });

  it('handles IPv6-mapped IPv4 addresses', () => {
    const zone = resolver.resolve('::ffff:10.0.0.1');
    expect(zone?.zone_id).toBe('z-1');
  });

  it('reports correct size after load', () => {
    expect(resolver.size).toBe(3);
  });

  it('replaces entries on reload', () => {
    resolver.load([{ zone_id: 'z-new', zone_name: 'new', cidr: '172.16.0.0/12' }]);
    expect(resolver.size).toBe(1);
    expect(resolver.resolve('10.0.0.1')).toBeNull();
    expect(resolver.resolve('172.16.1.1')?.zone_id).toBe('z-new');
  });

  it('ignores malformed CIDR entries', () => {
    const r = new NetworkZoneResolver();
    r.load([
      { zone_id: 'bad', zone_name: 'bad', cidr: 'not-a-cidr' },
      { zone_id: 'good', zone_name: 'good', cidr: '10.0.0.0/8' },
    ]);
    expect(r.size).toBe(1);
    expect(r.resolve('10.1.2.3')?.zone_id).toBe('good');
  });

  it('handles /0 CIDR (matches everything)', () => {
    const r = new NetworkZoneResolver();
    r.load([{ zone_id: 'all', zone_name: 'all', cidr: '0.0.0.0/0' }]);
    expect(r.resolve('1.2.3.4')?.zone_id).toBe('all');
    expect(r.resolve('255.255.255.255')?.zone_id).toBe('all');
  });

  it('handles /32 CIDR (exact host match)', () => {
    const r = new NetworkZoneResolver();
    r.load([{ zone_id: 'host', zone_name: 'host', cidr: '10.0.0.1/32' }]);
    expect(r.resolve('10.0.0.1')?.zone_id).toBe('host');
    expect(r.resolve('10.0.0.2')).toBeNull();
  });
});
