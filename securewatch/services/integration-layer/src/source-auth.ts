/**
 * Source authentication — validates every incoming event source.
 * Rule S9: Unregistered sources are rejected before payload is examined.
 *
 * Auth methods by integration type:
 *   AGENT      → mTLS (client cert verified by Nginx/TLS layer before reaching here)
 *   API / SDK  → Bearer JWT
 *   LOG_PARSER → API key (hashed with SHA-256)
 */

import { createHash } from 'crypto';
import type { FastifyRequest } from 'fastify';
import type { IntegrationRegistry, RegisteredSystem } from './integration-registry.js';

export interface AuthenticatedSource {
  system: RegisteredSystem;
}

export async function authenticateSource(
  req: FastifyRequest,
  registry: IntegrationRegistry,
): Promise<AuthenticatedSource | null> {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'];

  // API key path (LOG_PARSER)
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.length > 0) {
    const keyHash = createHash('sha256').update(apiKeyHeader).digest('hex');
    const system = await registry.findByApiKey(keyHash);
    if (!system) return null;
    return { system };
  }

  // Bearer token path (API / SDK)
  // Note: full JWT verification is handled by the JWT plugin registered on the route.
  // Here we extract the system_id claim that the JWT plugin attaches to req.user.
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const user = (req as FastifyRequest & { user?: { system_id?: string; tenant_id?: string } }).user;
    if (!user?.system_id || !user.tenant_id) return null;

    const system = await registry.findById(user.system_id, user.tenant_id);
    if (!system) return null;
    return { system };
  }

  // mTLS path (AGENT) — client cert verified upstream by Nginx.
  // The system_id is forwarded in a trusted header set by Nginx.
  const agentSystemId = req.headers['x-agent-system-id'];
  const agentTenantId = req.headers['x-agent-tenant-id'];
  if (typeof agentSystemId === 'string' && typeof agentTenantId === 'string') {
    const system = await registry.findById(agentSystemId, agentTenantId);
    if (!system || system.integration_method !== 'AGENT') return null;
    return { system };
  }

  return null;
}
