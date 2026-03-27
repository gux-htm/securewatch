# AegisGuard – Enterprise Unified Security Platform

> **Zero-Trust | IPS/IDS | Firewall | VPN | File Monitoring | Digital Audit**

AegisGuard is a production-ready, unified security orchestration platform that combines
Intrusion Prevention/Detection, Stateful Firewall, VPN management, cryptographic file
monitoring, privilege enforcement, and immutable audit logging into a single native
installation on any Linux or Windows server.

**No Docker. No containers. Bare-metal / direct-install only.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 AegisGuard Central Server                │
│  FastAPI + PostgreSQL 16 + Redis + OpenVPN + Scapy IDS  │
└─────────────────┬───────────────────────────────────────┘
                  │  TLS 1.3 + Mutual Cert Auth (WebSocket)
        ┌─────────┴──────────────────────────────────┐
        │                                            │
┌───────▼───────┐                          ┌────────▼──────────┐
│  Linux Agent  │                          │  Windows Agent    │
│  (systemd)    │                          │  (Windows Service) │
└───────────────┘                          └───────────────────┘
```

## Quick Start

### Linux Server

```bash
sudo bash install/install.sh
```

### Windows Server (PowerShell as Administrator)

```powershell
.\install\install.ps1
```

After installation, open https://localhost:8443 and log in as `superadmin`.

---

## Features

| Module | Description |
|--------|-------------|
| **VPN Management** | Create isolated networks, generate .ovpn files, enforce-only access |
| **Zero-Trust Auth** | Certificate + MAC + IP triple verification before every connection |
| **File Monitoring** | SHA-256 + digital signature on every file event, real-time to server |
| **ACL Engine** | Granular per-user/group/device/file permissions enforced by agent |
| **Firewall** | Stateful rules by IP, port, protocol, certificate; pushed to agents |
| **IDS/IPS** | Signature + anomaly detection; Scapy/nfqueue/WinDivert packet engine |
| **Audit Layer** | Immutable, server-signed audit trail for every security event |
| **Dashboard** | HTMX + TailwindCSS real-time SOC dashboard with live alerts |

---

## Directory Structure

```
aegisguard/
├── server/          # FastAPI central management server
├── agent/           # Lightweight Python client daemon
├── vpn/             # OpenVPN + Easy-RSA management
├── crypto/          # OpenSSL certificate authority & signing
├── dashboard/       # HTMX templates + static assets
├── database/        # SQLAlchemy models + Alembic migrations
├── install/         # install.sh (Linux) + install.ps1 (Windows) + service files
├── tests/           # pytest unit + integration tests
└── docs/            # API docs, deployment guide, admin manual
```

---

## Documentation

- [Deployment Guide](docs/deployment.md)
- [Admin Manual](docs/admin_manual.md)
- [API Reference](docs/api_reference.md) (also at `/api/docs` when running)
- [Client Agent Install](docs/agent_install.md)
