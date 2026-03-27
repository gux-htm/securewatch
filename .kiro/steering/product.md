# Oh-My-Guard! – Product Overview

Oh-My-Guard! is an enterprise unified security orchestration platform that combines IPS/IDS, stateful firewall, VPN management, cryptographic file monitoring, privilege enforcement, and immutable audit logging into a single native installation.

**Core principles:**
- Zero-trust everywhere: every device must pass triple verification (MAC + IP + certificate) before connecting
- No Docker / no containers for the Python backend — bare-metal install on Ubuntu 22.04/24.04 or Windows Server 2022/2025
- All communication is TLS 1.3 with mutual certificate authentication
- Immutable, cryptographically signed audit trail for every security event

**Target users:** Network administrators and security operations teams managing 500+ endpoints across isolated virtual networks.

**Key capabilities:**
- VPN network management with per-network .ovpn generation (OpenVPN + Easy-RSA)
- Real-time file/resource monitoring with SHA-256 hashing and user digital signatures
- Granular ACL enforcement at the agent level (cannot be bypassed locally)
- Signature + anomaly-based IDS/IPS with active packet blocking (Scapy/nfqueue on Linux, WinDivert on Windows)
- Live SOC dashboard (HTMX + TailwindCSS dark theme) with WebSocket alerts
- Role-based admin access: Super Admin, Network Admin, Auditor
