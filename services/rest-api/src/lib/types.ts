// Shared types used across lib/, routes/, and middleware/

export type Outcome = 'ALLOWED' | 'DENIED' | 'FLAGGED';
export type LayerFailed = 'ACCOUNT' | 'ZONE' | 'DEVICE';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface AuditPayload {
  tenantId: string;
  eventType: string;
  actorAccountId: string | null;
  actorIp: string | null;
  actorDeviceId: string | null;
  resourceId: string | null;
  resourcePath: string | null;
  outcome: Outcome;
  layerFailed: LayerFailed | null;
  detail: Record<string, unknown>;
  severity: Severity;
  timestamp: Date;
  sourceSystem?: string;
}

export interface VerifyContext {
  accountId: string;
  tenantId: string;
  sourceIp: string;
  deviceFingerprint: string;
  resourceId: string | null;
}

export type VerifyResult =
  | { allowed: true }
  | { allowed: false; layerFailed: LayerFailed };

// Shape of a decoded JWT payload attached to request.user
export interface AuthUser {
  sub: string;        // accountId
  tenantId: string;
  role: string;
  deviceId: string | null;
  jti: string;
  iat: number;
  exp: number;
}
