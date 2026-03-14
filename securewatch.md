# SecureWatch — Kiro Master Specification
### Version 1.0 | March 2026

---

## What You Are Building

You are building **SecureWatch** — an intelligent, production-grade security monitoring platform. This is not a prototype or MVP. Every line of code you write must be enterprise-ready, security-hardened, and exactly aligned with the three governing documents:

- **PRD v2.0** — What the system must do (product requirements)
- **TDD v1.0** — How the system must be built (technical design)
- **UI Design v1.0** — How the system must look and behave (interface design)

All three documents are embedded in the steering files. You must read every steering file before writing any code. The steering files are the law. You do not deviate from them under any circumstance.

---

## Project Identity

```
Product Name:      SecureWatch
Type:              Universal Security Monitoring Platform
Architecture:      Event-driven microservices
Deployment:        Kubernetes (cloud) + Docker Compose (on-premise)
Primary Language:  TypeScript (Node.js 20 LTS, strict mode)
Agent Language:    Go v1.22
Frontend:          React 18 + TypeScript
Audit DB:          TimescaleDB v2.13
Primary DB:        PostgreSQL v16
Message Broker:    Apache Kafka v3.6
Cache:             Redis v7.2
Reverse Proxy:     Nginx v1.25
Secret Manager:    HashiCorp Vault v1.15
CI/CD:             GitHub Actions
Containers:        Docker v25 + Kubernetes v1.29
```

---

## Build Order — Non-Negotiable

You must build components in this exact dependency order. Do not begin a phase until the previous phase is complete and its tests pass.

### Phase 1 — Universal Integration Foundation (Weeks 3–5)
**Start here. Everything depends on this.**

Build in this sequence:
1. `services/integration-layer` — The authenticated entry point for ALL events
2. `services/event-normalizer` — Converts raw events to Universal Event Schema
3. Kafka topic setup — `sw.events.session`, `sw.events.resource`, `sw.events.integration`, `sw.events.system`, `sw.alerts.outbound`
4. `services/integration-registry` — Tracks all connected systems
5. Integration health monitor — Background job, runs every 30 seconds
6. `services/rest-api` — REST API Gateway (v1 prefix, JWT auth)
7. All four integration methods operational: Agent (mTLS), REST API (JWT), Log Parser (API key), SDK (JWT)

**Phase 1 is complete when:** Any external system can send an event, it is authenticated, normalised to Universal Event Schema, and published to Kafka. Health monitoring is running. No alerts fire. Integration tests pass.

---

### Phase 2 — Identity & Authorisation (Weeks 6–8)

Build in this sequence:
1. PostgreSQL schema — all core tables with RLS enabled on every table
2. `services/identity-registry` — Accounts, devices, network zones, groups
3. Redis identity cache — 60-second TTL, cache-aside pattern
4. Network zone resolver — CIDR prefix tree, O(log n) lookup
5. `services/auth-engine` — Three-layer verification engine
6. Admin operator model — MFA enforced, JWT (RS256), 8-hour TTL
7. Privilege assignment engine — Individual and group grants, most-restrictive conflict resolution

**Phase 2 is complete when:** Three-layer verification runs on every event. A clean session passes all three layers. A session with unknown account triggers C1 CRITICAL. An unknown device triggers H1 HIGH. An unknown network zone triggers H2 HIGH. End user receives ONLY "Access Denied" — never a reason.

---

### Phase 3 — Resource Registry & Monitor (Weeks 9–11)

Build in this sequence:
1. TimescaleDB schema — `audit_events` hypertable, 1-day chunks
2. HMAC-SHA256 signing — every audit entry signed on write
3. Deletion prevention — three independent layers (application, PostgreSQL REVOKE, append-only)
4. `services/resource-engine` — ACL engine, ownership lifecycle, inheritance engine
5. Resource Registry — all 9 resource types supported
6. Time-based access validation
7. Bulk access / exfiltration detection — Redis sliding window
8. Hot/cold storage archival — nightly job, HMAC preserved in manifest

**Phase 3 is complete when:** Every resource access is logged with HMAC signature. ACL resolution runs correctly including group conflict (most-restrictive wins). Any delete attempt on audit_events is blocked AND triggers CRITICAL alert C3. Inheritance OFF by default.

---

### Phase 4 — Alerting & Notification (Weeks 12–13)

Build in this sequence:
1. `services/alert-manager` — Alert processing, severity classification
2. Deduplication engine — Redis sliding window per severity
3. Escalation engine — Failed login rules, Admin auth failure rules
4. `services/notification-engine` — Priority queue (Redis sorted set, CRITICAL always first)
5. Admin inbox — WebSocket push
6. Email dispatcher
7. SMS dispatcher — CRITICAL and HIGH only
8. Webhook dispatcher — Slack, Teams, PagerDuty compatible
9. Green signal delivery
10. Automated session termination — configurable per policy

**Phase 4 is complete when:** A CRITICAL event fires within 5 seconds. Alert deduplication groups repeated events. Notification channels route correctly by severity. Green signals land in Admin inbox.

---

### Phase 5 — Admin Dashboard (Weeks 14–15)

Build in this sequence:
1. React 18 + TypeScript SPA scaffolding
2. Global design system — colours, typography, spacing (exact values from UI Design Doc)
3. Authentication flow — Login page, MFA step, failure states
4. Global layout — Topbar, sidebar navigation, CRITICAL banner
5. Screen 2: Unified Admin Inbox — alert rows, detail drawer, filter bar
6. Screen 3: Live Session View — real-time table, WebSocket updates, session detail drawer
7. Screen 4: Resource Registry — resource table, detail page, Grant Access modal
8. Screen 5: Integration Health Dashboard — status cards, integration table, detail page, Add Integration wizard
9. Screen 6: Audit Log Search & Export — search filters, log table, entry detail drawer, export modal
10. Screen 7: Account Management — account table, revoke warning modal
11. Screen 8: Device Management — device table, pending device approval
12. Screen 9: Network Zones — zone table
13. Screen 10: Groups & Privileges — group table, conflict display
14. Screen 11: Settings & Notifications — all settings panels
15. Screen 12: Emergency Read-Only View — separate port 8443, view-only mode

**Phase 5 is complete when:** Admin can log in with MFA, see live sessions refresh every 10 seconds, acknowledge a CRITICAL alert, view audit log entries, and register a new integration. All 12 screens are functional.

---

### Phase 6 — Hardening & QA (Weeks 16–17)

1. Security testing — authentication bypass, MFA circumvention, SQL injection
2. Multi-tenant isolation testing — Tenant A cannot access Tenant B data
3. Penetration testing coverage per TDD Section 18.4
4. Performance benchmarking — k6 load tests per TDD Section 20.3
5. Silent system testing
6. Log integrity verification — HMAC verification on 100% of entries
7. All coverage thresholds met per TDD Section 20.1

---

## Repository Structure

Create this exact structure from the start. Do not deviate:

```
securewatch/
├── .kiro/                         ← Kiro spec and steering files
│   ├── specs/
│   │   └── securewatch.md         ← This file
│   └── steering/
│       ├── 01-security-rules.md
│       ├── 02-tech-stack.md
│       ├── 03-coding-standards.md
│       ├── 04-data-models.md
│       ├── 05-alert-severity.md
│       └── 06-ui-design-system.md
│
├── services/
│   ├── integration-layer/         ← Build first — Port 3001
│   ├── event-normalizer/          ← Build second
│   ├── auth-engine/               ← Port 3002
│   ├── resource-engine/           ← Port 3003
│   ├── alert-manager/             ← Port 3004
│   ├── notification-engine/       ← Port 3005
│   └── rest-api/                  ← Port 3000
│
├── agent/                         ← Go v1.22 — proprietary, build last
├── sdk/                           ← TypeScript — open source npm package
├── dashboard/                     ← React 18 — Port 3010
│
├── infrastructure/
│   ├── k8s/                       ← Kubernetes manifests
│   ├── terraform/                 ← Infrastructure as Code
│   ├── docker/                    ← Dockerfiles
│   └── helm/                      ← Helm charts
│
├── database/
│   ├── migrations/                ← SQL via node-pg-migrate
│   └── seeds/                     ← Development seed data only
│
└── .github/
    └── workflows/
        └── ci.yml                 ← GitHub Actions pipeline
```

---

## Service Architecture — Ports

| Service | Port | Exposure |
|---|---|---|
| REST API Gateway | 3000 | Via Nginx :443 |
| Integration Layer | 3001 | Via Nginx :443 |
| Auth Engine | 3002 | Internal only |
| Resource Engine | 3003 | Internal only |
| Alert Manager | 3004 | Internal only |
| Notification Engine | 3005 | Internal only |
| Admin Dashboard | 3010 | Via Nginx :443 |
| Emergency View | 3011 | Via Nginx :8443 |
| PostgreSQL | 5432 | Internal only |
| TimescaleDB | 5433 | Internal only |
| Redis | 6379 | Internal only |
| Kafka | 9092 | Internal only |

---

## Kafka Topic Design

Create these exact topics on first boot:

```
sw.events.session       Partition key: account_id    Retention: 30 days
sw.events.resource      Partition key: resource_id   Retention: 30 days
sw.events.integration   Partition key: system_id     Retention: 30 days
sw.events.system        Partition key: tenant_id     Retention: 30 days
sw.alerts.outbound      Partition key: severity      Retention: 30 days
```

All topics: `replication.factor: 3`, `min.insync.replicas: 2`, `compression.type: lz4`

---

## Consumer Groups

| Group ID | Consumes | Purpose |
|---|---|---|
| `sw-auth-engine` | `sw.events.session` | Three-layer verification |
| `sw-resource-engine` | `sw.events.resource` | ACL verification |
| `sw-integration-monitor` | `sw.events.integration` | Health processing |
| `sw-audit-writer` | All `sw.events.*` | Write to TimescaleDB |
| `sw-alert-manager` | `sw.alerts.outbound` | Route to Notification Engine |

---

## Testing Requirements

You must write tests. Tests are not optional. Minimum coverage targets:

| Service | Test Type | Minimum Coverage |
|---|---|---|
| Auth Engine | Unit + Integration | 90% |
| Resource ACL Engine | Unit + Integration | 90% |
| Audit Log Store | Unit | 85% |
| Integration Layer | Unit + Integration | 85% |
| Alert Manager | Unit | 85% |
| REST API Gateway | Integration + E2E | 80% |
| Admin Dashboard | Component + E2E | 70% |

These four test suites must ALWAYS pass — zero tolerance, block any deployment:

```typescript
// 1. Audit log deletion throws AND fires CRITICAL alert C3
// 2. Tenant A cannot read Tenant B data (RLS enforced)
// 3. API error response never contains denial reason, layer info, or system detail
// 4. Three-layer verification: CLEAN only when all three pass
```

---

## GitHub Actions Pipeline

The CI/CD pipeline must run in this exact order:

```
Stage 1: lint-and-typecheck    ← TypeScript strict, ESLint, Go lint
Stage 2: security-scan         ← npm audit, trufflehog, CodeQL
Stage 3: test                  ← Unit + integration, coverage threshold
Stage 4: build                 ← Docker images → GHCR
Stage 5: deploy-staging        ← Auto on develop branch merge
Stage 6: deploy-production     ← Auto on main, REQUIRES manual approval gate
```

Production deploy uses `--atomic` flag — automatic rollback on failure.

---

## Definition of Done

A feature is not done until:

- [ ] Code written in TypeScript strict mode (no `any`)
- [ ] Unit tests written and passing
- [ ] Coverage threshold met
- [ ] All four critical test suites still passing
- [ ] No secrets in code, config files, or environment variables
- [ ] Error responses contain ONLY `{ error: 'Access Denied' }` — never internal detail
- [ ] Every action that touches data writes to the audit log
- [ ] HMAC signature generated on every audit log entry
- [ ] Relevant Kafka topic receiving/publishing correctly
- [ ] Docker image builds successfully
- [ ] Linter passes with zero warnings

---

*SecureWatch Kiro Master Spec v1.0 • March 2026*
