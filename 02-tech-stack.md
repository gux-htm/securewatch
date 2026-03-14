# Steering File 02 — Technology Stack
## These choices are locked. Do not substitute alternatives.

---

## Locked Technology Decisions

| Layer | Technology | Version | Do Not Substitute With |
|---|---|---|---|
| Backend runtime | Node.js | 20 LTS | Deno, Bun, Python, Java |
| Backend framework | Fastify | v4 | Express, Hapi, Koa, NestJS |
| Message broker | Apache Kafka | v3.6 | RabbitMQ, SQS, NATS, Redis Streams |
| Audit log DB | TimescaleDB | v2.13 | InfluxDB, Elasticsearch, ClickHouse |
| Primary DB | PostgreSQL | v16 | MySQL, MongoDB, SQLite |
| Cache | Redis | v7.2 | Memcached, DynamoDB |
| Frontend | React + TypeScript | React 18 | Vue, Angular, Svelte, Next.js |
| Frontend state | Zustand | v4 | Redux, MobX, Recoil |
| Real-time | WebSocket (ws) | v8 | Socket.io, SSE, polling |
| Agent | Go | v1.22 | Rust, Python, Node.js |
| SDK | TypeScript → npm | — | Other languages for primary SDK |
| Containers | Docker | v25 | Podman, containerd directly |
| Orchestration | Kubernetes | v1.29 | Docker Swarm, Nomad, ECS |
| Reverse proxy | Nginx | v1.25 | Caddy, Traefik, HAProxy |
| CI/CD | GitHub Actions | — | CircleCI, Jenkins, GitLab CI |
| Container registry | GHCR | — | Docker Hub, ECR, GCR |
| Secrets | HashiCorp Vault | v1.15 | AWS Secrets Manager, Azure Key Vault |
| Internal monitoring | Prometheus + Grafana | — | Datadog, New Relic, Dynatrace |
| Log aggregation | Fluentd → TimescaleDB | — | Logstash, Vector |
| TLS certs | Let's Encrypt + cert-manager | — | Self-signed, commercial CAs |
| DB migrations | node-pg-migrate | — | Flyway, Liquibase, Prisma migrate |
| Frontend styling | Tailwind CSS | — | Styled Components, Emotion, CSS Modules |
| Frontend charts | Recharts | — | Chart.js, D3, Victory |
| Frontend routing | React Router | v6 | TanStack Router, Wouter |
| Server state | TanStack Query | — | SWR, Apollo |

---

## Language Conventions

```
Backend services:     TypeScript — strict mode, no 'any', no non-null assertions (!.)
Agent:                Go — gofmt enforced, golangci-lint clean, no CGO
SDK:                  TypeScript — strict mode, tree-shakeable exports
Infrastructure:       YAML (K8s manifests), HCL (Terraform)
Database migrations:  SQL files only — via node-pg-migrate
Scripts:              Bash — shellcheck clean
```

---

## Package Management

```
Backend/Frontend:   npm workspaces (monorepo)
Agent:              Go modules
Do not use:         yarn, pnpm, bun (consistency requirement)
```

---

## Fastify vs Express

Fastify is used for all backend services. Never use Express. Reason: Fastify is 3x faster than Express, has built-in schema validation via JSON Schema / Zod, and lower memory overhead per connection — critical at 50,000 events/minute.

```typescript
import Fastify from 'fastify';
const app = Fastify({ logger: true });
// NOT: import express from 'express';
```

---

## TimescaleDB vs PostgreSQL

- `audit_events` table → **TimescaleDB** (Port 5433, hypertable)
- Everything else → **PostgreSQL** (Port 5432, standard tables)

Do not put audit_events in PostgreSQL. Do not put identity/resource/group data in TimescaleDB.

---

## Kafka Topic Naming

All topics follow the pattern: `sw.[category].[name]`

```
sw.events.session
sw.events.resource
sw.events.integration
sw.events.system
sw.alerts.outbound
```

No other naming pattern. No camelCase. No uppercase. No dots except as separators.

---

## JWT Configuration

```typescript
// Algorithm: RS256 (asymmetric — private key signs, public key verifies)
// Private key: stored in Vault at secret/securewatch/jwt/private
// Public key: stored in Vault at secret/securewatch/jwt/public
// TTL: 8 hours for Admin sessions
// TTL: 4 hours for Emergency Read-Only sessions
// Claims: admin_id, tenant_id, role, exp, iat
// NO symmetric HS256 — this is a security requirement
```

---

## Redis Usage Patterns

```
Session/auth:     admin_session:{admin_id}
Identity cache:   account:{tenant_id}:{account_id}  TTL: 60s
Device cache:     device:{tenant_id}:{device_id}    TTL: 60s
Zone cache:       zones:{tenant_id}                 TTL: 300s
Rate limiting:    ratelimit:{source_id}:{window}
Deduplication:    dedup:{tenant_id}:{dedup_key}
Admin inbox:      admin_inbox:{tenant_id}  (sorted set)
Exfil tracking:   exfil:{tenant_id}:{account_id}:{action}
Failed logins:    failed_logins:{tenant_id}:{account_id}
Admin auth fail:  admin_auth_fail:{admin_id}
Connection state: integration_state:{system_id}
```

---

## Kubernetes Namespaces

```
securewatch-integration   Integration Layer + Normalizer
securewatch-core          Auth Engine, Resource Engine, Alert Manager
securewatch-data          PostgreSQL, TimescaleDB, Redis, Kafka
securewatch-frontend      Admin Dashboard, REST API Gateway
securewatch-monitoring    Prometheus, Grafana
```

Services in different namespaces communicate via internal K8s DNS:
`[service-name].[namespace].svc.cluster.local`

---

## What Is Open Source vs Proprietary

| Component | Open/Proprietary | Why |
|---|---|---|
| SecureWatch Agent | **Proprietary** | Detection logic must not be exposed to attackers |
| SecureWatch SDK | **Open Source** (npm) | Drives adoption; only exposes event forwarding interface |
| Event detection logic | **Never in SDK** | Security requirement — SDK only forwards events |

---

*SecureWatch Steering 02 — Technology Stack • Locked • March 2026*
