# AegisGuard – Deployment Guide

## Prerequisites

**Linux Server (recommended):** Ubuntu 22.04 LTS or 24.04 LTS, 4 vCPU, 8 GB RAM, 100 GB SSD.  
**Windows Server:** Windows Server 2022 or 2025, 4 vCPU, 8 GB RAM.

---

## Linux Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/aegisguard.git /tmp/aegisguard
cd /tmp/aegisguard
```

### 2. Run the installer

```bash
sudo bash aegisguard/install/install.sh
```

The script will:
- Install PostgreSQL 16, Redis, Python 3.12, OpenVPN, and all system packages
- Create the `aegisguard` system user
- Generate TLS certificates and a root CA
- Initialize the database via Alembic
- Register and start `aegisguard.service` and `aegisguard-ids.service` via systemd

### 3. Post-install steps

1. Open **https://\<server-ip\>:8443** in your browser
2. Log in with the credentials printed at the end of the install script
3. **Immediately change the superadmin password**

---

## Client Agent Installation

### Linux endpoint

```bash
sudo AEGIS_SERVER_URL=https://your-server:8443 \
     bash /opt/aegisguard/src/agent/install-agent.sh
```

### Windows endpoint

```powershell
$env:AEGIS_SERVER_URL = "https://your-server:8443"
.\agent\install-agent.ps1
```

---

## Firewall & Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 8443 | TCP (HTTPS) | AegisGuard Dashboard |
| 1194–1200 | UDP | OpenVPN (one port per network) |
| 5432 | TCP (localhost only) | PostgreSQL |
| 6379 | TCP (localhost only) | Redis |

---

## Backup & Restore

```bash
# Backup
sudo -u aegisguard pg_dump aegisguard | gzip > /var/lib/aegisguard/backups/$(date +%Y%m%d).sql.gz
sudo tar czf /var/lib/aegisguard/backups/ca-$(date +%Y%m%d).tar.gz /var/lib/aegisguard/ca/

# Restore
gunzip -c backup.sql.gz | sudo -u aegisguard psql aegisguard
```

**CRITICAL:** CA keys (`ca.key`, `master.key`) must be backed up to offline cold storage.
