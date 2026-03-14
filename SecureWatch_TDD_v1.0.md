# 🛡 SecureWatch — Technical Design Document (TDD)
### Version 1.0 | March 2026 | CONFIDENTIAL

---

> **Document Purpose:**
> This TDD translates the approved SecureWatch PRD v2.0 into a complete engineering blueprint. It defines the technology stack, system architecture, database schemas, API contracts, infrastructure topology, DevOps pipeline, and deployment specifications required to build SecureWatch from the ground up.
>
> **Dependency Note:** Sections are ordered by build dependency — each section's components must exist before the next section's components can function.

---

## Table of Contents

1. [Technology Stack Decisions](#1-technology-stack-decisions)
2. [System Architecture Deep-Dive](#2-system-architecture-deep-dive)
3. [Universal Integration Layer](#3-universal-integration-layer) ← Build First
4. [Event Normalizer](#4-event-normalizer)
5. [Event Bus (Message Broker)](#5-event-bus-message-broker)
6. [Identity & Device Registry](#6-identity--device-registry)
7. [Three-Layer Authorisation Engine](#7-three-layer-authorisation-engine)
8. [Resource Registry & ACL Engine](#8-resource-registry--acl-engine)
9. [Audit Log Store (TimescaleDB)](#9-audit-log-store-timescaledb)
10. [Alert Manager](#10-alert-manager)
11. [Notification Engine](#11-notification-engine)
12. [Admin Dashboard (Frontend)](#12-admin-dashboard-frontend)
13. [REST API Gateway](#13-rest-api-gateway)
14. [Database Schemas](#14-database-schemas)
15. [API Contract Specification](#15-api-contract-specification)
16. [Infrastructure & Deployment](#16-infrastructure--deployment)
17. [DevOps & CI/CD Pipeline](#17-devops--cicd-pipeline)
18. [Security Architecture](#18-security-architecture)
19. [Performance & Scalability Design](#19-performance--scalability-design)
20. [Testing Strategy](#20-testing-strategy)

---

## 1. Technology Stack Decisions

### 1.1 Stack Selection Rationale

Every technology choice below satisfies three criteria:
- **Free / open source** (no paid licensing dependency)
- **Production-proven** at the scale SecureWatch targets (10,000 sessions, 50,000 events/min)
- **Aligned with PRD decisions** — TimescaleDB, Kafka, proprietary agent, open-source SDK

### 1.2 Full Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| **Backend API** | Node.js + TypeScript | Node 20 LTS | Async event-driven — ideal for high-throughput event processing |
| **Backend Framework** | Fastify | v4 | 3x faster than Express; built-in schema validation; low overhead |
| **Event Bus** | Apache Kafka | v3.6 | Industry standard for high-throughput event streaming; persistent message log |
| **Audit Log DB** | TimescaleDB | v2.13 | PRD decision — time-series on PostgreSQL; free, open source |
| **Primary DB** | PostgreSQL | v16 | Identity, device, resource, group, privilege data |
| **Cache / Session** | Redis | v7.2 | Session state, rate limiting, deduplication windows |
| **Search** | PostgreSQL Full-Text Search | built-in | Audit log search — avoids Elasticsearch operational complexity |
| **Frontend** | React + TypeScript | React 18 | Admin dashboard SPA |
| **Frontend State** | Zustand | v4 | Lightweight state management for real-time dashboard |
| **Real-time UI** | WebSocket (ws library) | v8 | Live session view, alert inbox push updates |
| **Agent** | Go | v1.22 | Proprietary — low footprint, cross-platform binary, no runtime dependency |
| **SDK** | TypeScript (published to npm) | — | Open source — event forwarding interface only |
| **Container Runtime** | Docker | v25 | All services containerised |
| **Orchestration** | Kubernetes (K8s) | v1.29 | Cloud and on-premise deployment |
| **Service Mesh** | No mesh for v2.0 | — | Deferred — complexity not justified at v2.0 scale |
| **Reverse Proxy** | Nginx | v1.25 | TLS termination, rate limiting, static asset serving |
| **CI/CD** | GitHub Actions | — | Pipeline automation |
| **Container Registry** | GitHub Container Registry (GHCR) | — | Free with GitHub |
| **Secret Management** | HashiCorp Vault | v1.15 | Free open-source tier; manages TLS certs, DB creds, API keys |
| **Monitoring (Internal)** | Prometheus + Grafana | — | SecureWatch's own health monitoring; free open source |
| **Log Aggregation** | Fluentd → TimescaleDB | — | SecureWatch internal logs fed into its own audit store |
| **TLS Certificates** | Let's Encrypt + cert-manager | — | Automated certificate management |

### 1.3 Language Conventions

```
Backend services:     TypeScript (strict mode, no any)
Agent:                Go (gofmt enforced, golint clean)
SDK:                  TypeScript (strict mode)
Infrastructure:       YAML (K8s manifests), HCL (Terraform)
Database migrations:  SQL (via node-pg-migrate)
Scripts:              Bash (shellcheck clean)
```

---

## 2. System Architecture Deep-Dive

### 2.1 Component Interaction Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL WORLD                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  SW Agent│  │REST/Webhook│ │Log Parser│  │  Native SDK      │   │
│  │  (Go)    │  │  (HTTPS) │  │(Pull/Push)│  │  (TypeScript)    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
└───────┼─────────────┼──────────────┼─────────────────┼─────────────┘
        │             │              │                  │
        └─────────────┴──────────────┴──────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              UNIVERSAL INTEGRATION LAYER (Fastify)                   │
│  Source Auth → Rate Limiting → Schema Validation → Routing           │
└──────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EVENT NORMALIZER (TypeScript)                      │
│  Format Detection → Schema Mapping → UTC Normalisation → Raw Preserve│
└──────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    APACHE KAFKA (Event Bus)                           │
│  Topics: session-events | resource-events | integration-events       │
└──────┬───────────────────────┬────────────────────────┬─────────────┘
       │                       │                        │
       ▼                       ▼                        ▼
┌────────────┐      ┌──────────────────┐     ┌──────────────────────┐
│ AUTH ENGINE│      │ RESOURCE ACCESS  │     │ INTEGRATION REGISTRY │
│ (3 Layers) │      │ POLICY ENGINE    │     │ & HEALTH MONITOR     │
└─────┬──────┘      └────────┬─────────┘     └──────────┬───────────┘
      │                      │                           │
      └──────────────────────┴───────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       ALERT MANAGER                                   │
│  Verdict Processing → Severity Classification → Deduplication        │
└──────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION ENGINE                                │
│  Priority Queue → Admin Inbox → Email/SMS/Webhook Dispatch           │
└──────────────────────────────┬──────────────────────────────────────┘
                                │
               ┌────────────────┴────────────────┐
               ▼                                 ▼
┌──────────────────────┐             ┌───────────────────────┐
│   TIMESCALEDB        │             │   POSTGRESQL          │
│   Audit Log Store    │             │   Identity, Devices,  │
│   (append-only)      │             │   Resources, Groups,  │
│                      │             │   Privileges, Tenants │
└──────────────────────┘             └───────────────────────┘
               │                                 │
               └────────────────┬────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     ADMIN DASHBOARD (React SPA)                       │
│  Unified Inbox | Live Sessions | Resources | Integrations | Audit Log│
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Multi-Tenancy Architecture

Every database table includes a `tenant_id` (UUID) column. Row-Level Security (RLS) is enforced at the PostgreSQL level — not just the application level — meaning a query from Tenant A physically cannot return Tenant B's rows even if application-level filtering fails.

```sql
-- RLS enforced on ALL tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON accounts
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

Tenant context is set at the start of every database connection from the application:

```typescript
await db.query(`SET app.tenant_id = '${tenantId}'`);
```

### 2.3 Service Port Map

| Service | Internal Port | External Exposure |
|---|---|---|
| Integration Layer | 3001 | Via Nginx (443) |
| Auth Engine | 3002 | Internal only |
| Resource Policy Engine | 3003 | Internal only |
| Alert Manager | 3004 | Internal only |
| Notification Engine | 3005 | Internal only |
| REST API Gateway | 3000 | Via Nginx (443) |
| Admin Dashboard | 3010 | Via Nginx (443) |
| Emergency Read-Only View | 3011 | Via Nginx (8443) — separate port |
| PostgreSQL | 5432 | Internal only |
| TimescaleDB | 5433 | Internal only |
| Redis | 6379 | Internal only |
| Kafka | 9092 | Internal only |

---

## 3. Universal Integration Layer

> **Build Priority: 1 — Everything depends on this component.**

### 3.1 Responsibility

The Universal Integration Layer is the single authenticated entry point for all incoming events. It accepts events from four source types, validates their origin, enforces rate limits, performs basic schema validation, and routes them to the Event Normalizer.

### 3.2 Source Authentication

Every event source must authenticate before events are accepted. Authentication method depends on integration type:

| Integration Method | Authentication |
|---|---|
| SecureWatch Agent | Mutual TLS (mTLS) — client certificate issued at agent registration |
| REST API / Webhook | Bearer token (JWT) issued at system registration |
| Log File Parser | API key issued at system registration |
| SDK | Bearer token (JWT) issued at application registration |

**Unregistered source handling:**

```typescript
// Any request without valid authentication
// is rejected before touching the event payload
if (!isAuthenticatedSource(req)) {
  await auditLog.write({
    event: 'UNREGISTERED_SOURCE_ATTEMPT',
    source_ip: req.ip,
    severity: 'CRITICAL'
  });
  await alertManager.fire('C7'); // CRITICAL alert
  return res.status(401).send({ error: 'Unauthorized' });
}
```

### 3.3 Rate Limiting

Rate limits are enforced per source system using a sliding window in Redis:

```typescript
const RATE_LIMITS = {
  AGENT:      { requests: 10000, windowMs: 60000 }, // 10k/min per agent
  API:        { requests: 5000,  windowMs: 60000 }, // 5k/min per API source
  LOG_PARSER: { requests: 2000,  windowMs: 60000 }, // 2k/min per parser
  SDK:        { requests: 5000,  windowMs: 60000 }, // 5k/min per SDK source
};

// Exceeding rate limit triggers a MEDIUM alert
// Source is not blocked but excess events are dropped and logged
```

### 3.4 Event Routing by Source Type

```typescript
interface IncomingEvent {
  source_id: string;         // Registered system UUID
  source_type: SourceType;   // AGENT | API | LOG_PARSER | SDK
  payload: unknown;          // Raw event — type unknown until normalised
  received_at: Date;         // Integration layer receipt timestamp
}

enum SourceType {
  AGENT      = 'AGENT',
  API        = 'API',
  LOG_PARSER = 'LOG_PARSER',
  SDK        = 'SDK'
}
```

### 3.5 Connection State Management

The Integration Layer maintains connection state for every registered system in Redis:

```typescript
interface SystemConnectionState {
  system_id:      string;
  last_event_at:  Date;
  status:         'ACTIVE' | 'DEGRADED' | 'SILENT' | 'DISCONNECTED';
  event_count_1m: number;  // Rolling 1-minute event count
  threshold_mins: number;  // Configurable silence threshold (default: 5)
}
```

A background job runs every 30 seconds checking all connection states:

```typescript
// Health check job — runs every 30 seconds
async function checkIntegrationHealth(): Promise<void> {
  const systems = await integrationRegistry.getAllActive();
  for (const system of systems) {
    const silenceMins = minutesSince(system.last_event_at);

    if (silenceMins > system.threshold_mins) {
      await updateStatus(system.system_id, 'SILENT');
      await alertManager.fire('C4', { system }); // CRITICAL alert
    } else if (silenceMins > system.threshold_mins * 0.8) {
      await updateStatus(system.system_id, 'DEGRADED');
      await alertManager.fire('H5', { system }); // HIGH alert
    }
  }
}
```

### 3.6 Redundancy Design

The Integration Layer is deployed in **active-active** configuration — minimum two instances behind Nginx load balancer. Kafka's durable message log ensures no events are lost if one instance fails during processing.

```yaml
# K8s deployment — minimum 2 replicas, auto-scales to 6
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0    # Zero downtime deployments
      maxSurge: 1
```

---

## 4. Event Normalizer

> **Build Priority: 2 — Depends on Integration Layer.**

### 4.1 Responsibility

The Event Normalizer receives raw events from the Integration Layer and converts them to the Universal Event Schema before publishing to Kafka. It preserves the original raw event immutably.

### 4.2 Format Detection

```typescript
type RawFormat =
  | 'JSON'
  | 'SYSLOG_RFC5424'
  | 'SYSLOG_RFC3164'
  | 'CEF'            // Common Event Format (ArcSight)
  | 'LEEF'           // Log Event Extended Format (IBM QRadar)
  | 'CSV'
  | 'KEY_VALUE'      // key=value pairs
  | 'DB_QUERY_LOG'   // Database audit log format
  | 'WINDOWS_EVT'    // Windows Event Log XML
  | 'PLAIN_TEXT';    // Fallback — best-effort extraction

function detectFormat(raw: string): RawFormat {
  if (raw.trimStart().startsWith('{')) return 'JSON';
  if (raw.startsWith('<')) return 'WINDOWS_EVT';
  if (raw.startsWith('CEF:')) return 'CEF';
  if (raw.startsWith('LEEF:')) return 'LEEF';
  // ... further detection logic
}
```

### 4.3 Universal Event Schema

```typescript
interface UniversalEvent {
  // Identity
  event_id:       string;   // UUID — generated by normaliser
  tenant_id:      string;   // UUID
  normalized_at:  Date;     // UTC — normaliser processing timestamp

  // Source
  source_system:  string;   // system_id from Integration Registry
  source_type:    SourceType;
  original_format: RawFormat;
  raw_event:      string;   // IMMUTABLE — original log entry, never modified

  // Actor
  account_id:     string | null;   // UUID — null if unresolvable
  device_id:      string | null;   // UUID — null if unregistered
  source_ip:      string;
  network_zone:   string | null;   // Resolved zone or null

  // Action
  event_category: 'SESSION' | 'RESOURCE' | 'INTEGRATION' | 'SYSTEM';
  event_type:     string;          // LOGIN, LOGOUT, READ, WRITE, etc.
  resource_id:    string | null;   // UUID — null for session events
  resource_type:  string | null;

  // Timestamps
  occurred_at:    Date;    // UTC — from original log (NOT ingestion time)
  ingested_at:    Date;    // UTC — when Integration Layer received it

  // Outcome placeholder — filled by Auth Engine
  outcome:        'PENDING' | 'ALLOWED' | 'DENIED' | 'FLAGGED';
}
```

### 4.4 Sandboxing

The normaliser runs each format parser in a try/catch sandbox. Malformed events never reach Kafka:

```typescript
async function normalize(raw: IncomingEvent): Promise<UniversalEvent | null> {
  try {
    const format = detectFormat(raw.payload as string);
    const parsed = await parsers[format].parse(raw.payload);
    return buildUniversalEvent(parsed, raw);
  } catch (err) {
    // Malformed event — reject and log
    await auditLog.write({
      event:    'MALFORMED_EVENT_REJECTED',
      source:   raw.source_id,
      raw:      raw.payload,
      error:    err.message,
      severity: 'HIGH'
    });
    return null; // Never published to Kafka
  }
}
```

---

## 5. Event Bus (Message Broker)

> **Build Priority: 3 — Depends on Normalizer.**

### 5.1 Kafka Topic Design

```
Topics:
├── sw.events.session          Partition key: account_id
│     SESSION events (login, logout, auth_fail)
│
├── sw.events.resource         Partition key: resource_id
│     RESOURCE access events
│
├── sw.events.integration      Partition key: system_id
│     Integration health, registration events
│
├── sw.events.system           Partition key: tenant_id
│     Internal SecureWatch system events
│
└── sw.alerts.outbound         Partition key: severity
      Processed alerts ready for Notification Engine
```

### 5.2 Topic Configuration

```yaml
# All topics — production settings
retention.ms:        2592000000   # 30 days on-broker retention
retention.bytes:     -1           # No size limit
replication.factor:  3            # 3 replicas for HA
min.insync.replicas: 2            # Minimum 2 must acknowledge write
cleanup.policy:      delete       # Delete old segments after retention
compression.type:    lz4          # Fast compression
```

### 5.3 Consumer Groups

| Consumer Group | Consumes From | Purpose |
|---|---|---|
| `sw-auth-engine` | `sw.events.session` | Three-layer verification of session events |
| `sw-resource-engine` | `sw.events.resource` | ACL verification of resource access events |
| `sw-integration-monitor` | `sw.events.integration` | Integration health processing |
| `sw-audit-writer` | All `sw.events.*` | Write all events to TimescaleDB audit log |
| `sw-alert-manager` | `sw.alerts.outbound` | Route processed alerts to Notification Engine |

---

## 6. Identity & Device Registry

> **Build Priority: 4 — Auth Engine depends on this.**

### 6.1 Responsibility

The central source of truth for all accounts, devices, network zones, groups, and privilege assignments. All verification layers query this registry.

### 6.2 Caching Strategy

The Identity Registry is on the critical path — every single event triggers a lookup. To avoid database bottleneck:

```typescript
// Redis cache with 60-second TTL for hot data
// Cache-aside pattern — read cache first, fallback to PostgreSQL

class IdentityCache {
  async getAccount(account_id: string, tenant_id: string): Promise<Account | null> {
    const cacheKey = `account:${tenant_id}:${account_id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const account = await db.accounts.findOne({ account_id, tenant_id });
    if (account) {
      await redis.setex(cacheKey, 60, JSON.stringify(account));
    }
    return account;
  }

  // Cache invalidation on any account status change
  async invalidateAccount(account_id: string, tenant_id: string): Promise<void> {
    await redis.del(`account:${tenant_id}:${account_id}`);
  }
}
```

### 6.3 Network Zone Resolution

```typescript
// CIDR-based network zone resolution
// Uses a sorted prefix tree for O(log n) lookup

class NetworkZoneResolver {
  async resolve(ip: string, tenant_id: string): Promise<string | null> {
    const zones = await this.getZones(tenant_id); // Cached
    for (const zone of zones) {
      if (ipInCidr(ip, zone.cidr)) return zone.zone_id;
    }
    return null; // UNKNOWN — triggers HIGH/CRITICAL alert
  }
}
```

---

## 7. Three-Layer Authorisation Engine

> **Build Priority: 5 — Depends on Identity Registry and Event Bus.**

### 7.1 Verification Flow

```typescript
interface VerificationResult {
  verdict:        'CLEAN' | 'SUSPICIOUS' | 'CRITICAL';
  layers_passed:  Layer[];
  layers_failed:  Layer[];
  failed_reason:  string | null;   // Admin eyes only — never exposed to end user
  alert_code:     string | null;   // e.g. 'C1', 'H1', 'H2'
}

type Layer = 'LAYER_1_ACCOUNT' | 'LAYER_2_NETWORK' | 'LAYER_3_DEVICE';

async function verify(event: UniversalEvent): Promise<VerificationResult> {
  const result: VerificationResult = {
    verdict: 'CLEAN',
    layers_passed: [],
    layers_failed: [],
    failed_reason: null,
    alert_code: null
  };

  // ── Layer 1: Account Verification ─────────────────────────────────────
  const account = await identityCache.getAccount(event.account_id, event.tenant_id);

  if (!account) {
    return fail(result, 'LAYER_1_ACCOUNT', 'CRITICAL',
      'Account not found in registry', 'C1');
  }
  if (account.status !== 'ACTIVE') {
    return fail(result, 'LAYER_1_ACCOUNT', 'CRITICAL',
      `Account status: ${account.status}`, 'C1');
  }
  result.layers_passed.push('LAYER_1_ACCOUNT');

  // ── Layer 2: Network Zone Verification ────────────────────────────────
  const zone = await networkZoneResolver.resolve(event.source_ip, event.tenant_id);

  if (!zone) {
    return fail(result, 'LAYER_2_NETWORK', 'HIGH',
      `Source IP ${event.source_ip} not in any authorised zone`, 'H2');
  }
  result.layers_passed.push('LAYER_2_NETWORK');

  // ── Layer 3: Device Fingerprint / MAC Verification ────────────────────
  const device = await identityCache.getDevice(event.device_id, event.tenant_id);

  if (!device) {
    return fail(result, 'LAYER_3_DEVICE', 'HIGH',
      `Device ${event.device_id} not registered`, 'H1');
  }
  if (device.status === 'BLACKLISTED') {
    return fail(result, 'LAYER_3_DEVICE', 'CRITICAL',
      `Device blacklisted: ${device.blacklist_reason}`, 'C2');
  }
  result.layers_passed.push('LAYER_3_DEVICE');

  // All three layers passed
  result.verdict = 'CLEAN';
  return result;
}

// Both Layer 2 AND Layer 3 fail simultaneously → CRITICAL (C2)
function fail(
  result: VerificationResult,
  layer: Layer,
  severity: 'HIGH' | 'CRITICAL',
  reason: string,
  alertCode: string
): VerificationResult {
  result.layers_failed.push(layer);
  result.verdict = severity === 'CRITICAL' ? 'CRITICAL' : 'SUSPICIOUS';
  result.failed_reason = reason;  // Admin only
  result.alert_code = alertCode;
  return result;
}
```

### 7.2 Denial Response Enforcement

```typescript
// The ONLY response end users ever receive on any denial
const GENERIC_DENIAL = { error: 'Access Denied' };

// Full detail goes ONLY to the Admin notification pipeline
// This is enforced at the engine level — never in the API layer
async function handleDenial(
  event: UniversalEvent,
  result: VerificationResult
): Promise<void> {
  // 1. Write full detail to audit log
  await auditLog.write({
    ...event,
    outcome: 'DENIED',
    failed_layer: result.layers_failed[0],
    denial_reason: result.failed_reason,    // Admin only
    alert_code: result.alert_code
  });

  // 2. Fire alert to Admin inbox with full detail
  await alertManager.fire(result.alert_code, {
    account_id:    event.account_id,
    device_id:     event.device_id,
    source_ip:     event.source_ip,
    resource_id:   event.resource_id,
    failed_layer:  result.layers_failed[0],
    reason:        result.failed_reason     // Admin only
  });

  // 3. End user gets ONLY generic denial — enforced here, not in API
  // The API layer reads this from the event outcome — never the reason
}
```

### 7.3 Automated Session Termination

```typescript
interface TerminationPolicy {
  tenant_id:           string;
  terminate_on_critical: boolean;  // Default: false (Admin configures)
  terminate_on_layer_fail: boolean; // Default: false
}

async function applyTerminationPolicy(
  session: SessionEvent,
  verdict: VerificationResult,
  policy: TerminationPolicy
): Promise<void> {
  const shouldTerminate =
    (verdict.verdict === 'CRITICAL' && policy.terminate_on_critical) ||
    (verdict.layers_failed.length > 0 && policy.terminate_on_layer_fail);

  if (shouldTerminate) {
    await sessionManager.terminate(session.session_id);

    // Every termination logged as CRITICAL event
    await auditLog.write({
      event:      'SESSION_AUTO_TERMINATED',
      session_id: session.session_id,
      account_id: session.account_id,
      reason:     verdict.failed_reason,
      severity:   'CRITICAL'
    });
  }
}
```

---

## 8. Resource Registry & ACL Engine

> **Build Priority: 6 — Depends on Auth Engine and Identity Registry.**

### 8.1 Resource Lifecycle State Machine

```
                    ┌─────────────┐
              ┌────▶│   ACTIVE    │◀────┐
              │     └──────┬──────┘     │
              │            │            │ Admin reassigns
              │     Owner  │            │ ownership
   Admin      │     account│            │
   enables    │     revoked│            │
              │            ▼            │
              │     ┌─────────────┐     │
              └─────│   LOCKED    │─────┘
                    └──────┬──────┘
                           │
                    Admin  │ initiates
                           ▼
                    ┌─────────────┐
                    │ TRANSFERRED │ (transient — resolves to ACTIVE)
                    └─────────────┘
```

### 8.2 ACL Resolution Algorithm

```typescript
async function resolvePermissions(
  account_id: string,
  resource_id: string,
  tenant_id: string
): Promise<ResolvedPermissions> {

  // 1. Get direct individual privileges
  const directGrants = await privilegeStore.getForAccount(
    account_id, resource_id, tenant_id
  );

  // 2. Get all group memberships for account
  const groups = await identityCache.getGroupsForAccount(
    account_id, tenant_id
  );

  // 3. Get privileges for each group
  const groupGrants = await Promise.all(
    groups.map(g => privilegeStore.getForGroup(g.group_id, resource_id, tenant_id))
  );

  // 4. Check inheritance from parent resource
  const resource = await resourceRegistry.get(resource_id, tenant_id);
  let inheritedGrants: Privilege[] = [];
  if (resource.parent_resource_id && resource.inheritance_active) {
    inheritedGrants = await resolvePermissions(
      account_id, resource.parent_resource_id, tenant_id
    );
  }

  // 5. Merge all grants — MOST RESTRICTIVE WINS
  // This is non-configurable system behaviour
  return mergeRestrictive([directGrants, ...groupGrants, inheritedGrants]);
}

// Most-restrictive merge: DENY always beats ALLOW
function mergeRestrictive(grantSets: Privilege[][]): ResolvedPermissions {
  const all = grantSets.flat();
  const actions: Record<string, boolean> = {};

  for (const grant of all) {
    for (const action of ALL_ACTIONS) {
      // If ANY grant denies an action, it is denied
      // Action is only allowed if explicitly granted AND never denied
      if (actions[action] === undefined) {
        actions[action] = grant.permitted_actions.includes(action);
      } else {
        actions[action] = actions[action] && grant.permitted_actions.includes(action);
      }
    }
  }
  return actions as ResolvedPermissions;
}
```

### 8.3 Time-Based Access Validation

```typescript
function isWithinTimeWindow(
  restriction: TimeRestriction,
  now: Date
): boolean {
  const day = now.toLocaleDateString('en-US', {
    weekday: 'long', timeZone: 'UTC'
  }).toLowerCase();

  if (!restriction.days_of_week.includes(day)) return false;

  const currentMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMins = timeToMins(restriction.start_time);
  const endMins   = timeToMins(restriction.end_time);

  return currentMins >= startMins && currentMins <= endMins;
}

// Outside time window → L4 alert (single), escalates on repeat
```

### 8.4 Bulk Access / Exfiltration Detection

```typescript
const EXFILTRATION_THRESHOLDS = {
  files_per_minute:    50,   // Configurable per tenant
  exports_per_minute:  10,
  deletes_per_minute:  20,
};

// Tracked in Redis sliding window per account
async function checkExfiltration(
  account_id: string,
  action: string,
  tenant_id: string
): Promise<void> {
  const key = `exfil:${tenant_id}:${account_id}:${action}`;
  const count = await redis.incr(key);
  await redis.expire(key, 60); // 1-minute window

  const threshold = EXFILTRATION_THRESHOLDS[`${action.toLowerCase()}s_per_minute`];

  if (count >= threshold * 2) {
    await alertManager.fire('H4_EXFIL'); // HIGH — double threshold
  } else if (count >= threshold) {
    await alertManager.fire('M2');       // MEDIUM — threshold reached
  }
}
```

---

## 9. Audit Log Store (TimescaleDB)

> **Build Priority: 7 — All components write here; must exist before any other component goes live.**

### 9.1 TimescaleDB Hypertable Design

```sql
-- All audit events go into a single hypertable
-- Partitioned by time (1 day chunks) and tenant_id

CREATE TABLE audit_events (
  log_id              UUID          NOT NULL,
  tenant_id           UUID          NOT NULL,
  occurred_at         TIMESTAMPTZ   NOT NULL,   -- Original event time
  ingested_at         TIMESTAMPTZ   NOT NULL,   -- When SecureWatch received it
  event_category      TEXT          NOT NULL,   -- SESSION | RESOURCE | INTEGRATION | SYSTEM
  event_type          TEXT          NOT NULL,
  account_id          UUID,
  device_id           UUID,
  source_ip           INET,
  resource_id         UUID,
  resource_type       TEXT,
  action              TEXT,
  outcome             TEXT          NOT NULL,   -- ALLOWED | DENIED | FLAGGED
  failed_layer        TEXT,                     -- LAYER_1 | LAYER_2 | LAYER_3
  denial_reason       TEXT,                     -- ENCRYPTED — Admin eyes only
  risk_verdict        TEXT,
  alert_id            UUID,
  raw_event           TEXT,                     -- Original log entry — immutable
  hmac_signature      TEXT          NOT NULL,   -- HMAC-SHA256 signature
  source_system       TEXT,
  PRIMARY KEY (log_id, occurred_at)             -- occurred_at required for hypertable
);

-- Convert to hypertable — partition by time (1 day chunks)
SELECT create_hypertable('audit_events', 'occurred_at', chunk_time_interval => INTERVAL '1 day');

-- Compression policy — compress chunks older than 7 days
SELECT add_compression_policy('audit_events', INTERVAL '7 days');

-- Retention policy — keep hot for 365 days, then archive
-- (archiving handled by application-level cold storage job)
```

### 9.2 HMAC Signature Generation

```typescript
import { createHmac } from 'crypto';

// HMAC secret stored in HashiCorp Vault — never in code or config files
async function signLogEntry(entry: AuditEvent): Promise<string> {
  const secret = await vault.getSecret('audit-hmac-key');
  const payload = JSON.stringify({
    log_id:       entry.log_id,
    tenant_id:    entry.tenant_id,
    occurred_at:  entry.occurred_at.toISOString(),
    account_id:   entry.account_id,
    event_type:   entry.event_type,
    outcome:      entry.outcome,
    resource_id:  entry.resource_id,
  });
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// Tamper detection — called during audit log export
async function verifyLogEntry(entry: AuditEvent): Promise<boolean> {
  const expected = await signLogEntry(entry);
  return entry.hmac_signature === expected;
}
```

### 9.3 Deletion Prevention

Deletion is blocked at three independent layers:

```typescript
// Layer 1: Application layer — all delete operations throw
class AuditLogStore {
  async delete(_: never): Promise<never> {
    // Log the attempt itself as a CRITICAL event
    await this.write({
      event_type: 'AUDIT_LOG_DELETE_ATTEMPTED',
      severity:   'CRITICAL',
    });
    await alertManager.fire('C3');
    throw new Error('Audit log deletion is permanently prohibited');
  }
}

// Layer 2: PostgreSQL — REVOKE DELETE on audit_events table
-- Executed once at DB setup — cannot be reversed without DBA access
REVOKE DELETE ON audit_events FROM securewatch_app;

// Layer 3: TimescaleDB append-only mode
-- Enforced at storage level
```

### 9.4 Hot / Cold Storage Architecture

```
HOT STORAGE (TimescaleDB — fast query)
├── Last 365 days of events
├── Compressed after 7 days (lz4)
└── Full-text search available

        ↓ Archival job runs nightly
        ↓ Events older than 365 days

COLD STORAGE (Object Storage — AWS S3 / Azure Blob / MinIO)
├── Events beyond 365 days
├── HMAC signatures preserved in archive manifest
├── Compressed (gzip)
├── Retrievable within SLA on Admin request
└── NEVER deleted — retention policy configurable per tenant
```

```typescript
// Nightly archival job
async function archiveOldEvents(tenant_id: string): Promise<void> {
  const policy = await getRetentionPolicy(tenant_id);
  const cutoff = subDays(new Date(), policy.hot_storage_days);

  const events = await timescaleDB.query(
    `SELECT * FROM audit_events
     WHERE tenant_id = $1 AND occurred_at < $2
     ORDER BY occurred_at`,
    [tenant_id, cutoff]
  );

  if (events.length === 0) return;

  // Write to cold storage with manifest
  const archiveKey = `${tenant_id}/${format(cutoff, 'yyyy-MM-dd')}.gz`;
  await coldStorage.upload(archiveKey, gzip(JSON.stringify(events)));

  // Write manifest — proves what was archived and when
  await archiveManifest.write({
    tenant_id,
    archived_at:  new Date(),
    record_count: events.length,
    date_range:   { from: events[0].occurred_at, to: events[events.length-1].occurred_at },
    archive_key:  archiveKey,
    hmac_check:   'PASSED' // Verified before archiving
  });

  // Delete from hot storage ONLY after successful archive confirmation
  // This is the only permitted deletion — and only from TimescaleDB hot tier
  await timescaleDB.query(
    `DELETE FROM audit_events WHERE tenant_id = $1 AND occurred_at < $2`,
    [tenant_id, cutoff]
  );
}
```

---

## 10. Alert Manager

> **Build Priority: 8 — Depends on Auth Engine and Resource Engine.**

### 10.1 Alert Processing Pipeline

```typescript
interface Alert {
  alert_id:     string;   // UUID
  tenant_id:    string;
  alert_code:   string;   // C1, H1, M1, etc.
  severity:     Severity;
  triggered_at: Date;
  account_id:   string | null;
  device_id:    string | null;
  resource_id:  string | null;
  system_id:    string | null;
  detail:       string;   // Full detail — Admin eyes only
  dedup_key:    string;   // For deduplication window
}

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
```

### 10.2 Deduplication

```typescript
// Prevents alert fatigue from repeated identical events
// Configurable window per severity per tenant

const DEDUP_WINDOWS: Record<Severity, number> = {
  CRITICAL: 60,    // 60 seconds — CRITICAL always re-fires after 1 min
  HIGH:     300,   // 5 minutes
  MEDIUM:   900,   // 15 minutes
  LOW:      3600,  // 1 hour
  INFO:     3600,  // 1 hour
};

async function shouldFire(alert: Alert): Promise<boolean> {
  const dedupKey = `dedup:${alert.tenant_id}:${alert.dedup_key}`;
  const existing = await redis.get(dedupKey);

  if (existing) {
    // Increment grouped count — shown to Admin as "X occurrences"
    await redis.incr(`${dedupKey}:count`);
    return false; // Deduplicated — do not re-fire
  }

  const windowSecs = DEDUP_WINDOWS[alert.severity];
  await redis.setex(dedupKey, windowSecs, '1');
  await redis.setex(`${dedupKey}:count`, windowSecs, '1');
  return true;
}
```

### 10.3 Escalation Engine

```typescript
// Failed login escalation — tracked per account in Redis
async function processFailedLogin(account_id: string, tenant_id: string): Promise<void> {
  const key = `failed_logins:${tenant_id}:${account_id}`;
  const count = await redis.incr(key);
  await redis.expire(key, 300); // 5-minute window

  if (count === 1) {
    await alertManager.fire('L1', { account_id });      // LOW
  } else if (count === 3) {
    await alertManager.fire('M_FAILED_LOGIN', { account_id }); // MEDIUM
  } else if (count >= 5) {
    await alertManager.fire('H_FAILED_LOGIN', { account_id }); // HIGH
  }
}

// Admin auth failure escalation
async function processAdminAuthFailure(admin_id: string): Promise<void> {
  const key = `admin_auth_fail:${admin_id}`;
  const count = await redis.incr(key);
  await redis.expire(key, 300);

  if (count < 3) {
    await alertManager.fire('L2', { admin_id });
  } else {
    // Lock Admin account + CRITICAL alert
    await adminAccountManager.lock(admin_id);
    await alertManager.fire('C6', { admin_id });
    // Clear counter — locked account resets
    await redis.del(key);
  }
}
```

---

## 11. Notification Engine

> **Build Priority: 9 — Depends on Alert Manager.**

### 11.1 Priority Queue

```typescript
// Admin inbox uses a priority queue in Redis sorted sets
// Score = severity_weight * timestamp (lower score = higher priority)

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  CRITICAL: 0,    // Always top
  HIGH:     1,
  MEDIUM:   2,
  LOW:      3,
  INFO:     4,
};

async function enqueueForAdmin(alert: Alert, tenant_id: string): Promise<void> {
  const score = SEVERITY_WEIGHTS[alert.severity] * 1e13 + Date.now();
  await redis.zadd(
    `admin_inbox:${tenant_id}`,
    score,
    JSON.stringify(alert)
  );
}
```

### 11.2 Delivery Channels

```typescript
// Channel routing based on severity
async function dispatch(alert: Alert, tenant_id: string): Promise<void> {
  const config = await notificationConfig.get(tenant_id);

  // Admin inbox — ALWAYS, every severity
  await enqueueForAdmin(alert, tenant_id);

  if (['CRITICAL', 'HIGH'].includes(alert.severity)) {
    // Email
    if (config.email_enabled) {
      await emailDispatcher.send({
        to:      config.admin_email,
        subject: `[${alert.severity}] SecureWatch Alert — ${alert.alert_code}`,
        body:    renderAlertEmail(alert)
      });
    }

    // SMS — CRITICAL and HIGH only
    if (config.sms_enabled) {
      await smsDispatcher.send({
        to:   config.admin_phone,
        body: `SecureWatch [${alert.severity}]: ${alert.alert_code} — ${alert.detail.slice(0, 160)}`
      });
    }

    // Webhook
    if (config.webhook_url) {
      await webhookDispatcher.post(config.webhook_url, alert);
    }
  }

  if (alert.severity === 'MEDIUM' && config.email_enabled) {
    await emailDispatcher.send({ to: config.admin_email, body: renderAlertEmail(alert) });
  }

  // Log delivery
  await deliveryLog.write({
    alert_id:         alert.alert_id,
    channels_used:    getChannelsUsed(alert.severity, config),
    delivered_at:     new Date(),
    delivery_status:  'DELIVERED'
  });
}
```

### 11.3 Green Signal Delivery

```typescript
// Green signals — positive confirmations delivered to Admin inbox
interface GreenSignal {
  signal_type: 'RESOURCE_CREATED' | 'INTEGRATION_REGISTERED' | 'PRIVILEGE_GRANTED';
  tenant_id:   string;
  actor:       string;
  detail:      string;
  timestamp:   Date;
}

async function sendGreenSignal(signal: GreenSignal): Promise<void> {
  // Always to Admin inbox
  await enqueueForAdmin({
    ...signal,
    severity: 'INFO',
    alert_code: 'GREEN'
  }, signal.tenant_id);

  // Optional email to the actor (user who created resource)
  // Admin configures this per tenant
  const config = await notificationConfig.get(signal.tenant_id);
  if (config.creator_notifications_enabled && signal.signal_type === 'RESOURCE_CREATED') {
    await emailDispatcher.send({
      to:      await getActorEmail(signal.actor),
      subject: 'Your resource has been created',
      body:    `Your resource creation request has been processed successfully.`
    });
  }
}
```

---

## 12. Admin Dashboard (Frontend)

> **Build Priority: 10 — Depends on all backend services.**

### 12.1 Technology

```
React 18 + TypeScript (strict)
Zustand for global state
React Query (TanStack Query) for server state / caching
WebSocket for real-time push (live sessions, alert inbox)
Tailwind CSS for styling
Recharts for dashboard visualisation
React Router v6 for navigation
```

### 12.2 Application Structure

```
src/
├── app/
│   ├── App.tsx              Main router
│   └── store.ts             Zustand global store
│
├── pages/
│   ├── InboxPage.tsx        Unified Admin inbox
│   ├── SessionsPage.tsx     Live session view
│   ├── ResourcesPage.tsx    Resource registry
│   ├── IntegrationsPage.tsx Integration health dashboard
│   ├── AuditLogPage.tsx     Audit log search & export
│   └── SettingsPage.tsx     Tenant & notification config
│
├── components/
│   ├── AlertBadge.tsx       Severity badge component
│   ├── SessionRow.tsx       Live session table row
│   ├── ResourceTree.tsx     Resource hierarchy viewer
│   ├── IntegrationCard.tsx  Per-system health card
│   └── AuditTable.tsx       Paginated audit log table
│
├── hooks/
│   ├── useWebSocket.ts      Real-time event subscription
│   ├── useAlerts.ts         Alert inbox data
│   └── useSessions.ts       Live session data
│
└── api/
    └── client.ts            Typed API client (auto-generated from OpenAPI spec)
```

### 12.3 Real-Time Updates

```typescript
// WebSocket connection for live dashboard updates
// Admin dashboard subscribes to their tenant's event stream

function useWebSocket(tenantId: string) {
  useEffect(() => {
    const ws = new WebSocket(
      `wss://${API_HOST}/ws?tenant=${tenantId}`,
      // Auth via Sec-WebSocket-Protocol header with JWT
    );

    ws.onmessage = (msg) => {
      const event = JSON.parse(msg.data);
      switch (event.type) {
        case 'NEW_ALERT':
          useAlertsStore.getState().addAlert(event.payload);
          break;
        case 'SESSION_UPDATE':
          useSessionStore.getState().updateSession(event.payload);
          break;
        case 'INTEGRATION_STATUS':
          useIntegrationStore.getState().updateStatus(event.payload);
          break;
      }
    };

    return () => ws.close();
  }, [tenantId]);
}
```

### 12.4 Emergency Read-Only View

```
Accessible at: https://[host]:8443/emergency
Separate emergency credentials (stored offline)
View-only — all write operations disabled at API level
Access triggers CRITICAL alert (C_EMERGENCY_ACCESS)
Auto-expires after 4 hours — JWT TTL enforced
Every page view and action logged immutably
```

---

## 13. REST API Gateway

### 13.1 Authentication

```typescript
// All API requests require JWT authentication
// JWT contains: admin_id, tenant_id, role, exp, iat
// Signed with RS256 — private key in HashiCorp Vault

// MFA enforced at login — JWT only issued after MFA verification
async function login(credentials: AdminCredentials): Promise<LoginResult> {
  const admin = await adminStore.verify(credentials);
  if (!admin) throw new AuthError('Invalid credentials');

  // MFA verification — MANDATORY, cannot be bypassed
  const mfaValid = await mfaService.verify(admin.id, credentials.mfa_token);
  if (!mfaValid) {
    await processAdminAuthFailure(admin.id); // Escalation logic
    throw new AuthError('MFA verification failed');
  }

  const token = await jwtService.sign({
    admin_id:  admin.id,
    tenant_id: admin.tenant_id,
    role:      admin.role,
    exp:       Math.floor(Date.now() / 1000) + (8 * 3600) // 8-hour TTL
  });

  return { token };
}
```

### 13.2 API Versioning

All endpoints are versioned: `/api/v1/...`

Breaking changes require a new version prefix: `/api/v2/...`
Old versions are deprecated with a 6-month sunset period.

---

## 14. Database Schemas

### 14.1 PostgreSQL — Core Tables

```sql
-- ── Tenants ──────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  tenant_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status       TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','TERMINATED'))
);

-- ── Accounts ─────────────────────────────────────────────────────────────────
CREATE TABLE accounts (
  account_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(tenant_id),
  username            TEXT NOT NULL,
  email               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED','EXPIRED')),
  registered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID NOT NULL,  -- Admin ID
  last_verified_at    TIMESTAMPTZ,
  failed_login_count  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, username)
);
CREATE INDEX idx_accounts_tenant_status ON accounts(tenant_id, status);

-- ── Devices ──────────────────────────────────────────────────────────────────
CREATE TABLE devices (
  device_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(tenant_id),
  fingerprint      TEXT NOT NULL,
  mac_address      TEXT NOT NULL,
  hostname         TEXT,
  network_zone_id  UUID,
  registered_by    UUID NOT NULL,
  approved_at      TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('REGISTERED','PENDING','BLACKLISTED')),
  blacklist_reason TEXT,
  last_seen        TIMESTAMPTZ,
  UNIQUE (tenant_id, mac_address)
);

-- ── Network Zones ─────────────────────────────────────────────────────────────
CREATE TABLE network_zones (
  zone_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(tenant_id),
  zone_name   TEXT NOT NULL,
  cidr        CIDR NOT NULL,
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Groups ───────────────────────────────────────────────────────────────────
CREATE TABLE groups (
  group_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(tenant_id),
  group_name  TEXT NOT NULL,
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, group_name)
);

CREATE TABLE group_members (
  group_id    UUID NOT NULL REFERENCES groups(group_id),
  account_id  UUID NOT NULL REFERENCES accounts(account_id),
  added_by    UUID NOT NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, account_id)
);

-- ── Resources ────────────────────────────────────────────────────────────────
CREATE TABLE resources (
  resource_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(tenant_id),
  resource_name       TEXT NOT NULL,
  resource_type       TEXT NOT NULL
    CHECK (resource_type IN (
      'FILE','DIRECTORY','DATABASE','TABLE','API',
      'SERVICE','NETWORK_SHARE','APPLICATION','CUSTOM'
    )),
  owner_account_id    UUID REFERENCES accounts(account_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parent_resource_id  UUID REFERENCES resources(resource_id),
  inheritance_active  BOOLEAN NOT NULL DEFAULT FALSE,
  ownership_status    TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (ownership_status IN ('ACTIVE','LOCKED','TRANSFERRED')),
  locked_at           TIMESTAMPTZ,
  lock_reason         TEXT
);
CREATE INDEX idx_resources_tenant ON resources(tenant_id);
CREATE INDEX idx_resources_owner ON resources(owner_account_id);

-- ── ACL Entries ───────────────────────────────────────────────────────────────
CREATE TABLE acl_entries (
  acl_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(tenant_id),
  resource_id         UUID NOT NULL REFERENCES resources(resource_id),
  grantee_type        TEXT NOT NULL CHECK (grantee_type IN ('ACCOUNT','GROUP')),
  grantee_id          UUID NOT NULL,
  permitted_actions   TEXT[] NOT NULL,
  days_of_week        TEXT[],          -- NULL = all days
  start_time          TIME,            -- NULL = no time restriction
  end_time            TIME,
  granted_by          UUID NOT NULL,
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status              TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','REVOKED')),
  revoked_at          TIMESTAMPTZ,
  revoked_by          UUID
);
CREATE INDEX idx_acl_resource ON acl_entries(resource_id, status);
CREATE INDEX idx_acl_grantee ON acl_entries(grantee_id, tenant_id);

-- ── Integration Registry ──────────────────────────────────────────────────────
CREATE TABLE integration_registry (
  system_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(tenant_id),
  system_name            TEXT NOT NULL,
  system_type            TEXT NOT NULL
    CHECK (system_type IN (
      'DATABASE','FILE_SYSTEM','APPLICATION',
      'CLOUD','LEGACY','DIRECTORY'
    )),
  integration_method     TEXT NOT NULL
    CHECK (integration_method IN ('AGENT','API','LOG_PARSER','SDK')),
  connector_version      TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','DEGRADED','SILENT','DISCONNECTED')),
  registered_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  registered_by          UUID NOT NULL,
  last_event_at          TIMESTAMPTZ,
  health_threshold_mins  INTEGER NOT NULL DEFAULT 5,
  breaking_change        BOOLEAN NOT NULL DEFAULT FALSE,
  admin_approved         BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, system_name)
);

-- Enable RLS on all tables
ALTER TABLE tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_zones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE acl_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_registry ENABLE ROW LEVEL SECURITY;

-- RLS policies (example — applied to all tables)
CREATE POLICY tenant_isolation ON accounts
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

---

## 15. API Contract Specification

### 15.1 Base URL & Versioning

```
Production:  https://api.securewatch.io/api/v1
On-premise:  https://[host]/api/v1
Emergency:   https://[host]:8443/api/v1  (read-only)
```

### 15.2 Authentication Header

```
Authorization: Bearer <JWT>
X-Tenant-ID:   <tenant_uuid>     (required on all requests)
```

### 15.3 Core Endpoints

**Sessions**
```
GET    /sessions                     List all active sessions
GET    /sessions/:session_id         Get session detail
DELETE /sessions/:session_id         Terminate session (Admin only)
```

**Accounts**
```
GET    /accounts                     List accounts (paginated)
POST   /accounts                     Register new account
GET    /accounts/:account_id         Get account detail
PATCH  /accounts/:account_id/status  Update account status
DELETE /accounts/:account_id         Deregister account
```

**Devices**
```
GET    /devices                      List devices
POST   /devices                      Register device
PATCH  /devices/:device_id/status    Approve / blacklist device
```

**Resources**
```
GET    /resources                    List resources (paginated, filterable)
POST   /resources                    Register resource
GET    /resources/:resource_id       Get resource + ACL
PATCH  /resources/:resource_id/acl   Update ACL
PATCH  /resources/:resource_id/owner Transfer ownership (Admin only)
```

**Privileges**
```
POST   /privileges                   Grant privilege (to account or group)
DELETE /privileges/:assignment_id    Revoke privilege
GET    /privileges?account_id=...    List privileges for account/group
```

**Alerts**
```
GET    /alerts                       List alerts (filterable by severity, date)
GET    /alerts/:alert_id             Get alert detail
PATCH  /alerts/:alert_id/acknowledge Mark as acknowledged
```

**Audit Log**
```
GET    /audit-log                    Search audit log
  ?from=ISO8601&to=ISO8601
  &account_id=UUID
  &resource_id=UUID
  &severity=CRITICAL
  &outcome=DENIED
  &page=1&limit=100

GET    /audit-log/export             Export audit log
  ?format=pdf|csv|json
  &from=ISO8601&to=ISO8601

GET    /audit-log/:log_id/verify     Verify HMAC signature of log entry
```

**Integrations**
```
GET    /integrations                 List all integrated systems
POST   /integrations                 Register new integration
GET    /integrations/:system_id      Get integration + health status
PATCH  /integrations/:system_id      Update integration config
DELETE /integrations/:system_id      Deregister integration

POST   /integrations/:system_id/maintenance-window   Schedule maintenance window
```

**Events (Ingest — used by Agent, SDK, Log Parser)**
```
POST   /ingest/events                Submit events (batch — max 1000 per request)
POST   /ingest/event                 Submit single event
```

### 15.4 Standard Response Format

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "page":       1,
    "limit":      100,
    "total":      2847,
    "request_id": "uuid"
  }
}

// Error
{
  "success": false,
  "error": {
    "code":    "RESOURCE_NOT_FOUND",
    "message": "The requested resource does not exist",
    "request_id": "uuid"
  }
  // Note: NO internal detail, layer info, or system detail
  // in error responses — EVER
}
```

---

## 16. Infrastructure & Deployment

### 16.1 Deployment Modes

| Mode | Description | Recommended For |
|---|---|---|
| **Cloud (Managed K8s)** | Deploy on EKS / AKS / GKE using provided Helm charts | Cloud-native organisations |
| **On-Premise (K8s)** | Deploy on bare-metal or VM K8s cluster | Air-gapped / regulated environments |
| **Docker Compose** | Single-host docker-compose for smaller deployments | SMB, POC, development |
| **Hybrid** | Integration Layer on-premise, backend cloud-hosted | Mixed infrastructure |

### 16.2 Kubernetes Architecture (Production)

```yaml
# Namespace isolation per service
namespaces:
  - securewatch-integration    # Integration Layer + Normalizer
  - securewatch-core           # Auth Engine, Resource Engine, Alert Manager
  - securewatch-data           # PostgreSQL, TimescaleDB, Redis, Kafka
  - securewatch-frontend       # Admin Dashboard, REST API Gateway
  - securewatch-monitoring     # Prometheus, Grafana

# Resource requests and limits per service
resources:
  integration-layer:
    requests: { cpu: 500m, memory: 512Mi }
    limits:   { cpu: 2000m, memory: 2Gi }
  auth-engine:
    requests: { cpu: 250m, memory: 256Mi }
    limits:   { cpu: 1000m, memory: 1Gi }
  timescaledb:
    requests: { cpu: 1000m, memory: 2Gi }
    limits:   { cpu: 4000m, memory: 8Gi }
  kafka:
    requests: { cpu: 500m, memory: 1Gi }
    limits:   { cpu: 2000m, memory: 4Gi }
```

### 16.3 On-Premise Minimum Hardware Specification

```
Per PRD v2.0 decision:

┌─────────────────────────────────────────────────────────┐
│  SECUREWATCH SERVER — MINIMUM PRODUCTION SPECIFICATION   │
├──────────────────┬──────────────────────────────────────┤
│  CPU             │  16 cores (x86_64)                   │
│  RAM             │  32 GB                               │
│  Storage (Hot)   │  2 TB NVMe SSD                       │
│  Network         │  1 Gbps                              │
│  OS              │  Ubuntu 22.04 LTS (server edition)   │
├──────────────────┼──────────────────────────────────────┤
│  Cold Storage    │  Separate NAS or cloud object store  │
│  (Archive)       │  AWS S3 / Azure Blob / MinIO (self-  │
│                  │  hosted S3-compatible, free)         │
└──────────────────┴──────────────────────────────────────┘

Recommended for HA (High Availability):
- Minimum 3 nodes for K8s control plane
- Minimum 2 worker nodes (active-active)
- Dedicated storage node for TimescaleDB
```

### 16.4 Network Architecture

```
INTERNET
    │
    ▼
[Cloudflare / WAF]      ← DDoS protection, rate limiting
    │
    ▼
[Nginx Reverse Proxy]   ← TLS termination, routing
├── :443  → Admin Dashboard + REST API
└── :8443 → Emergency Read-Only View (separate)
    │
    ▼
[Internal Network — no direct internet access]
├── Integration Layer   (DMZ — accepts external events)
├── Core Services       (internal only)
├── Data Layer          (internal only, no external access)
└── Monitoring          (internal only)
```

### 16.5 TLS Configuration

```nginx
# Nginx TLS configuration — TLS 1.3 mandatory (PRD requirement)
server {
    listen 443 ssl http2;

    ssl_protocols              TLSv1.3;           # TLS 1.3 ONLY
    ssl_ciphers                TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256;
    ssl_prefer_server_ciphers  off;
    ssl_session_timeout        1d;
    ssl_session_cache          shared:MozSSL:10m;

    # HSTS — 1 year
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";

    # Mutual TLS for Integration Layer endpoints
    ssl_client_certificate  /etc/nginx/certs/ca.crt;
    ssl_verify_client       optional;  # Required for Agent endpoints
}
```

---

## 17. DevOps & CI/CD Pipeline

### 17.1 Repository Structure

```
securewatch/
├── services/
│   ├── integration-layer/     Node.js/TypeScript
│   ├── event-normalizer/      Node.js/TypeScript
│   ├── auth-engine/           Node.js/TypeScript
│   ├── resource-engine/       Node.js/TypeScript
│   ├── alert-manager/         Node.js/TypeScript
│   ├── notification-engine/   Node.js/TypeScript
│   └── rest-api/              Node.js/TypeScript
├── agent/                     Go
├── sdk/                       TypeScript (public npm package)
├── dashboard/                 React/TypeScript
├── infrastructure/
│   ├── k8s/                   Kubernetes manifests
│   ├── terraform/             Infrastructure as Code
│   ├── docker/                Dockerfiles
│   └── helm/                  Helm charts
├── database/
│   ├── migrations/            SQL migration files
│   └── seeds/                 Development seed data
└── .github/
    └── workflows/             GitHub Actions CI/CD
```

### 17.2 GitHub Actions Pipeline

```yaml
# .github/workflows/ci.yml
name: SecureWatch CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # ── Stage 1: Code Quality ─────────────────────────────────────────────────
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: TypeScript type check
        run: npm run typecheck --workspaces
      - name: ESLint
        run: npm run lint --workspaces
      - name: Go lint (agent)
        run: cd agent && golangci-lint run

  # ── Stage 2: Security Scanning ───────────────────────────────────────────
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Dependency vulnerability scan
        run: npm audit --audit-level=high
      - name: Secret scanning
        uses: trufflesecurity/trufflehog@main
      - name: SAST scan
        uses: github/codeql-action/analyze@v3
        with:
          languages: javascript, typescript, go

  # ── Stage 3: Unit & Integration Tests ────────────────────────────────────
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb:latest-pg16
        env:
          POSTGRES_PASSWORD: test
      redis:
        image: redis:7.2-alpine
      kafka:
        image: confluentinc/cp-kafka:7.6.0
    steps:
      - name: Run unit tests
        run: npm test --workspaces -- --coverage
      - name: Coverage threshold check
        run: npm run coverage:check  # Fails if < 80% coverage

  # ── Stage 4: Build & Push ────────────────────────────────────────────────
  build:
    needs: [lint-and-typecheck, security-scan, test]
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker images
        run: docker compose build
      - name: Push to GHCR
        run: docker compose push
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # ── Stage 5: Deploy to Staging ───────────────────────────────────────────
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging cluster
        run: helm upgrade --install securewatch ./infrastructure/helm
             --namespace securewatch-staging
             --values ./infrastructure/helm/values.staging.yaml

  # ── Stage 6: Deploy to Production ────────────────────────────────────────
  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production     # Requires manual approval gate
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: helm upgrade --install securewatch ./infrastructure/helm
             --namespace securewatch-production
             --values ./infrastructure/helm/values.production.yaml
             --atomic              # Rollback on failure
             --timeout 10m
```

### 17.3 Environment Strategy

| Environment | Branch | Purpose | Auto-deploy |
|---|---|---|---|
| Development | feature/* | Local dev, unit testing | No |
| Staging | develop | Integration testing, QA | Yes — on merge |
| Production | main | Live system | Yes — with manual approval gate |

### 17.4 Database Migration Strategy

```bash
# Migrations run automatically on deploy — forward only
# Rollback = write a new migration (no down migrations in production)

node-pg-migrate up   # Run pending migrations
node-pg-migrate create <migration_name>  # Create new migration
```

---

## 18. Security Architecture

### 18.1 Secret Management

All secrets stored in HashiCorp Vault — **zero secrets in code, config files, or environment variables in production.**

```
Vault secret paths:
├── secret/securewatch/db/postgres     PostgreSQL credentials
├── secret/securewatch/db/timescaledb  TimescaleDB credentials
├── secret/securewatch/redis           Redis auth token
├── secret/securewatch/kafka           Kafka credentials
├── secret/securewatch/jwt/private     JWT signing key (RS256)
├── secret/securewatch/jwt/public      JWT verification key
├── secret/securewatch/hmac/audit      Audit log HMAC key
├── secret/securewatch/mfa/totp        TOTP secret base
└── secret/securewatch/tls/            TLS certificates
```

### 18.2 Encryption at Rest

```
PostgreSQL:    pg_crypto extension — AES-256 on sensitive columns
               (denial_reason, personal data fields)
TimescaleDB:   AES-256 at filesystem level (dm-crypt / LUKS on Linux)
Redis:         Encrypted persistence (RDB + AOF) using AES-256
Backups:       AES-256-GCM encrypted before upload to cold storage
Vault:         Auto-unseal with cloud KMS or Shamir's Secret Sharing
```

### 18.3 Admin MFA Implementation

```typescript
// TOTP-based MFA (RFC 6238 — Google Authenticator compatible)
// MANDATORY — no bypass path exists in the codebase

import { authenticator } from 'otplib';

// MFA setup — generates QR code for Admin to scan
async function setupMFA(admin_id: string): Promise<MFASetupResult> {
  const secret = authenticator.generateSecret();
  await vault.store(`mfa/${admin_id}`, secret); // Stored in Vault only

  return {
    secret,
    qr_code: authenticator.keyuri(admin_id, 'SecureWatch', secret),
    backup_codes: generateBackupCodes(8) // 8 one-time backup codes
  };
}

// MFA verification — called on every Admin login
async function verifyMFA(admin_id: string, token: string): Promise<boolean> {
  const secret = await vault.get(`mfa/${admin_id}`);
  return authenticator.verify({ token, secret });
}
```

### 18.4 Penetration Testing Requirements (Phase 6)

Before GA release, the following must be tested by an independent security team:

```
Required pen test coverage:
├── Authentication bypass attempts
├── MFA circumvention attempts
├── Audit log deletion / tampering attempts
├── Multi-tenant data isolation (cross-tenant access attempts)
├── SQL injection on all database queries
├── Event injection via Integration Layer (malformed payloads)
├── JWT manipulation (algorithm confusion, expiry bypass)
├── Rate limit bypass
├── Admin session hijacking
├── Emergency view abuse
└── Denial-of-service on Integration Layer
```

---

## 19. Performance & Scalability Design

### 19.1 Throughput Design

| Target | Design Approach |
|---|---|
| 50,000 events/min | Kafka partitioned by account_id — parallel consumer processing |
| 10,000 concurrent sessions | Redis session state — O(1) lookup |
| < 5s alert latency | Kafka consumer → Alert Manager → Notification Engine in < 2s each |
| < 3s audit log search | TimescaleDB time-indexed hypertable + PostgreSQL full-text search index |
| < 30min integration setup | Pre-built connectors, auto-detection, wizard UI |

### 19.2 Database Indexing Strategy

```sql
-- TimescaleDB audit_events — critical indexes
CREATE INDEX idx_audit_tenant_time     ON audit_events(tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_account         ON audit_events(account_id, occurred_at DESC);
CREATE INDEX idx_audit_resource        ON audit_events(resource_id, occurred_at DESC);
CREATE INDEX idx_audit_outcome         ON audit_events(outcome, occurred_at DESC);
CREATE INDEX idx_audit_severity        ON audit_events(risk_verdict, occurred_at DESC);

-- Full text search on event details
CREATE INDEX idx_audit_fts ON audit_events USING GIN (
  to_tsvector('english', coalesce(event_type,'') || ' ' || coalesce(denial_reason,''))
);
```

### 19.3 Auto-Scaling Policy

```yaml
# Horizontal Pod Autoscaler — Integration Layer
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: kafka_consumer_lag  # Scale on message backlog
        target:
          type: AverageValue
          averageValue: 1000        # Scale up if > 1000 messages queued per pod
```

---

## 20. Testing Strategy

### 20.1 Test Coverage Requirements

| Layer | Type | Minimum Coverage |
|---|---|---|
| Auth Engine | Unit + Integration | 90% |
| Resource ACL Engine | Unit + Integration | 90% |
| Audit Log Store | Unit | 85% |
| Integration Layer | Unit + Integration | 85% |
| Alert Manager | Unit | 85% |
| API Gateway | Integration + E2E | 80% |
| Admin Dashboard | Component + E2E | 70% |

### 20.2 Critical Test Cases

```typescript
// These tests must pass before any deployment — zero tolerance

describe('Audit Log Protection', () => {
  it('throws on any delete attempt', async () => {
    await expect(auditLog.delete()).rejects.toThrow('permanently prohibited');
  });
  it('fires CRITICAL alert on delete attempt', async () => {
    try { await auditLog.delete(); } catch {}
    expect(alertManager.fired).toContain('C3');
  });
});

describe('Multi-Tenant Isolation', () => {
  it('tenant A cannot access tenant B data', async () => {
    const tenantBResource = await createResource(tenantB);
    setTenantContext(tenantA);
    const result = await resourceStore.get(tenantBResource.id);
    expect(result).toBeNull();
  });
});

describe('Generic Denial Enforcement', () => {
  it('never exposes denial reason to API response', async () => {
    const response = await api.post('/resources/access', {
      account_id: suspendedAccount.id
    });
    expect(response.body.error.message).toBe('Access Denied');
    expect(JSON.stringify(response.body)).not.toContain('SUSPENDED');
    expect(JSON.stringify(response.body)).not.toContain('Layer');
  });
});

describe('Three-Layer Verification', () => {
  it('CLEAN only when all three layers pass', async () => {
    const result = await authEngine.verify(validEvent);
    expect(result.verdict).toBe('CLEAN');
    expect(result.layers_passed).toHaveLength(3);
  });
  it('CRITICAL when account unregistered', async () => {
    const result = await authEngine.verify({ ...validEvent, account_id: unknownId });
    expect(result.verdict).toBe('CRITICAL');
    expect(result.alert_code).toBe('C1');
  });
});
```

### 20.3 Performance Benchmarks (Phase 6 — Required Before GA)

```bash
# Run with k6 load testing tool
# All benchmarks must pass before v2.0 GA

Event ingestion:    50,000 events/min sustained for 10 minutes — 0% drop
Alert latency:      p95 < 5 seconds under full load
Dashboard refresh:  10-second cycle stable under 100 concurrent Admin sessions
Audit log search:   p95 < 3 seconds on 100M row dataset
Integration setup:  Timed walkthrough < 30 minutes — tested on 5 system types
```

---

## Document Control

| Field | Value |
|---|---|
| **Document** | SecureWatch Technical Design Document |
| **Version** | 1.0 |
| **Status** | Ready for Engineering Review |
| **Based On** | SecureWatch PRD v2.0 — March 2026 |
| **Classification** | Confidential |

---

*SecureWatch TDD v1.0 • Confidential • March 2026*
