# SecureWatch — Product Overview

SecureWatch is a lightweight, pluggable security monitoring platform that gives organisations real-time visibility over who accesses their systems, from where, and what they do once inside. It integrates into any existing infrastructure (on-premise, cloud, or hybrid) and raises alerts the moment an anomaly is detected.

## Core Problem

Most organisations cannot answer five questions at any given moment:
1. Who is currently logged in?
2. Is every active session tied to an authorised account and device?
3. What resources has each user accessed, and when?
4. Are there active brute-force or credential stuffing attacks?
5. Are privileged accounts being used within their authorised scope?

SecureWatch answers all five continuously and automatically.

## Key Capabilities

- **Universal Integration Layer** — connects to any system via Agent, REST/Webhook, Log Parser, or SDK
- **Three-Layer Authorisation Engine** — Account + Network Zone + Device fingerprint verification on every event
- **Resource Access Monitor** — full ownership lifecycle, ACL enforcement, inherited permissions, tamper-evident audit trail
- **Real-Time Alerting** — five severity levels (CRITICAL, HIGH, MEDIUM, LOW, INFO), multi-channel delivery
- **Indestructible Audit Log** — append-only, HMAC-SHA256 signed, permanently non-deletable by any role
- **Admin Dashboard** — single Admin operator model; unified inbox, live sessions, resource registry, integration health

## Operator Model

Single Admin operator per tenant. Platform Super Admin manages multi-tenant provisioning. End users interact with their own systems normally — their sessions and access patterns are monitored transparently.

## Compliance Targets

ISO 27001, SOC 2, HIPAA, GDPR audit requirements.

## Infrastructure

The project uses XAMPP + MySQL. No Docker, no docker-compose, no PostgreSQL, no Redis.
All database operations use `mysql2/promise`. Caching uses `node-cache` (in-process).
Never suggest Docker or PostgreSQL as alternatives.
