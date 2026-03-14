/**
 * Auth Engine — Phase 2 exports.
 */

export { VerificationEngine } from './verification-engine.js';
export { AdminAuth } from './admin-auth.js';
export { generateMfaSetup, verifyTotp, verifyBackupCode } from './mfa-service.js';
export { issueJwt, initJwtIssuer } from './jwt-issuer.js';
export type { AuditWriter, AuditEntry, TerminationPolicy } from './types.js';
