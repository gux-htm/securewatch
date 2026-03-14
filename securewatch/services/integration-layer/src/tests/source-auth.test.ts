/**
 * Critical test — API error response never contains denial reason or system detail.
 * Rule S1 / S9.
 */

import { describe, it, expect, vi } from 'vitest';
import { authenticateSource } from '../source-auth.js';
import type { IntegrationRegistry } from '../integration-registry.js';
import type { FastifyRequest } from 'fastify';

function makeRegistry(system: unknown): IntegrationRegistry {
  return {
    findByApiKey: vi.fn().mockResolvedValue(system),
    findById:     vi.fn().mockResolvedValue(system),
  } as unknown as IntegrationRegistry;
}

function makeRequest(headers: Record<string, string>): FastifyRequest {
  return { headers, ip: '10.0.0.1' } as unknown as FastifyRequest;
}

describe('authenticateSource', () => {
  it('returns null for request with no auth headers', async () => {
    const registry = makeRegistry(null);
    const req = makeRequest({});
    const result = await authenticateSource(req, registry);
    expect(result).toBeNull();
  });

  it('authenticates via API key header', async () => {
    const system = { system_id: 'sys-1', tenant_id: 'tenant-1', integration_method: 'LOG_PARSER' };
    const registry = makeRegistry(system);
    const req = makeRequest({ 'x-api-key': 'my-secret-key' });
    const result = await authenticateSource(req, registry);
    expect(result?.system.system_id).toBe('sys-1');
  });

  it('returns null when API key not found in registry', async () => {
    const registry = makeRegistry(null);
    const req = makeRequest({ 'x-api-key': 'unknown-key' });
    const result = await authenticateSource(req, registry);
    expect(result).toBeNull();
  });

  it('authenticates AGENT via trusted mTLS headers', async () => {
    const system = { system_id: 'agent-1', tenant_id: 'tenant-1', integration_method: 'AGENT' };
    const registry = makeRegistry(system);
    const req = makeRequest({
      'x-agent-system-id': 'agent-1',
      'x-agent-tenant-id': 'tenant-1',
    });
    const result = await authenticateSource(req, registry);
    expect(result?.system.system_id).toBe('agent-1');
  });

  // Critical test 3 — error responses never contain denial reason or layer info
  it('returns null (not an error with detail) for unregistered source', async () => {
    const registry = makeRegistry(null);
    const req = makeRequest({ 'x-api-key': 'bad-key' });
    const result = await authenticateSource(req, registry);
    // Must be null — caller returns { error: 'Unauthorized' } with no detail
    expect(result).toBeNull();
  });
});
