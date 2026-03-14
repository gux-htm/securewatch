/**
 * Identity Registry — central source of truth for accounts, devices, zones, groups, privileges.
 * Internal service — no HTTP server. Consumed as a library by auth-engine and rest-api.
 */

export { IdentityCache } from './identity-cache.js';
export type { CachedAccount, CachedDevice, CachedZone } from './identity-cache.js';
export { NetworkZoneResolver } from './network-zone-resolver.js';
export type { ZoneEntry } from './network-zone-resolver.js';
export { AccountStore } from './account-store.js';
export type { Account, CreateAccountInput } from './account-store.js';
export { DeviceStore } from './device-store.js';
export type { CreateDeviceInput } from './device-store.js';
export { ZoneStore } from './zone-store.js';
export { GroupStore } from './group-store.js';
export type { Group } from './group-store.js';
export { PrivilegeEngine, mergeRestrictive } from './privilege-engine.js';
export type { AclEntry, GrantInput, ResolvedPermissions } from './privilege-engine.js';
export type { AuditWriter, AuditEntry } from './types.js';
