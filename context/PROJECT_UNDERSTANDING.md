# SecureWatch — Project Understanding & Build Context

> This file is the ground truth reference for all coding decisions.
> Generated from: PRD v2.0, TDD v1.0, steering files 01–05, and in-scope brief.

---

## What SecureWatch Is

SecureWatch is a lightweight, pluggable security monitoring platform that gives organisations
real-time visibility over who accesses their systems, from where, and what they do once inside.
It integrates into any existing infrastructure (on-premise, cloud, or hybrid) via Agent,
REST/Webhook, Log Parser, or SDK, and raises real-time alerts the moment an anomaly is detected.
It enforces a three-layer authorisation check (Account + Network Zone + Device) on every event,
maintains a tamper-evident HMAC-SHA256-signed audit log that is permanently non-deletable by any
role, and delivers a unified Admin dashboard covering live sessions, resource registry, alert
inbox, integration health, and audit log search — all running on a single machine for the demo.

---

## Technology Stack (Locked — Do Not Substitute)

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite 5, Tailwind CSS v4, React Router v6, Zustand v4, Recharts, lucide-react |
| Backend | Node.js 20 LTS + TypeScript, Fastify v4 |
| Database | MySQL 8.0 via XAMPP (mysql2/promise — NO PostgreSQL, NO Redis, NO Docker) |
| Cache | node-cache (in-process npm package — NO Redis) |
| Message broker | Apache Kafka v3.6 (KafkaJS) |
| Agent | Go v1.22 — proprietary static binary, zero detection logic |
| SDK | TypeScript → npm — open source, event forwarding only |
| Secrets (prod) | HashiCorp Vault |
| Styling tokens | Defined in src/index.css @theme — NO tailwind.config.js |

---

## 5 Non-Negotiable Security Rules

### RULE 1 — Generic Denial Only (S1)
The ONLY response an end user ever receives when any verification layer fails is:
`{ "error": "Access Denied" }`
Never reveal which layer failed, why, account status, device status, or any internal detail.
Full denial detail goes ONLY to the audit log and Admin notification pipeline.

### RULE 2 — Audit Log Is Indestructible (S2)
The audit_events table is permanently non-deletable by any role including Admin.
Three enforcement layers must all exist:
- Application layer: delete() method throws + fires CRITICAL alert C3
- Database layer: REVOKE DELETE on audit_events FROM securewatch_app
- Storage layer: append-only mode
Any deletion attempt → blocked + CRITICAL alert C3 + logged.

### RULE 3 — MFA Is Non-Negotiable (S3)
Admin MFA (TOTP, RFC 6238) cannot be disabled. No bypass path exists.
JWT is issued ONLY after successful MFA verification.
Flow: credentials → MFA → JWT. No "remember device", no "skip MFA", no config flag.

### RULE 4 — HMAC on Every Audit Entry (S7)
Every row written to audit_events must have hmac_signature populated BEFORE the INSERT.
No row is ever inserted without a valid HMAC-SHA256 signature.

### RULE 5 — Three-Layer Verification Is Atomic (S1 + FR-2.9)
A session/action is CLEAN only when ALL THREE layers pass:
Layer 1 — Account (registered, active, not revoked/expired)
Layer 2 — Network Zone (source IP within authorised zone)
Layer 3 — Device (fingerprint matches registered device)
Failing ANY one layer → block action + generic "Access Denied" to user + full detail to Admin.

---

## Semester Demo — What We Must Prove

| Claim | What It Proves |
|---|---|
| IDS | System detects unauthorised file access attempt, logs it with HMAC signature, raises real-time alert |
| IPS | System BLOCKS the access before it happens. File is never opened. User gets "Access Denied" only. Block is permanently logged. |
| Access Monitoring | Every file action (view/edit/delete) recorded with: who, which machine, what time, HMAC-SHA256 signature |

---

## In-Scope Feature Checklist

- [x] User management — create users, assign status (active/suspended)
- [x] Privilege engine — grant read/write/delete per user per file/folder
- [x] File system watcher — monitor a local directory for access events
- [x] Three-layer auth — Account + Location + Device verification
- [x] Access enforcement — block unauthorised access BEFORE it happens
- [x] Audit log — every event logged, HMAC-signed, non-deletable
- [x] Alert inbox — real-time alerts when violations are detected
- [x] Live session view — who is active in the system right now
- [x] Resource registry — register files/folders, assign ACLs
- [x] Digital signatures — HMAC-SHA256 on every audit log entry
- [x] Full web dashboard — all 12 screens connected to real data
- [x] Single machine — runs locally for demo

---

## Build Order — 5 Phases

### Phase 1 — Foundation (Database + Auth)
- MySQL schema: all 11 migrations (tenants, accounts, devices, zones, groups, resources, ACL, integrations, sessions, alerts, audit_events)
- REST API bootstrap: Fastify app, config, mysql2 pool, node-cache wrapper, migration runner
- Auth routes: POST /api/v1/auth/login (step 1: credentials), POST /api/v1/auth/mfa (step 2: TOTP → JWT)
- Three-layer verification engine (core logic — used by all subsequent phases)
- HMAC-SHA256 audit log writer (must exist before any other feature writes data)
- Frontend Login page wired to real API (2-step: credentials → MFA)

### Phase 2 — Resource Registry + ACL Engine
- Resource CRUD routes (register files/folders, assign ACLs, set inheritance)
- ACL enforcement middleware (three-layer check on every resource action)
- File system watcher (chokidar on monitored directory → events → Kafka → auth engine)
- Privilege engine (grant/revoke read/write/delete per user per resource)
- Group management + conflict resolution (most-restrictive wins)
- Frontend Resources page wired to real data

### Phase 3 — Session Monitor + Alert Engine
- Active sessions table population (login/logout events → active_sessions)
- Alert manager (severity classification, deduplication, DEDUP_WINDOWS, alert codes C1–C8, H1–H6, M1–M5, L1–L4, I1–I5)
- Alert inbox routes (GET /api/v1/alerts, PATCH acknowledge)
- Frontend Sessions page + Inbox page wired to real data
- CRITICAL alert banner in Layout.tsx (shown when unacknowledged criticals exist)

### Phase 4 — Integration Layer + Audit Log Search
- Integration registry routes (register/list/health status)
- Integration health monitor (silence detection → DEGRADED → SILENT → C4 alert)
- Audit log search + export routes (filter by date, user, device, resource, severity)
- Frontend Integrations page + Audit Log page wired to real data
- Kafka consumer pipeline (Integration Layer → Normalizer → Event Bus → Auth Engine)

### Phase 5 — Remaining Screens + Demo Polish
- Account Management page (/accounts)
- Device Management page (/devices)
- Network Zones page (/zones)
- Groups & Privileges page (/groups)
- Settings & Notifications page (/settings)
- Emergency Read-Only View (:8443/emergency — separate port, auto-expiring JWT 4h)
- End-to-end demo flow: register user → register file → attempt unauthorised access → see block + alert + signed audit entry

---

## Key Architectural Decisions

- Single machine, XAMPP MySQL — no Docker, no PostgreSQL, no Redis, no TimescaleDB for demo
- node-cache replaces Redis for all caching (in-process)
- Kafka still used for event pipeline (KafkaJS)
- All design tokens in src/index.css @theme — never hardcode hex values
- IPs, MACs, UUIDs, timestamps → always font-mono class
- Severity indicators → always colour + text label + dot (never colour alone)
- Tables → always include empty state
- Loading states → skeleton loaders only, never spinners
- Audit log: append-only, HMAC-SHA256 signed, delete permanently blocked at app + DB level

---

## Current State of the Codebase

### Frontend (src/)
- App.tsx — router setup
- Layout.tsx — shell with topbar + sidebar + Outlet
- Pages built: Login, Inbox, Sessions, Resources, Integrations
- Pages still needed: AuditLog, Accounts, Devices, Zones, Groups, Settings, Emergency

### Backend (services/rest-api/)
- Fastify bootstrap, config, mysql2 pool, node-cache, migration runner exist
- Routes folder exists with health.ts only — all feature routes still to build

### Other Services
- auth-engine: consumer.ts + db/mysql.ts skeleton
- resource-engine: consumer.ts + db/mysql.ts skeleton
- integration-layer: app.ts, kafka.ts, normalizer.ts, types.ts skeleton

### Database
- 11 migration SQL files exist (001–011) covering all core tables

---

*Last updated: March 2026 — align all implementation decisions with this file*
