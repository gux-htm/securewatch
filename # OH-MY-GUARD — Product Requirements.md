# OH-MY-GUARD — Product Requirements Document (PRD)

**Document Version:** 1.0  
**Status:** Approved for Development  
**Classification:** Internal — Development Team  
**Product Name:** Oh-My-Guard  
**Product Type:** Multi-Layer Enterprise Security Monitoring Platform (IDS / IPS / Firewall / EDR / NDR / SIEM / XDR)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [System Overview & Architecture](#4-system-overview--architecture)
5. [Security Layer Architecture](#5-security-layer-architecture)
6. [User Roles & Permission Hierarchy](#6-user-roles--permission-hierarchy)
7. [Component Functional Requirements — External Security](#7-component-functional-requirements--external-security)
   - 7.1 Firewall
   - 7.2 IDS — Intrusion Detection System
   - 7.3 IPS — Intrusion Prevention System
   - 7.4 WAF — Web Application Firewall
   - 7.5 Honeypot Engine
   - 7.6 Metadata Stripping Engine
8. [Component Functional Requirements — Internal Security](#8-component-functional-requirements--internal-security)
   - 8.1 VPN Gateway
   - 8.2 Device Registration & Authentication System
   - 8.3 Network Segmentation
   - 8.4 Resource Path & Privilege Management
   - 8.5 Encrypted Communication Channel
   - 8.6 Event Logging & Audit Trail
   - 8.7 Session Management
9. [Component Functional Requirements — XDR Layer](#9-component-functional-requirements--xdr-layer)
   - 9.1 EDR — Endpoint Detection & Response
   - 9.2 NDR — Network Detection & Response
   - 9.3 SIEM — Security Information & Event Management
   - 9.4 Threat Intelligence Feed
   - 9.5 XDR Orchestration Engine
10. [External Attack Coverage — 32 Attack Types](#10-external-attack-coverage--32-attack-types)
11. [UI / UX Requirements](#11-ui--ux-requirements)
12. [Data Models](#12-data-models)
13. [API Requirements](#13-api-requirements)
14. [Alert & Notification System](#14-alert--notification-system)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Technology Stack](#16-technology-stack)
17. [Complete Live Scenario — End-to-End System Behaviour](#17-complete-live-scenario--end-to-end-system-behaviour)
18. [Acceptance Criteria](#18-acceptance-criteria)
19. [Out of Scope](#19-out-of-scope)
20. [Glossary](#20-glossary)

---

## 1. Executive Summary

**Oh-My-Guard** is an enterprise-grade, multi-layer security monitoring and prevention platform designed to protect servers, the services hosted on them (websites, databases, APIs, file storage), and the internal networks that communicate with them.

The platform addresses two distinct and equally dangerous threat surfaces simultaneously:

- **External threats** — Attackers originating from the public internet who attempt reconnaissance, exploitation, web application attacks, and privilege escalation against hosted services.
- **Internal threats** — Malicious or compromised devices operating within the infrastructure's own networks, attempting unauthorized resource access, lateral movement, or data exfiltration.

Oh-My-Guard unifies Intrusion Detection, Intrusion Prevention, Web Application Firewalling, Endpoint Detection & Response, Network Detection & Response, Security Information & Event Management, and Threat Intelligence into a single cohesive platform — culminating in Extended Detection & Response (XDR) capability.

The system is built on a **zero-trust** model: no device, user, or network connection is trusted by default. Every interaction must be authenticated, authorized, encrypted, and logged.

---

## 2. Problem Statement

Existing security solutions suffer from critical gaps:

| Problem | Impact |
|---|---|
| Point solutions (only a firewall, or only an IDS) leave the majority of the kill chain unmonitored | Attackers who get past one layer face no further resistance |
| Internal network traffic is left unmonitored | Insider threats and lateral movement go undetected |
| Access control is too coarse-grained | A compromised device has access to all resources it was ever granted |
| No deception layer | Attackers receive real error messages that confirm what is and isn't vulnerable |
| Logs exist in isolation | Individual component logs cannot be correlated into a unified attack narrative |
| Device identity relies only on credentials | Stolen credentials alone are sufficient to impersonate a registered device |

Oh-My-Guard is built to close all of these gaps in a single unified platform.

---

## 3. Goals and Non-Goals

### 3.1 Goals

- **G1** — Defend all hosted services against the full external attack kill chain: reconnaissance, delivery, exploitation, installation, command & control, and privilege escalation.
- **G2** — Enforce zero-trust device identity verification inside internal networks through multi-factor hardware and cryptographic credential binding (MAC + Static IP + Digital Signature + MFA).
- **G3** — Provide granular, per-resource, per-device, time-limited privilege management for all internal device-to-server interactions.
- **G4** — Maintain a tamper-evident, comprehensive audit trail of every security event and every device-resource interaction across all layers.
- **G5** — Deceive attackers at every layer through a deep honeypot and deception engine, generating intelligence rather than simply blocking threats.
- **G6** — Correlate events across all components through SIEM and orchestrate coordinated multi-component responses through the XDR engine.
- **G7** — Deliver a real-time, role-aware security management dashboard for Super Admins, Admins, and Network Monitors.
- **G8** — Support multiple isolated internal networks (Finance, Marketing, HR, etc.) each with independent monitoring, device registries, and security policies.

### 3.2 Non-Goals

- **NG1** — Oh-My-Guard is not a Managed Security Service (MSSP). It is a self-hosted platform operated by the organization's own security team.
- **NG2** — The platform does not provide network packet encryption itself — it enforces VPN usage and TLS; the cryptographic primitives are provided by standard libraries.
- **NG3** — Oh-My-Guard does not replace OS-level patch management — it monitors for CVE exposure and alerts, but patching is a human action.
- **NG4** — The platform does not provide physical security controls.
- **NG5** — Oh-My-Guard does not include a native antivirus engine — it integrates with ClamAV for file scanning.

---

## 4. System Overview & Architecture

### 4.1 What Oh-My-Guard Protects

| Asset Class | Examples |
|---|---|
| Hosted Services | Web applications (frontend & backend), REST APIs, databases, file storage systems |
| Servers | Application servers, database servers, file servers within the infrastructure |
| Internal Networks | Segmented logical networks (Finance, Marketing, HR, Engineering, etc.) |
| Registered Endpoints | Laptops, workstations, and other devices registered to internal networks |

### 4.2 The Three Security Domains

Oh-My-Guard operates across three domains, each with its own component set:

```
┌──────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SECURITY DOMAIN                         │
│  Firewall · IDS · IPS · WAF · Honeypot Engine · Metadata Stripper   │
│  Target: Internet-facing attacks against hosted services             │
└──────────────────────────────────────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       PROTECTED ASSETS                               │
│          Web Apps · Databases · APIs · File Storage                  │
└──────────────────────────────────────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     INTERNAL SECURITY DOMAIN                         │
│  VPN Gateway · Device Auth · Network Segmentation ·                  │
│  Resource Privilege Manager · Encrypted Channel · Audit Logger ·     │
│  Session Manager                                                     │
│  Target: Insider threats and compromised endpoints                   │
└──────────────────────────────────────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          XDR DOMAIN                                  │
│         EDR · NDR · SIEM · Threat Intelligence Feed ·                │
│                    XDR Orchestration Engine                          │
│  Target: Cross-layer correlation, advanced persistent threats        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Security Layer Architecture

Oh-My-Guard operates across **five independent security layers**. An attacker must breach every single layer to reach a protected asset. Each layer is autonomous — failure of one does not disable any other.

### Layer 1 — Network Perimeter

**Components:** External Firewall, IDS (External), IPS (External), Threat Intelligence Feed  
**Protects Against:** Hostile IPs, port scanning, DDoS, raw packet-level intrusion attempts  
**Managed By:** Administrator  

All traffic arriving from the public internet passes through Layer 1 first. This layer performs stateful packet inspection, signature-based threat detection, and automated blocking. The Threat Intelligence Feed enriches this layer with real-time knowledge of known-bad IPs, C2 domains, and attack patterns.

---

### Layer 2 — Web Application

**Components:** WAF, Honeypot Engine, File Upload Security, Header Sanitizer, Rate Limiter, Metadata Stripper  
**Protects Against:** SQLi, XSS, SSRF, path traversal, malicious uploads, IDOR, authentication attacks  
**Managed By:** Administrator (configuration), automated enforcement  

Layer 2 inspects HTTP/HTTPS application traffic at Layer 7. It is the primary defense for all web-facing services. The Honeypot Engine operates heavily at this layer — fake admin panels, fake directories, and fake files trap attackers who have survived Layer 1.

---

### Layer 3 — Internal Network

**Components:** VPN Gateway, Internal Firewall (per network), IDS (Internal), IPS (Internal)  
**Protects Against:** Unauthorized device access, unauthenticated connections, protocol violations, intra-network attacks  
**Managed By:** Network Monitor (per network), Administrator (cross-network)  

No device may communicate with the protected server without passing through Layer 3. Every device must be VPN-authenticated with verified MAC + Static IP + Digital Signature + MFA. Network Monitors define internal firewall rules that can be scoped to the network, a group, or an individual device.

---

### Layer 4 — Endpoint & Behavior

**Components:** EDR, Session Monitor, File Integrity Monitor (FIM), MFA Engine, Resource Path Controller  
**Protects Against:** Compromised endpoints, unauthorized resource access, privilege abuse, cron hijacking, post-exploitation activity  
**Managed By:** Network Monitor (device management), automated enforcement  

Layer 4 governs what authenticated devices are allowed to do once they are connected. Privileges are enforced per device per resource path. The FIM monitors all registered server resources for unauthorized changes. The Session Monitor tracks every communication window.

---

### Layer 5 — Intelligence & XDR

**Components:** NDR, SIEM, Threat Intelligence Feed, XDR Orchestration Engine  
**Protects Against:** Multi-stage attacks, lateral movement, C2 beaconing, advanced persistent threats, cross-layer attack chains  
**Managed By:** Administrator, Super Admin  

Layer 5 is the intelligence brain. It collects telemetry from all other layers, correlates events across time and components, and orchestrates coordinated responses. A single alert from Layer 1 combined with a WAF block from Layer 2 and an anomalous process on Layer 4 will cause the SIEM to classify this as a coordinated attack campaign, triggering XDR to respond across all layers simultaneously.

---

## 6. User Roles & Permission Hierarchy

### 6.1 Role Overview

```
[ SUPER ADMIN ]
      ▼
  [ ADMIN ]
      ▼
[ NETWORK MONITOR ]
      ▼
 [ END DEVICE / USER ]
```

| Level | Role | Scope | Summary |
|---|---|---|---|
| 1 | Super Admin | Entire Oh-My-Guard platform | Global configuration, all admin management, all-network visibility |
| 2 | Admin | External perimeter + infrastructure oversight | External Firewall, external IDS/IPS, honeypot management, Admin-level SIEM view |
| 3 | Network Monitor | Assigned network segment(s) | Internal Firewall, internal IDS/IPS, device registration, privilege management, group management |
| 4 | End Device / User | Their registered device + granted resource paths | Operate within their privileges through the secure encrypted channel |

---

### 6.2 Super Admin — Full Specification

The Super Admin is the highest authority on the platform. This role manages the platform itself, not individual networks.

**Capabilities:**
- Create, edit, suspend, and delete Admin accounts.
- Configure global system settings: encryption standards, VPN policy, MFA requirements, global alert thresholds.
- View the consolidated SIEM dashboard across all networks and all layers simultaneously.
- View all logs from all components with no restriction.
- Override any access decision made by Admin or Network Monitor.
- Cannot be locked out, suspended, or demoted by any other role.
- Receive escalated alerts when critical incidents go unacknowledged by lower roles.

---

### 6.3 Admin — Full Specification

The Admin is responsible for the external security perimeter and has infrastructure-wide oversight.

**External Responsibilities:**
- Configure and manage the external Firewall: define rules for all internet-facing traffic (source IP ranges, destination ports, protocols, allow/deny action, rule priority, rule description).
- Use IDS for external threat detection: receive alerts for port scans, banner grabbing, directory enumeration, DNS enumeration, web application attacks, DDoS patterns, and privilege escalation attempts.
- Use IPS for external threat prevention: auto-blocking of hostile IPs, rate limiting, session termination, honeypot activation.
- Manage the full Honeypot Engine configuration: which fake services to expose, what OS fingerprint to return, which directories to honeypot, which subdomains to deploy as honeypot servers.
- Receive high-priority alerts for all external attack detections.
- View and interact with the full external event log.

**Internal Oversight Responsibilities:**
- Create, edit, and deactivate Network Monitor accounts.
- Assign Network Monitor accounts to specific network segments.
- View the consolidated SIEM dashboard across all internal networks.
- Set infrastructure-wide security baselines: mandatory encryption standard (TLS 1.3), VPN requirement, MFA enforcement, session timeout policy.
- Receive escalated alerts when network monitors fail to respond to critical threats within a defined SLA window.
- View (read-only) device registries, privilege assignments, and event logs for all internal networks.

---

### 6.4 Network Monitor — Full Specification

Network Monitors are assigned to one or more internal network segments. They are the primary security operators for their networks.

**Device Management:**
- Register new devices to their network: capture MAC address, assign a static IP, register a digital signature for the device.
- View device details page: shows registered MAC, static IP, digital signature, and registration timestamp.
- View device activity history: complete chronological list of every server interaction performed by the device (resource accessed, action taken, timestamp, status).
- View device sessions: VPN login time, server connection establishment time, communication start and end timestamps for every session.
- Grant and revoke privileges for devices on specific resource paths: View, Create, Edit, Delete, Rename — each independently.
- Set time-limited privileges: a privilege grant includes an optional expiry date/time after which it is automatically revoked.
- Remove devices from the network (forced deregistration for malicious or unauthorized devices).

**Group Management:**
- Create named device groups within their network (e.g., "Accounting Team" within "Finance Network").
- Assign group-level privileges on resource paths: all devices in the group inherit these privileges.
- Apply group-level firewall rules.
- Add or remove devices from groups.

**Security Responsibilities:**
- Configure internal Firewall rules scoped to: the full network, a specific group, or an individual device.
- Define rules by: protocol, destination port, source device/IP, allowed/denied action.
- Use IDS to monitor internal traffic anomalies within their network.
- Use IPS to block rogue sessions or suspicious devices within their network.
- Receive alerts when a device's credentials do not match on VPN connection:
  - One credential mismatch → Standard alert.
  - Two credential mismatches → High alert.
  - All three credentials fail → Critical alert + option to immediately remove the device.

---

### 6.5 End Device / User — Full Specification

End devices are registered client endpoints that interact with protected server resources.

**Interaction Model:**
- Connect to VPN using their device credential set (MAC + static IP + digital signature — verified automatically by the system).
- Complete MFA authentication after VPN connection is established.
- Access the Oh-My-Guard secure communication interface.
- Perform only the operations on resource paths that they have been explicitly granted privileges for.
- All actions are logged with full forensic detail — no action is unrecorded.

**What End Devices Cannot Do:**
- Access any resource path they have not been explicitly granted access to.
- Perform any operation (e.g., delete) on a resource if only a lower privilege (e.g., view) was granted.
- Communicate outside of the VPN tunnel.
- Access any other device's session or resource history.
- Modify their own credential set.

---

## 7. Component Functional Requirements — External Security

### 7.1 Firewall

#### 7.1.1 Purpose
The Firewall is the first line of defense. It controls all traffic entering and leaving the protected server's network boundary based on rule sets defined by Admins (external) and Network Monitors (internal).

#### 7.1.2 Functional Requirements

**FR-FW-001 — Stateful Packet Inspection**  
The Firewall MUST track the state of all active network connections, not just individual packets. It MUST allow return traffic for legitimate established connections and block unsolicited inbound traffic.

**FR-FW-002 — Rule-Based Allow/Deny**  
The Firewall MUST support the creation of rules specifying:
- Source IP or CIDR range
- Destination IP or CIDR range
- Destination port or port range
- Protocol (TCP, UDP, ICMP, or all)
- Action: Allow or Deny
- Rule priority (lower number = higher priority)
- Rule description / label
- Rule enabled/disabled toggle

**FR-FW-003 — Rule Scope**  
- Admin MUST be able to create external Firewall rules for all internet-facing traffic (inbound and outbound).
- Network Monitor MUST be able to create internal Firewall rules scoped to:
  - Their entire network segment
  - A specific device group within their network
  - An individual registered device

**FR-FW-004 — Automatic IP Blocking from IDS/IPS**  
When the IDS or IPS escalates an IP to "hostile" or "critical" tier, the Firewall MUST automatically add a deny rule for that IP without Admin manual action. The Admin MUST be notified of auto-added rules.

**FR-FW-005 — Protocol Enforcement**  
The Firewall MUST enforce allowed communication protocols per network segment and per device group. Unauthorized protocols MUST be blocked and logged.

**FR-FW-006 — Traffic Logging**  
All allowed and denied traffic MUST be logged with: timestamp, source IP, destination IP, port, protocol, rule matched, and action taken. These logs MUST feed into the SIEM.

**FR-FW-007 — IP Reputation Pre-Blocking**  
Firewall MUST integrate with the Threat Intelligence Feed to automatically apply deny rules for IPs in known malicious IP lists (botnet IPs, known scanner IPs, Tor exit nodes) before any connection attempt is evaluated against custom rules.

---

### 7.2 IDS — Intrusion Detection System

#### 7.2.1 Purpose
The IDS passively monitors all network traffic and system events to detect suspicious patterns, known attack signatures, and policy violations. It generates alerts but does not block traffic on its own.

#### 7.2.2 Functional Requirements

**FR-IDS-001 — Dual Scope**  
- Admin-level IDS MUST monitor all internet-facing traffic.
- Network Monitor-level IDS MUST monitor all traffic within their assigned network segment.

**FR-IDS-002 — Signature-Based Detection**  
The IDS MUST maintain a library of known attack signatures covering at minimum:
- Port scanning (SYN flood patterns, Nmap/Masscan fingerprints)
- Banner grabbing patterns
- Directory and file enumeration (high-frequency 404 patterns, known wordlist paths)
- DNS enumeration bursts
- SQLi payloads (UNION SELECT, DROP TABLE, OR '1'='1', time-based SLEEP, boolean-based patterns)
- XSS payloads (`<script>`, `onerror=`, `javascript:`)
- Path traversal sequences (`../`, `..%2f`, `..%5c`, null byte injection)
- Command injection characters (`;`, backtick, `&&`, `||`, pipe with shell commands)
- SSRF patterns (internal IP ranges in request parameters, cloud metadata endpoint URLs)
- File upload attacks (executable MIME types in upload streams, double-extension filenames)
- Brute force patterns (high-frequency login failure from same IP)
- Credential stuffing (distributed login attempts with different usernames from rotating IPs)
- JWT manipulation (alg:none, modified header/payload with mismatched signature)
- SSTI patterns (`{{7*7}}`, `${7*7}`)
- Privilege escalation commands (`sudo -l`, `find / -perm -4000`, `uname -r` in shell sessions)
- Cron modification events (changes to files in /etc/cron.d, /var/spool/cron)

**FR-IDS-003 — Anomaly-Based Detection**  
The IDS MUST:
- Establish baselines of normal traffic volume, port usage, protocol mix, and access patterns per device and per network segment.
- Trigger alerts when measured behavior deviates from the established baseline beyond a configurable threshold.
- Baseline learning period MUST be configurable (default: 7 days).

**FR-IDS-004 — Device Credential Mismatch Detection**  
When a device connects to the VPN, the IDS MUST:
- Verify the device's MAC address against its registered MAC.
- Verify the connecting IP matches the device's assigned static IP.
- Verify the device's digital signature against its registered signature.
- One mismatch → generate a Standard alert to the Network Monitor.
- Two mismatches → generate a High alert to the Network Monitor.
- All three mismatches → generate a Critical alert to the Network Monitor and Admin, and offer the Network Monitor the option to immediately remove the device.

**FR-IDS-005 — Alert Generation**  
Every detection MUST produce an alert containing:
- Alert ID (unique)
- Timestamp (UTC)
- Source IP
- Destination IP and port
- Attack category and specific attack type
- Severity level: Normal, Moderate, or Critical
- Raw evidence (packet snippet, request payload, matched signature)
- Recommended response action

**FR-IDS-006 — Signature Update Integration**  
IDS signatures MUST be automatically updated from the Threat Intelligence Feed when new attack patterns are published.

---

### 7.3 IPS — Intrusion Prevention System

#### 7.3.1 Purpose
The IPS is the active prevention counterpart to the IDS. It sits inline with traffic and can drop, block, rate-limit, redirect, or terminate connections in real time, without waiting for Admin intervention.

#### 7.3.2 Functional Requirements

**FR-IPS-001 — Dual Scope**  
- Admin-level IPS MUST handle prevention for all internet-facing traffic.
- Network Monitor-level IPS MUST handle prevention for traffic within their assigned network segment.

**FR-IPS-002 — Inline Packet Dropping**  
The IPS MUST be capable of dropping malicious packets before they reach the application layer. Packet dropping MUST be logged.

**FR-IPS-003 — Automatic IP Banning**  
The IPS MUST automatically ban an attacker's IP at the Firewall level when:
- 50 or more rapid probes are detected within a configurable time window (default: 60 seconds), OR
- The IDS escalates an IP to the "critical" threat tier.

**FR-IPS-004 — Rate Limiting**  
The IPS MUST enforce rate limiting on suspicious traffic:
- After 20 rapid HTTP 404 responses to the same IP: throttle to 1 request per 5 seconds.
- After 3 failed login attempts per 30 seconds per IP: trigger CAPTCHA requirement.
- After 5 failed login attempts from the same IP to the same account: lock the account.
- After 10 failed login attempts: route subsequent login attempts from that IP to a honeypot login panel.
- All rate limit thresholds MUST be configurable by the Admin.

**FR-IPS-005 — Session Termination**  
The IPS MUST be able to forcibly terminate an active malicious session. Termination events MUST be logged and the relevant Admin or Network Monitor notified.

**FR-IPS-006 — Network Quarantine**  
When a device or server segment shows signs of active compromise (anomalous process spawning, RCE detection, privilege escalation attempt), the IPS MUST be capable of immediately isolating the affected host from all network communication. Quarantine events MUST generate a Critical alert.

**FR-IPS-007 — Device Removal**  
Network Monitors MUST be able to use the IPS to forcibly remove a malicious or unrecognized device from their network segment. This action MUST be logged with the Network Monitor's identity.

**FR-IPS-008 — Escalating Response Tiers**  
The IPS MUST implement a graduated response model:
- Tier 1 (Suspicious): Rate limiting + increased monitoring
- Tier 2 (Hostile): Session termination + IP ban
- Tier 3 (Critical): Network quarantine + forensic capture + Admin alert + rollback trigger

---

### 7.4 WAF — Web Application Firewall

#### 7.4.1 Purpose
The WAF operates at OSI Layer 7 (application layer), inspecting all HTTP and HTTPS traffic directed at hosted web services. It protects against web-specific attack vectors that network-layer tools cannot see inside encrypted or application-layer payloads.

#### 7.4.2 Functional Requirements

**FR-WAF-001 — SQL Injection Prevention**  
- MUST detect and block SQLi patterns in: URL parameters, POST body fields, HTTP headers, file names, and cookie values.
- Pattern coverage MUST include: UNION-based, error-based, boolean-based, time-based (SLEEP/WAITFOR), and stacked queries.
- On SQLi detection: MUST NOT return an error (which confirms the vulnerability). MUST return a convincing but entirely fabricated fake dataset of dummy records to deceive the attacker.
- Exact injection payload MUST be logged with attacker IP, timestamp, target endpoint, and injection location.
- Attacker IP MUST be escalated in threat tier.

**FR-WAF-002 — Blind SQLi Prevention**  
- MUST detect time-based blind SQLi by monitoring for anomalous response time patterns from the same IP.
- MUST add artificial uniform delay to ALL responses from flagged IPs to make time-based inference impossible.
- MUST detect boolean-based blind SQLi by recognizing `AND 1=1` / `AND 1=2` alternation patterns.

**FR-WAF-003 — Cross-Site Scripting (XSS) Prevention**  
- MUST detect and block XSS payloads in all user-supplied inputs.
- MUST HTML-encode all user input before storage and before rendering.
- MUST enforce Content Security Policy (CSP) headers on all responses, blocking inline script execution.
- MUST set HttpOnly flag on all session cookies.
- MUST set SameSite=Strict on all session cookies.

**FR-WAF-004 — XML External Entity (XXE) Prevention**  
- MUST configure the XML parser to reject all external entity references.
- MUST validate uploaded XML files against a strict schema before processing.
- If XXE is attempted: MUST return a convincing fake file response (e.g., fake /etc/passwd with traceable fake usernames) and generate an alert.

**FR-WAF-005 — Server-Side Request Forgery (SSRF) Prevention**  
- MUST maintain a strict allowlist of domains the server is permitted to fetch URLs from.
- MUST block all requests to internal IP ranges: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.
- MUST permanently blacklist cloud metadata endpoint 169.254.254.254 (and all variants).
- MUST deploy a fake internal endpoint honeypot to log and trap SSRF attempts.

**FR-WAF-006 — File Upload Security**  
This is a multi-stage pipeline. All stages MUST pass before a file is accepted:

- **Stage 1 — Extension Allowlist:** Only explicitly whitelisted file extensions are accepted. All other extensions MUST be rejected before any further processing.
- **Stage 2 — MIME Type Verification:** The declared Content-Type header MUST match the actual file's MIME type. Mismatches MUST be rejected.
- **Stage 3 — Magic Byte Verification:** The file's actual binary header (magic bytes) MUST be verified against the claimed file type. A file claiming to be a JPEG but with a PHP or ELF magic header MUST be rejected.
- **Stage 4 — Filename Sanitization:** The original filename MUST be discarded entirely. The file MUST be stored with a randomly generated UUID as its name on the server. The attacker MUST never be able to predict the stored file path.
- **Stage 5 — Null Byte and Special Character Rejection:** Filenames containing `%00`, `../`, `;`, or any other path manipulation or shell characters MUST be rejected.
- **Stage 6 — Antivirus Scan (ClamAV):** The file MUST be passed through ClamAV before storage. Files with detected malware signatures MUST be quarantined and the upload rejected.
- **Stage 7 — Sandboxed Execution Analysis:** Suspicious files (those that passed extension/MIME checks but triggered heuristic flags) MUST be detonated in an isolated sandbox environment before being accepted.
- **Stage 8 — noexec Enforcement:** The upload directory MUST be mounted with the `noexec` filesystem flag. No script or executable file stored in the upload directory can ever be executed, even if all prior checks are somehow bypassed.
- **Stage 9 — Hash Logging:** The SHA-256 hash of every accepted upload MUST be stored for integrity tracking and forensic comparison.

**FR-WAF-007 — MIME Type Bypass Prevention**  
- MUST apply both the extension allowlist AND the magic byte check — either can reject the file independently.
- MUST detect and reject double-extension tricks: `shell.php.jpg`, `shell.pHp`, `shell.php%00.jpg`.
- MUST detect and reject case-variation bypasses: `Shell.PHP`, `SHELL.pHp`.

**FR-WAF-008 — Path Traversal / Directory Traversal Prevention**  
- MUST resolve and canonicalize all file paths before processing.
- MUST verify resolved paths remain within the authorized root directory.
- MUST detect and strip `../`, `..%2f`, `..%5c`, and URL-encoded traversal sequences.
- Web process MUST run within a chroot jail — even if traversal is somehow achieved, the process cannot access system files outside its jail.
- If traversal is attempted: MUST serve convincing fake system file contents and generate an alert.

**FR-WAF-009 — IDOR Prevention**  
- MUST replace all sequential integer IDs exposed in URLs and API responses with randomly generated UUIDs (unpredictable identifiers).
- MUST verify on every resource access request that the requesting session's `user_id` matches the `owner_id` of the requested resource.
- MUST deploy honeypot record IDs — fake resource identifiers that trigger an alert if accessed by any session.

**FR-WAF-010 — Insecure Direct Object Reference — Business Logic**  
- Every field in every record that can be modified MUST have its own permission check — not just route-level access control.
- Every modification to any record field MUST be logged with the previous value, new value, modifier identity, and timestamp.

**FR-WAF-011 — Server-Side Template Injection (SSTI) Prevention**  
- MUST strip `{{`, `}}`, `{%`, `%}`, `${` patterns from all user-supplied input before it reaches any template engine.
- Template engine MUST run in restricted sandbox mode with no access to system globals or the file system.
- If SSTI pattern is detected: MUST return a fake benign template output and generate an alert.

**FR-WAF-012 — Insecure Deserialization Prevention**  
- MUST refuse all uploads and API payloads using Python Pickle, Java serialized objects, PHP serialized strings, or similar dangerous serialization formats.
- MUST only accept structured data in JSON format with schema validation.
- If deserialization is required (e.g., for internal queuing), it MUST happen in an isolated process with no network access.

**FR-WAF-013 — Command Injection Prevention**  
- MUST strip and reject shell special characters from all user inputs: `;`, `|`, `&`, `` ` ``, `$()`, `>`, `<`.
- File processing operations MUST NEVER pass user input to a shell command. All processing MUST use language-native libraries or subprocess calls with argument arrays (no shell=True).
- File processing worker MUST run without shell access at the OS process level.

**FR-WAF-014 — CSV / Formula Injection Prevention**  
- MUST detect and sanitize CSV cell values that begin with `=`, `+`, `-`, or `@` (formula injection vectors).
- MUST prefix such cells with a single apostrophe to prevent spreadsheet formula execution when files are opened.
- MUST warn the Admin if a processed CSV contained formula-like patterns.

**FR-WAF-015 — Header Sanitization & Banner Falsification**  
- MUST strip all version information from server response headers (remove `X-Powered-By`, `Server`, version strings from any header).
- MUST return fake banners when service banners are requested (e.g., report Apache 2.2 when running a different server).

**FR-WAF-016 — Authentication Attack Prevention**  
- MUST detect and block JWT tokens with `alg: none`.
- MUST use RS256 (asymmetric) algorithm for JWT signing — never HS256.
- MUST verify every JWT signature cryptographically on every request.
- MUST log all tokens with invalid or modified signatures with the original vs. tampered payload.
- Session tokens MUST be bound to: IP address, User-Agent, and device fingerprint.
- Sessions MUST expire after a configurable inactivity period (default: 30 minutes).
- A new token MUST be issued after every sensitive action (token rotation).
- Concurrent sessions from different IPs for the same account MUST generate an alert.

**FR-WAF-017 — DDoS on Upload Endpoints**  
- MUST enforce a hard file size cap on all uploads (default maximum: 10MB; configurable per Admin).
- MUST enforce a maximum upload rate per account and per IP (default: N uploads per minute; configurable).
- Must integrate with CDN/upstream traffic scrubbing for volumetric flood absorption.
- MUST support blackhole routing of flood traffic to a null interface.

**FR-WAF-018 — MITM / Transport Security**  
- MUST enforce TLS 1.3 for all HTTPS connections. TLS 1.2 and below MUST be rejected.
- MUST set HSTS (HTTP Strict Transport Security) header with a minimum max-age of 1 year.
- MUST implement certificate pinning for the server's TLS certificate.
- MUST monitor for ARP spoofing at the network layer and alert on anomalies.

**FR-WAF-019 — DNS Security**  
- MUST implement DNSSEC for all managed DNS zones.
- MUST monitor DNS records for unexpected changes and alert on any unauthorized modification.
- Certificate pinning ensures that even if DNS is hijacked, the browser refuses to connect due to certificate mismatch.

---

### 7.5 Honeypot Engine

#### 7.5.1 Purpose
The Honeypot Engine is a deception infrastructure that runs across all external-facing layers. Its goal is to mislead attackers, waste their time, generate forensic intelligence about their techniques, and cause them to operate in a monitored fake environment while believing they have achieved real access.

#### 7.5.2 Functional Requirements

**FR-HP-001 — Honeypot Service Activation**  
On detection of a port scan from an IP, the Honeypot Engine MUST:
- Activate fake services on the most commonly scanned ports: fake SSH on port 22, fake database on port 3306, fake admin HTTP on port 8080.
- Place real services into stealth mode — they MUST stop responding to probe packets from the flagged IP (ports appear closed/filtered).

**FR-HP-002 — OS Fingerprint Spoofing**  
- When the system detects OS fingerprinting attempts (Nmap `-O` patterns, TCP/IP stack probing), it MUST return a deliberately misleading OS fingerprint.
- The fake OS reported MUST differ from the real OS.
- The Admin MUST be able to configure what fake OS fingerprint to advertise.

**FR-HP-003 — Banner Falsification**  
- All service banners returned to flagged IPs MUST be fake.
- Example: Report "Apache 2.2.14 (Ubuntu)" when running a different server/version.
- No real software version information MUST ever be revealed.

**FR-HP-004 — Fake Directory Honeypots**  
- Paths `/admin`, `/backup`, `/config`, `/wp-admin`, `/phpMyAdmin`, and other commonly enumerated paths MUST redirect to monitored fake panels.
- Fake directories MUST look functional enough to engage the attacker.
- Any interaction with a fake directory MUST log: attacker IP, exact URL accessed, HTTP method, request headers, request body, timestamp.

**FR-HP-005 — Fake File Honeypots**  
- Files such as `config.php.bak`, `db.sql`, `.env`, `credentials.txt` MUST be served as downloadable traps from honeypot directories.
- These files MUST contain bogus credentials formatted to look real but deliberately traceable (e.g., unique identifiers embedded in the fake credentials that allow attribution if used elsewhere).

**FR-HP-006 — Fake Login Honeypot**  
- After 10 failed login attempts from an IP, subsequent login attempts from that IP MUST be served a fake "login successful" response.
- The attacker MUST be placed in a fully simulated fake panel that looks functional.
- Every command, click, and action taken inside the fake panel MUST be logged.
- The fake panel MUST have no connection to real data or real system resources.

**FR-HP-007 — Fake Shell Execution Environment**  
- If a web shell upload somehow reaches the storage layer, its execution MUST be intercepted and the attacker routed to a fake OS environment.
- Every command executed in the fake shell MUST be logged in full.
- The fake shell MUST mimic realistic-looking responses (fake `whoami`, fake `ls`, fake `uname -r` output).

**FR-HP-008 — Fake SSRF Honeypot Endpoint**  
- A fake internal API endpoint MUST be deployed to log and trap SSRF attempts.
- Any request reaching this endpoint MUST log the full request detail and generate an alert.

**FR-HP-009 — Fake Database Response**  
- On SQLi detection, instead of an error page, the WAF MUST return a convincing dataset of completely fabricated records.
- The fake records MUST contain traceable fake data (e.g., user IDs with unique patterns) to allow attribution.

**FR-HP-010 — Fake Admin Panel (Vertical Privilege Escalation Trap)**  
- The `/admin` path and any path a low-privilege user attempts to access as an admin MUST lead to a convincing but fully monitored fake admin panel.
- Any attempt to read data, change settings, or take action within the fake admin panel MUST be logged.

**FR-HP-011 — Honeypot User Accounts**  
- A set of fake user accounts with realistic names and seemingly valuable data MUST exist in the system.
- These accounts MUST never appear in legitimate workflows — they are accessible only by attackers.
- Any login to a honeypot account, access to a honeypot account's resources, or reference to a honeypot user ID MUST generate a Critical alert.

**FR-HP-012 — Fake Subdomain Honeypots**  
- Subdomains such as `dev.target.com`, `staging.target.com`, `api-internal.target.com` MUST resolve to monitored honeypot servers.
- All traffic to these subdomains MUST be logged.

**FR-HP-013 — Fake SUID Binaries (Internal Layer)**  
- Fake SUID binaries MUST be present in the server filesystem at paths an attacker would discover via `find / -perm -4000`.
- Execution of any fake SUID binary MUST trigger an immediate Critical alert with the full process context of the caller.

**FR-HP-014 — Alert on Any Honeypot Trigger**  
Every honeypot interaction — regardless of type — MUST generate an alert to the Admin with:
- Which honeypot component was triggered
- Full attacker session detail (IP, User-Agent, full request/command)
- Timestamp
- Severity: Minimum High; Critical for fake account access or fake shell execution.

---

### 7.6 Metadata Stripping Engine

#### 7.6.1 Purpose
Files uploaded to and served by the system may contain embedded metadata (author names, internal file paths, software versions, GPS coordinates, usernames) that an attacker can extract with OSINT tools to learn about the organization's internal infrastructure.

#### 7.6.2 Functional Requirements

**FR-META-001 — Automatic Metadata Stripping on Upload**  
Before any uploaded file is stored or served, the Metadata Stripping Engine MUST:
- Remove all EXIF data from images (JPEG, PNG, TIFF, HEIC).
- Remove document properties from office files (DOCX, XLSX, PDF): author, last modified by, company name, creation application, revision history.
- Remove GPS coordinates from all media files.
- Remove embedded thumbnails that may contain older versions of the file.

**FR-META-002 — Fake Metadata Injection (Optional, Configurable)**  
- The Admin MUST be able to configure the system to inject deliberately misleading fake metadata into files before serving them.
- Fake metadata MUST use a different author name, different software version, and different internal path — designed to mislead OSINT tools.
- Fake metadata values MUST be configurable per file type.

**FR-META-003 — Scope**  
- Metadata stripping MUST apply to all files uploaded through the web application before they are stored.
- Metadata stripping MUST apply to all files served to external (unauthenticated or public) users.
- Internal authenticated users on the encrypted channel MAY receive files with metadata stripped or preserved, based on Admin configuration.

---

## 8. Component Functional Requirements — Internal Security

### 8.1 VPN Gateway

#### 8.1.1 Purpose
All internal device-to-server communication MUST occur exclusively through an encrypted VPN tunnel. No unencrypted or non-VPN communication is permitted under any circumstance.

#### 8.1.2 Functional Requirements

**FR-VPN-001 — Mandatory VPN Enforcement**  
No device MUST be permitted to communicate with the protected server outside of an established VPN tunnel. Direct connections MUST be rejected at the Firewall level.

**FR-VPN-002 — Registration-Gated Access**  
Only devices that have been registered by a Network Monitor MUST be able to establish a VPN connection. Connection attempts from unregistered devices MUST be rejected and logged.

**FR-VPN-003 — Credential Verification on VPN Connect**  
Every time a device connects to the VPN, the system MUST automatically and silently verify:
1. The device's MAC address matches its registered MAC.
2. The IP the device is connecting with matches its assigned static IP.
3. The device's digital signature matches its registered signature.

All three MUST match for the connection to proceed to MFA. See FR-IDS-004 for the alert behavior on mismatches.

**FR-VPN-004 — Encrypted Traffic**  
All traffic through the VPN MUST be encrypted end-to-end. The encryption standard MUST be configurable by the Admin with a minimum standard of AES-256.

**FR-VPN-005 — Protocol Enforcement over VPN**  
The type of communication a device may perform over the VPN tunnel MUST be enforced:
- Certain networks MAY be restricted from download operations.
- Certain networks MAY be restricted from sending files to the server.
- Protocol enforcement rules are set by the Network Monitor and applied at the VPN/internal Firewall level.

---

### 8.2 Device Registration & Authentication System

#### 8.2.1 Purpose
This system establishes and enforces the multi-layer identity verification model for all registered internal devices. No device is trusted by default — trust must be earned through matching multiple independent hardware and cryptographic identifiers on every connection.

#### 8.2.2 Device Registration Process

Registration is performed by the Network Monitor and captures the following:

| Credential | What It Is | Purpose |
|---|---|---|
| MAC Address | Hardware-level identifier of the device's network interface | Physical device identity |
| Static IP | A fixed IP address assigned to this device within the VPN network | Network address identity |
| Digital Signature | A cryptographic key-pair generated and registered for this device | Cryptographic identity — cannot be spoofed without the private key |

These three form the device's credential set. All three are verified automatically on every VPN connection.

#### 8.2.3 Functional Requirements

**FR-AUTH-001 — Registration by Network Monitor**  
Only a Network Monitor (or Admin) MUST be able to register a new device to a network. End users MUST NOT be able to self-register.

**FR-AUTH-002 — Static IP Assignment**  
The Network Monitor MUST assign a static IP address to the device at registration time. The device MUST receive this IP every time it connects to the VPN.

**FR-AUTH-003 — Digital Signature Generation**  
At registration, the system MUST generate a key pair for the device. The private key MUST be provided to the device securely (e.g., via a one-time secure delivery mechanism). The public key MUST be stored in the system.

**FR-AUTH-004 — Multi-Factor Authentication (MFA)**  
After the device passes the three-credential hardware check, the user MUST complete MFA:
- MFA MUST be Time-Based One-Time Password (TOTP) compatible (e.g., Google Authenticator, Authy).
- MFA MUST be required on every login — there is no "remember this device" bypass.
- MFA MUST be configurable: Admin sets the MFA requirement globally; it cannot be disabled by a Network Monitor or End User.

**FR-AUTH-005 — Authentication Flow**  
```
Device attempts VPN connection
          ↓
System checks: MAC address matches? Static IP matches? Digital Signature matches?
          ↓ (All match)
Device presented with MFA prompt
          ↓ (MFA code correct)
Access Granted — device enters the secure communication channel
          ↓ (Any check fails)
Mismatch alert generated (see FR-IDS-004)
Connection rejected
```

**FR-AUTH-006 — Credential Modification**  
Device credentials MUST only be modifiable by the Network Monitor who manages the device's network. Changes to a device's registered credentials MUST be logged with the Network Monitor's identity and timestamp.

**FR-AUTH-007 — Device Deregistration**  
A Network Monitor MUST be able to deregister a device at any time. Deregistration immediately revokes all privileges and blocks VPN access for that device. Deregistration events MUST be logged.

---

### 8.3 Network Segmentation

#### 8.3.1 Purpose
The internal infrastructure is divided into named logical networks. Each network is isolated by default. Devices in one network cannot communicate with devices in another network unless explicit cross-network rules permit it.

#### 8.3.2 Functional Requirements

**FR-NET-001 — Network Creation**  
Admins MUST be able to create named network segments (e.g., "Finance", "Marketing", "HR", "Engineering"). Each network is an isolated VLAN-equivalent segment.

**FR-NET-002 — Network Isolation**  
By default, devices in Network A MUST NOT be able to communicate with devices in Network B or access resources registered to Network B's scope.

**FR-NET-003 — Network Monitor Assignment**  
Each network MUST have at least one designated Network Monitor. The Admin assigns Network Monitors to networks. A Network Monitor can be assigned to multiple networks simultaneously.

**FR-NET-004 — Cross-Network Rules**  
Only the Admin MUST be able to define cross-network communication rules (permitting specific devices in Network A to access specific resources under Network B's scope).

**FR-NET-005 — Distributed Monitoring**  
The system MUST allow a device within a specific network to be designated as a monitoring node for that network — giving it the ability to register devices and view network-level activity without having full Network Monitor administrative capabilities.

---

### 8.4 Resource Path & Privilege Management

#### 8.4.1 Purpose
Every server resource (file or directory) is explicitly registered. Access is never assumed — it must be granted. Privileges are granular, independent, and can be time-limited.

#### 8.4.2 Privilege Types

| Privilege | What It Permits |
|---|---|
| View | Open and read the resource |
| Create | Create new files or subdirectories within the resource path |
| Edit | Modify existing files within the resource path |
| Delete | Delete files within the resource path |
| Rename | Rename files or directories within the resource path |

Each of the five privileges is granted or denied independently.

#### 8.4.3 Functional Requirements

**FR-PRIV-001 — Resource Path Registration**  
Network Monitors MUST be able to register a server file path or directory as a named resource in the system. Both individual files and entire directory trees MUST be registerable.

**FR-PRIV-002 — Per-Device Privilege Assignment**  
Network Monitors MUST be able to assign any combination of the five privileges to any registered device for any registered resource path. Privilege grants MUST be stored as explicit records in the database.

**FR-PRIV-003 — Group-Level Privilege Assignment**  
Network Monitors MUST be able to assign privileges at the group level. All devices that are members of the group MUST inherit the group's privileges. Individual device privileges MUST stack additively with group privileges (a device in a group with View-only privilege can be given additional Edit privilege individually).

**FR-PRIV-004 — Time-Limited Privileges**  
Every privilege grant MUST support an optional expiry timestamp. When the expiry time is reached, the privilege MUST be automatically revoked without any manual action. The system MUST notify the Network Monitor when time-limited privileges expire.

**FR-PRIV-005 — Privilege Enforcement**  
The system MUST check privileges on every individual operation before execution:
- A device with only View privilege attempting to Edit MUST be rejected.
- A device with no privilege on a resource MUST receive a 403 response and the attempt MUST be logged.
- Privilege checks MUST be performed server-side only — client claims of privilege MUST never be trusted.

**FR-PRIV-006 — Privilege Scope**  
When a directory is registered as a resource path, privileges granted on that path MUST apply recursively to all files and subdirectories within it, unless a more specific sub-path privilege is defined.

---

### 8.5 Encrypted Communication Channel

#### 8.5.1 Purpose
Oh-My-Guard provides a secure interface through which registered devices interact with server resources. All communication through this channel is encrypted end-to-end. This is not a general-purpose file transfer tool — it is a controlled, monitored, privilege-enforced interface.

#### 8.5.2 Functional Requirements

**FR-CHAN-001 — Mandatory Encryption**  
All data transmitted between the device and server through the Oh-My-Guard channel MUST be encrypted. No plaintext communication is permitted.

**FR-CHAN-002 — Supported Operations**  
The channel MUST support the following operations (subject to granted privileges):
- View: Open and display the contents of a registered file.
- Create: Create a new file within a registered directory resource path.
- Edit: Modify the contents of an existing registered file.
- Delete: Delete a registered file.
- Rename: Rename a registered file or directory.
- Send / Transfer: Transmit a file to the server.

**FR-CHAN-003 — Operation Restriction Enforcement**  
If a device's privileges do not include a specific operation, that operation MUST be unavailable in the interface. The interface MUST not expose controls for operations the device is not permitted to perform.

**FR-CHAN-004 — Protocol Restrictions**  
Network Monitor MUST be able to define communication restrictions per network or per device:
- Block download operations (device can view but cannot copy/download files).
- Block file transfer operations (device cannot send files to the server).
- Restrict communication to specific resource paths only.

---

### 8.6 Event Logging & Audit Trail

#### 8.6.1 Purpose
Every interaction between a registered device and any server resource MUST be logged with full forensic detail. Logs MUST be tamper-evident and retained in a form suitable for forensic investigation and compliance.

#### 8.6.2 Event Record Structure

Every logged event MUST contain all of the following fields:

| Field | Description |
|---|---|
| Event ID | Unique identifier for this event record |
| Event Type | The action performed: Viewed, Created, Edited, Deleted, Renamed, Transfer Sent, Transfer Received |
| Status | Severity classification: Normal, Moderate, or Critical |
| Device ID | Identifier of the registered device that performed the action |
| Device Name | Human-readable device name |
| Network | The network segment the device belongs to |
| IP | The current IP of the device at the time of the event (from VPN session) |
| MAC | The current MAC address of the device at the time of the event |
| Digital Signature | The digital signature active for the device at the time of the event |
| Timestamp | Exact UTC date and time of the event to millisecond precision |
| Privileges Active | The set of privileges the device held on this resource at the time of the event |
| Resource Path | The exact file or directory path on the server that was acted upon |
| Resource ID | The registered resource's system ID |
| Outcome | Success or Failure (and reason for failure) |

#### 8.6.3 Functional Requirements

**FR-LOG-001 — Log Every Interaction**  
EVERY operation on a registered resource path — successful or rejected — MUST generate a log event. No interaction may pass without a record.

**FR-LOG-002 — Tamper Evidence**  
Log records MUST be protected against modification after creation. This MUST be achieved through cryptographic signing of log entries (HMAC or similar), with the signing key not accessible to any application-level user.

**FR-LOG-003 — Log Panel Real-Time Display**  
The system MUST provide a real-time Log Panel with the following behaviour:
- Each registered resource is represented as a collapsible row.
- The row's summary display shows the fields of the most recent event for that resource.
- When a new event occurs on a resource, that resource's row MUST float to the top of the Log Panel automatically (ordered by most recent event timestamp).
- Clicking the expand control on a row MUST reveal the full chronological event tree for that resource — every event ever recorded, in time order, with all fields.

**FR-LOG-004 — Log Retention**  
Log records MUST be retained for a minimum configurable period (default: 12 months). Older records MUST be archived, not deleted, unless explicitly purged by a Super Admin.

**FR-LOG-005 — Log Search & Filtering**  
Admins and Network Monitors MUST be able to filter the Log Panel by:
- Device
- Network
- Resource path
- Event type
- Status (Normal / Moderate / Critical)
- Time range

**FR-LOG-006 — SIEM Integration**  
All log events MUST be forwarded to the SIEM in real time for correlation.

---

### 8.7 Session Management

#### 8.7.1 Purpose
Active device sessions are tracked with full timing metadata. Network Monitors can view live sessions and complete session histories for all devices in their network.

#### 8.7.2 Functional Requirements

**FR-SESS-001 — Session Tracking Fields**  
Every session MUST record:
- VPN connection establishment time
- MFA authentication time
- Server communication session start time
- Server communication session end time (or "active" if ongoing)
- IP address used during the session
- Total duration of the communication session

**FR-SESS-002 — Sessions View per Device**  
The Network Monitor MUST be able to view a sessions page for any device in their network showing:
- All currently active sessions (real-time)
- Complete historical session list

**FR-SESS-003 — Concurrent Session Detection**  
If the same device credential set is used to establish two simultaneous VPN sessions from different physical IPs, the system MUST:
- Generate a Critical alert.
- Terminate both sessions.
- Require re-authentication with Admin approval.

**FR-SESS-004 — Session Inactivity Timeout**  
Sessions MUST expire after a configurable inactivity period (default: 30 minutes). Expired sessions MUST require full re-authentication (VPN reconnect + MFA).

---

## 9. Component Functional Requirements — XDR Layer

### 9.1 EDR — Endpoint Detection & Response

#### 9.1.1 Purpose
EDR monitors and responds to suspicious activity at the device and server endpoint level. It watches process behavior, file system changes, and memory events on monitored endpoints.

#### 9.1.2 Functional Requirements

**FR-EDR-001 — Process Monitoring**  
EDR MUST monitor all processes spawned on monitored server instances:
- Detect anomalous child processes spawned by the web application process (e.g., a PHP worker spawning a bash shell).
- Flag any process that matches known post-exploitation tool signatures (netcat, ncat, python reverse shell patterns, wget/curl piped to bash).

**FR-EDR-002 — File System Monitoring**  
EDR MUST implement File Integrity Monitoring (FIM) on all registered resource paths:
- Any change to a registered file that did not originate from the Oh-My-Guard secure channel MUST generate an alert.
- Changes to cron scripts, system binaries, SUID files, and system configuration files MUST trigger immediate alerts.

**FR-EDR-003 — Privilege Escalation Detection**  
EDR MUST detect and alert on:
- Execution of `sudo -l` by the web application process user.
- Execution of `find / -perm -4000` or similar SUID discovery commands.
- Shell command patterns indicating privilege escalation tooling: `whoami`, `id`, `uname -r`, `cat /etc/passwd`.
- Any attempt to write to or modify cron directories: `/etc/cron.d/`, `/var/spool/cron/`.

**FR-EDR-004 — Container / Process Isolation**  
- Web application processes MUST run within isolated, restricted process environments (using OS-level mechanisms such as namespaces, seccomp, AppArmor).
- No-new-privileges flag MUST be applied to all web application worker processes.
- Seccomp profile MUST restrict available syscalls to only those the application legitimately requires.
- AppArmor profile MUST confine the process to its authorized file paths and network targets.

**FR-EDR-005 — Endpoint Quarantine**  
On detection of active compromise (RCE, confirmed privilege escalation, C2 communication), EDR MUST:
- Immediately isolate the affected endpoint from all network communication.
- Capture a forensic memory dump before any remediation.
- Take a disk snapshot of the current state.
- Trigger system rollback to the last known-clean snapshot.
- Generate a Critical alert with the forensic package attached.

**FR-EDR-006 — SIEM Feed**  
All EDR events MUST be forwarded to the SIEM in real time.

---

### 9.2 NDR — Network Detection & Response

#### 9.2.1 Purpose
NDR analyzes all network traffic flows across the entire infrastructure to detect threats that operate at the network level — spanning multiple sessions, time periods, or appearing only in aggregate traffic patterns.

#### 9.2.2 Functional Requirements

**FR-NDR-001 — Full Traffic Flow Analysis**  
NDR MUST capture and analyze metadata for all network flows across all segments: source IP, destination IP, destination port, protocol, bytes transferred, session duration, and packet timing.

**FR-NDR-002 — Behavioral Baseline Modeling**  
NDR MUST establish traffic baselines per device, per network segment, and per service:
- Normal traffic volume over time (hourly, daily, weekly patterns)
- Normal port usage mix per device
- Normal connection destinations per device
- Normal session durations per protocol

Deviations beyond a configurable threshold MUST trigger investigation alerts.

**FR-NDR-003 — Lateral Movement Detection**  
NDR MUST detect and alert on:
- Unusual device-to-device or device-to-server connections within the internal network.
- A device connecting to systems it has never previously contacted.
- Sequential connection attempts across multiple internal hosts (network sweep patterns).

**FR-NDR-004 — C2 Beaconing Detection**  
NDR MUST detect patterns consistent with malware Command & Control communication:
- Periodic outbound connections at regular intervals to external hosts (beaconing).
- DNS tunneling patterns (unusually large DNS query/response payloads, high query rates to unusual domains).
- Connections to domains or IPs on the Threat Intelligence Feed's C2 list.

**FR-NDR-005 — Encrypted Traffic Analysis**  
NDR MUST analyze TLS session metadata (without decrypting content) to detect malicious patterns:
- Unusual certificate issuers
- Connections to domains with recently registered TLS certificates
- Unusual TLS cipher suite negotiation

**FR-NDR-006 — East-West Traffic Monitoring**  
NDR MUST monitor traffic between internal network segments (not just north-south internet traffic). Unauthorized cross-network communication MUST trigger alerts.

**FR-NDR-007 — DDoS Pattern Detection**  
NDR MUST detect volumetric attack patterns (traffic volume spikes, SYN floods, UDP floods) and trigger IPS mitigation automatically.

**FR-NDR-008 — SIEM Feed**  
All NDR events and flow records MUST be forwarded to the SIEM in real time.

---

### 9.3 SIEM — Security Information & Event Management

#### 9.3.1 Purpose
The SIEM is the central intelligence and correlation engine. Every component in Oh-My-Guard feeds events into the SIEM. The SIEM's job is to connect events across components and time to identify attack campaigns that no individual component could detect alone.

#### 9.3.2 Log Sources

The SIEM MUST collect events from:
- External Firewall
- IDS (External and all Internal)
- IPS (External and all Internal)
- WAF
- Honeypot Engine (all honeypot types)
- File Upload Security pipeline
- Authentication system (VPN connection attempts, MFA events, login failures)
- EDR
- NDR
- Resource access audit log (all device-resource interactions)
- Threat Intelligence Feed (IOC matches)

#### 9.3.3 Functional Requirements

**FR-SIEM-001 — Centralized Event Collection**  
The SIEM MUST accept real-time event streams from all listed log sources. No events MAY be dropped due to volume. A queuing mechanism MUST be used to handle burst event loads without data loss.

**FR-SIEM-002 — Real-Time Correlation Engine**  
The SIEM MUST apply correlation rules to detect attack sequences spanning multiple components. Minimum required correlation rules:

| Rule ID | Pattern | Classification |
|---|---|---|
| CORR-001 | Port scan (IDS) + directory enumeration (WAF) from same IP within 10 minutes | Reconnaissance campaign |
| CORR-002 | CORR-001 + login failure spike (Auth) | Targeted attack — active phase |
| CORR-003 | CORR-002 + web shell upload attempt (WAF) | Active exploitation attempt |
| CORR-004 | CORR-003 + anomalous process spawn (EDR) | Post-exploitation activity |
| CORR-005 | CORR-004 + internal lateral movement (NDR) | Full kill chain — Critical incident |
| CORR-006 | Device credential mismatch (IDS) + unusual resource access (Audit Log) | Insider threat — compromised device |
| CORR-007 | C2 beaconing (NDR) + process spawned by web app (EDR) | Active malware infection |
| CORR-008 | Honeypot account access (HP) from any source | Immediate Critical alert |

**FR-SIEM-003 — Alert Prioritization**  
SIEM alerts MUST be classified into three severity levels:
- **Normal** — Informational. Low probability of active attack. Logged but may not require immediate action.
- **Moderate** — Suspicious. Possible attack in progress. Network Monitor or Admin should review within a defined SLA.
- **Critical** — Active attack confirmed or high-confidence threat. Requires immediate action. Automated responses triggered.

**FR-SIEM-004 — Role-Aware Alert Routing**  
Alerts MUST be routed to the appropriate role:
- Alerts related to internet-facing traffic → Admin
- Alerts related to a specific internal network → Network Monitor for that network
- Critical alerts not acknowledged within SLA → Escalated to Admin, then to Super Admin

**FR-SIEM-005 — Threat Hunting**  
Admins and Super Admins MUST be able to query the SIEM's full historical event database to investigate potential incidents retroactively. Query filters MUST include: IP, device, time range, event type, component source, severity.

**FR-SIEM-006 — Forensic Audit Trail**  
The SIEM MUST maintain an immutable, tamper-evident archive of all events received. Events in the SIEM MUST be cryptographically signed and stored such that any modification to a historical record is detectable.

**FR-SIEM-007 — Attack Timeline Reconstruction**  
For any incident, the SIEM MUST be able to generate a chronological timeline showing every event across every component that is attributable to the same attacker, device, or IP — reconstructing the full kill chain.

---

### 9.4 Threat Intelligence Feed

#### 9.4.1 Purpose
The Threat Intelligence Feed continuously supplies Oh-My-Guard with up-to-date information about known-bad entities and attack patterns, enabling proactive blocking before attacks begin.

#### 9.4.2 Functional Requirements

**FR-INTEL-001 — Automatic Signature Updates**  
IDS and WAF signature libraries MUST be automatically updated from the threat feed when new attack patterns are published. Updates MUST NOT require a system restart.

**FR-INTEL-002 — IP Reputation Integration**  
The feed MUST provide a continuously updated list of known malicious IPs, Tor exit nodes, botnet IPs, and scanner IPs. These MUST be automatically applied as block rules at the Firewall level.

**FR-INTEL-003 — CVE Awareness**  
The feed MUST monitor for CVEs affecting the software versions in use by the Oh-My-Guard-protected server. When a relevant CVE is published, the Admin MUST receive an alert specifying: CVE ID, affected software, severity score (CVSS), and recommended remediation.

**FR-INTEL-004 — IOC Matching**  
The feed MUST provide Indicators of Compromise (IOCs) including: malicious file hashes, known C2 domain lists, known phishing URLs, and attacker infrastructure IP ranges. These MUST be matched in real time against: all file uploads (hash comparison), all outbound DNS queries, all outbound connection destinations.

**FR-INTEL-005 — Breach Credential Database**  
On every login attempt, the submitted password MUST be checked against a known-breached credential database (HaveIBeenPwned API or equivalent local database). If the submitted password appears in a known breach, the login attempt MUST be flagged and the user MUST be required to change their password before proceeding.

**FR-INTEL-006 — Geographic Intelligence**  
The feed MUST provide geographic IP data. Login attempts from a geographic location significantly different from the device's historically observed locations MUST trigger additional verification or an alert.

**FR-INTEL-007 — SIEM Enrichment**  
Every SIEM event that involves an IP address, domain, or file hash MUST be enriched with available Threat Intelligence context before being presented to the analyst.

---

### 9.5 XDR Orchestration Engine

#### 9.5.1 Purpose
XDR is the emergent capability that arises from the integration of EDR, NDR, SIEM, and Threat Intelligence. The XDR Orchestration Engine translates SIEM correlation findings into coordinated multi-component automated responses.

#### 9.5.2 Functional Requirements

**FR-XDR-001 — Coordinated Response Playbooks**  
The system MUST support configurable automated response playbooks. Minimum required playbooks:

| Trigger | Automated Response Actions |
|---|---|
| Full kill chain confirmed (CORR-005) | 1. IPS permanently bans attacker IP at Firewall. 2. EDR quarantines affected server segment. 3. Forensic memory and disk capture initiated. 4. System rollback triggered. 5. All honeypot sessions from this IP terminated. 6. Admin receives Critical incident report with full attack timeline. |
| RCE detected (EDR) | 1. EDR isolates server from internal network. 2. Forensic capture initiated. 3. System rollback triggered. 4. Admin Critical alert. |
| C2 beaconing detected (NDR) | 1. IPS blocks all outbound traffic to the C2 destination. 2. EDR initiates endpoint investigation. 3. SIEM generates incident report. 4. Admin alert. |
| Honeypot account accessed (HP) | 1. Immediate Critical alert. 2. Full session capture. 3. IP banned. |
| Compromised device detected (IDS + Auth) | 1. Network Monitor alert. 2. VPN session for that device terminated. 3. Device flagged for review. |

**FR-XDR-002 — Cross-Layer Visibility**  
XDR MUST provide a unified view showing all events from EDR, NDR, and SIEM related to a single incident in one timeline — regardless of which component detected each event.

**FR-XDR-003 — Response Latency**  
Automated XDR response playbooks MUST execute within 500ms of the triggering SIEM correlation rule firing.

---

## 10. External Attack Coverage — 32 Attack Types

Oh-My-Guard MUST provide specific, documented detection and response for all 32 attack types across 6 categories:

### Category 1: Reconnaissance
| # | Attack | Detection Method | Response |
|---|---|---|---|
| 1 | Port Scanning (Nmap/Masscan) | SYN packet burst pattern across multiple ports | Honeypot activation, OS fingerprint spoofing, port silencing, IP flagging |
| 2 | Banner Grabbing | Connection to service ports; banner request patterns | Banner falsification, header stripping |
| 3 | Directory & File Enumeration (Gobuster/ffuf) | High-frequency 404 responses; known wordlist path patterns | Honeypot directories, rate limiting (1 req/5s after 20 rapid 404s), IP ban after 50 probes, fake file serving |
| 4 | DNS Enumeration / Subdomain Discovery | Excessive DNS query volume to the target domain | Honeypot subdomains, DNS rate limiting, DNS query logging |
| 5 | OSINT / Metadata Harvesting | File download patterns; access to publicly served documents | Metadata stripping, fake metadata injection |

### Category 2: Web Application Attacks
| # | Attack | Detection Method | Response |
|---|---|---|---|
| 6 | Malicious File Upload (Web Shell) | Magic byte mismatch; AV signature match; executable MIME in upload | File rejection, sandboxed analysis, noexec enforcement, honeypot shell routing, admin alert |
| 7 | MIME Type Bypass / Double Extension | Extension + MIME type mismatch; null byte in filename | Strict allowlist enforcement, UUID rename, null byte rejection |
| 8 | SQL Injection | SQLi pattern match in WAF (UNION, DROP, OR '1'='1', etc.) | Block + fake DB response, parameterized queries, IP escalation |
| 9 | Blind SQL Injection | Time-based response delays; boolean-based alternating patterns | Response time normalization (uniform artificial delay), WAF deep inspection |
| 10 | Cross-Site Scripting (XSS) | Script injection pattern detection in inputs | Input sanitization, CSP enforcement, HttpOnly cookies, WAF blocking |
| 11 | XML External Entity (XXE) | External entity references in uploaded XML | Entity disabled, schema validation, fake /etc/passwd response |
| 12 | SSRF | Internal IP ranges in request parameters; metadata endpoint URLs | URL allowlist, internal range blocking, cloud metadata permanent blacklist, SSRF honeypot |
| 13 | IDOR | Sequential or guessable resource IDs in requests | UUID-based IDs, ownership check on every resource access, honeypot records |
| 14 | Path Traversal / Directory Traversal | `../` sequences in filenames and URL parameters | Path canonicalization, traversal stripping, chroot jail, fake system file response |
| 15 | Business Logic Abuse | Field-level policy violations; anomalous edit patterns | Field-level authorization, change audit log, anomaly detection, version control |

### Category 3: Authentication & Session Attacks
| # | Attack | Detection Method | Response |
|---|---|---|---|
| 16 | Brute Force Login | High-frequency login failures from same IP to same account | Progressive lockout (5 failures = locked), rate limiting (3/30s per IP), CAPTCHA after 3, honeypot panel after 10 |
| 17 | Credential Stuffing | Login velocity + geographic anomaly; distributed pattern | Behavioral analysis, HaveIBeenPwned check, bot detection, honeypot credentials, forced MFA |
| 18 | Session Hijacking | IP/User-Agent/fingerprint mismatch mid-session; concurrent sessions from different IPs | Session binding, short inactivity timeout, token rotation, secure/httponly/samesite cookies, concurrent session alert |
| 19 | JWT Manipulation | alg:none in token header; signature verification failure; role escalation in payload | alg:none rejection, RS256 enforcement, signature verification, token anomaly logging |

### Category 4: Post-Exploitation / Server-Side Attacks
| # | Attack | Detection Method | Response |
|---|---|---|---|
| 20 | Remote Code Execution (RCE) via File Upload | Anomalous process spawned by web app process | Network isolation, process containment (seccomp/namespace), immediate alert, forensic capture, snapshot rollback |
| 21 | Server-Side Template Injection (SSTI) | Template expression patterns `{{`, `${`, `<%` in user inputs | Template expression stripping, sandbox mode, fake template output, immediate alert |
| 22 | Insecure Deserialization | Pickle/Java serialized object format detected in upload or API payload | Format blocking, safe library enforcement, sandboxed deserialization |
| 23 | Command Injection | Shell special characters in filenames or parameters | Shell character stripping, no-shell subprocess execution, alert |
| 24 | CSV / XML Formula Injection | Formula prefix characters at start of CSV cells | Cell prefix sanitization (apostrophe), admin warning |

### Category 5: Network & Infrastructure Attacks
| # | Attack | Detection Method | Response |
|---|---|---|---|
| 25 | DDoS on Upload Endpoint | Traffic volume threshold exceeded; massive upload requests | File size cap, upload rate limiting, CDN absorption, blackhole routing |
| 26 | Man-in-the-Middle (MITM) | HTTP connections detected; ARP spoofing anomalies | TLS 1.3 enforcement, HSTS, certificate pinning, ARP monitoring |
| 27 | DNS Hijacking / Cache Poisoning | Unexpected DNS record change detected | DNSSEC, certificate pinning (mismatch prevents connection even if DNS redirected), DNS record change monitoring |

### Category 6: Privilege Escalation
| # | Attack | Detection Method | Response |
|---|---|---|---|
| 28 | Vertical Privilege Escalation (Broken Access Control) | Access to admin endpoints by non-admin session; role modification in request body | Server-side role enforcement, fake admin panel honeypot, account freeze on attempt, immediate alert |
| 29 | Horizontal Privilege Escalation | Cross-account resource access; IDOR exploitation to access another user's resources | Ownership check (`owner_id == session_user_id`) on every resource access, honeypot user accounts, full cross-account access logging |
| 30 | Kernel / OS Privilege Escalation (Post-RCE) | Anomalous syscalls; kernel exploit patterns (Dirty COW, DirtyPipe signatures) | Process isolation (seccomp/AppArmor), no-new-privileges, automated patch monitoring alerts, network quarantine on detection |
| 31 | SUID Binary Abuse | Execution of SUID binaries by web application process user | Regular SUID audit (remove non-essential SUID bits), fake SUID honeypot binaries, zero sudo rights for web app user, `find -perm -4000` detection |
| 32 | Cron Job / Scheduled Task Hijacking | Modification to cron script files (FIM alert) | FIM monitoring on all cron paths, root-owned non-writable cron scripts, immediate alert on modification |

---

## 11. UI / UX Requirements

### 11.1 Overall Dashboard

**FR-UI-001 — Role-Aware Interface**  
The dashboard MUST present different views and controls based on the authenticated user's role. A Network Monitor MUST only see their assigned networks. An Admin MUST see all networks plus external controls.

**FR-UI-002 — Real-Time Updates**  
All data displayed on the dashboard (alerts, log panel, active sessions, live traffic indicators) MUST update in real time without requiring a page refresh. WebSocket or Server-Sent Events MUST be used for live data delivery.

**FR-UI-003 — Alert Panel**  
A persistent alert panel MUST be visible on all pages. It MUST display:
- Active unacknowledged alerts ordered by severity (Critical first)
- Alert count by severity
- Quick-acknowledge and quick-action buttons per alert

---

### 11.2 Log Panel

**FR-UI-004 — Log Panel Behavior**  
- Displays one row per registered resource.
- Each row shows the most recent event's fields: Event Type, Status, Device, Timestamp.
- Resources with the most recent events float to the top automatically.
- Clicking an expand control on a row reveals the complete chronological event tree for that resource.
- The full event tree shows all fields for every historical event on that resource.
- Status is visually distinguished: Normal (neutral), Moderate (amber/yellow), Critical (red).
- The Log Panel MUST support filtering by: Network, Device, Resource, Event Type, Status, Time Range.

---

### 11.3 Network Management Page (Network Monitor View)

**FR-UI-005 — Device Registry**  
Displays all registered devices for the Network Monitor's assigned network(s). For each device:
- **Details button** → Shows: registered MAC address, static IP, digital signature, registration date, registration performed by.
- **Activities button** → Shows: complete chronological log of all server interactions for this device.
- **Privileges button** → Shows all resource paths the device has privileges on, with privilege types listed. Provides controls to add new resource path privilege assignments, set expiry times, and revoke existing privileges.
- **Sessions button** → Shows all current active sessions and complete historical session list with all timing fields.
- **Remove button** → Deregisters the device with confirmation dialog.

**FR-UI-006 — Group Management**  
A Groups section within the Network Management page MUST allow:
- Creating a new group (name + optional description).
- Adding/removing devices from groups.
- Viewing group-level privileges.
- Setting group-level privileges on resource paths.
- Setting group-level firewall rules.

**FR-UI-007 — Firewall Rules Page (Network Monitor)**  
- Displays all currently active firewall rules for the network.
- Provides controls to: add a new rule (source, destination, port, protocol, action, priority), edit existing rules, enable/disable rules, and delete rules.
- Rules can be scoped to: Network, Group, or Individual Device.

---

### 11.4 Admin Panel

**FR-UI-008 — External Firewall Management**  
Full CRUD interface for external Firewall rules with all required fields as specified in FR-FW-002.

**FR-UI-009 — Honeypot Configuration**  
Interface to configure:
- Which fake services to activate on which ports.
- Fake OS fingerprint to advertise.
- Which paths to deploy as honeypot directories.
- Fake subdomain honeypot configurations.

**FR-UI-010 — Network Monitor Management**  
Create, edit, deactivate, and reassign Network Monitor accounts.

**FR-UI-011 — System-Wide SIEM Dashboard**  
A consolidated view showing:
- All active alerts across all networks and all layers.
- Real-time event feed from all components.
- Attack timeline view for active incidents.
- Threat Intelligence Feed status (last update, current IOC count, active block rules).

**FR-UI-012 — Threat Intelligence Feed Status**  
Dashboard widget showing: last feed update timestamp, count of currently blocked IPs, count of active CVE alerts, count of active IOC match rules.

---

### 11.5 Super Admin Panel

**FR-UI-013 — Global Settings**  
Configure: mandatory encryption standard, VPN policy parameters, MFA enforcement toggle, global session timeout, SLA windows for alert acknowledgment by role.

**FR-UI-014 — Admin Account Management**  
Full CRUD for Admin accounts.

**FR-UI-015 — Full System Audit Log**  
Read-only access to the complete SIEM event archive across all components, all networks, and all time.

---

## 12. Data Models

### 12.1 Core Entities

#### Networks
```
Network {
  id: UUID (PK)
  name: String (e.g., "Finance", "Marketing")
  description: String
  created_by: UUID → User.id (Admin)
  created_at: Timestamp
  status: Enum (Active, Suspended)
}
```

#### Devices
```
Device {
  id: UUID (PK)
  network_id: UUID → Network.id
  name: String
  mac_address: String (registered MAC)
  static_ip: String (assigned static IP within VPN)
  public_key: Text (registered digital signature / public key)
  registered_by: UUID → User.id (Network Monitor)
  registered_at: Timestamp
  status: Enum (Active, Suspended, Removed)
}
```

#### Users (Human operators)
```
User {
  id: UUID (PK)
  username: String
  password_hash: String (bcrypt or Argon2)
  totp_secret: String (encrypted at rest)
  role: Enum (SuperAdmin, Admin, NetworkMonitor)
  assigned_networks: UUID[] → Network.id[]  (for NetworkMonitor role)
  created_by: UUID → User.id
  created_at: Timestamp
  last_login: Timestamp
  status: Enum (Active, Suspended)
}
```

#### Resource Paths
```
ResourcePath {
  id: UUID (PK)
  network_id: UUID → Network.id
  label: String (human-readable name)
  server_path: String (absolute path on server)
  type: Enum (File, Directory)
  registered_by: UUID → User.id
  registered_at: Timestamp
}
```

#### Privilege Grants
```
PrivilegeGrant {
  id: UUID (PK)
  grantee_type: Enum (Device, Group)
  grantee_id: UUID → Device.id OR Group.id
  resource_path_id: UUID → ResourcePath.id
  can_view: Boolean
  can_create: Boolean
  can_edit: Boolean
  can_delete: Boolean
  can_rename: Boolean
  granted_by: UUID → User.id
  granted_at: Timestamp
  expires_at: Timestamp (nullable — null = permanent)
  revoked_at: Timestamp (nullable)
  status: Enum (Active, Expired, Revoked)
}
```

#### Groups
```
Group {
  id: UUID (PK)
  network_id: UUID → Network.id
  name: String
  created_by: UUID → User.id
  created_at: Timestamp
}

GroupMembership {
  group_id: UUID → Group.id
  device_id: UUID → Device.id
  added_by: UUID → User.id
  added_at: Timestamp
}
```

#### Sessions
```
Session {
  id: UUID (PK)
  device_id: UUID → Device.id
  vpn_connect_time: Timestamp
  mfa_auth_time: Timestamp
  comm_start_time: Timestamp
  comm_end_time: Timestamp (nullable — null if active)
  ip_used: String
  status: Enum (Active, Ended, TerminatedBySystem, TerminatedByMonitor)
}
```

#### Audit Log Events
```
AuditEvent {
  id: UUID (PK)
  event_type: Enum (Viewed, Created, Edited, Deleted, Renamed, TransferSent, TransferReceived)
  status: Enum (Normal, Moderate, Critical)
  device_id: UUID → Device.id
  network_id: UUID → Network.id
  session_id: UUID → Session.id
  resource_path_id: UUID → ResourcePath.id
  ip_at_event: String
  mac_at_event: String
  signature_at_event: String
  privileges_at_event: JSON
  outcome: Enum (Success, Rejected)
  rejection_reason: String (nullable)
  timestamp: Timestamp
  hmac_signature: String (tamper-evident signing of this record)
}
```

#### Security Events (SIEM)
```
SecurityEvent {
  id: UUID (PK)
  source_component: Enum (Firewall, IDS, IPS, WAF, EDR, NDR, Honeypot, AuthSystem, ThreatIntel)
  event_category: String
  event_type: String
  severity: Enum (Normal, Moderate, Critical)
  source_ip: String (nullable)
  destination_ip: String (nullable)
  destination_port: Integer (nullable)
  device_id: UUID (nullable, if related to an internal device)
  network_id: UUID (nullable, if related to an internal network)
  raw_payload: JSON (full event context)
  threat_intel_context: JSON (nullable — enrichment from feed)
  timestamp: Timestamp
  correlation_incident_id: UUID (nullable — links to an Incident if correlated)
  hmac_signature: String
}
```

#### Incidents (SIEM Correlation Outputs)
```
Incident {
  id: UUID (PK)
  title: String
  classification: String (from correlation rule)
  severity: Enum (Normal, Moderate, Critical)
  status: Enum (Open, Investigating, Resolved, FalsePositive)
  triggered_by_rule: String (correlation rule ID)
  related_events: UUID[] → SecurityEvent.id[]
  assigned_to: UUID → User.id (nullable)
  created_at: Timestamp
  resolved_at: Timestamp (nullable)
  resolution_notes: String (nullable)
}
```

#### Firewall Rules
```
FirewallRule {
  id: UUID (PK)
  scope_type: Enum (External, Network, Group, Device)
  scope_id: UUID (nullable — references Network.id, Group.id, or Device.id)
  source_ip_range: String (CIDR or specific IP, nullable = any)
  destination_ip_range: String (nullable = any)
  destination_port_range: String (e.g., "80", "1024-65535", nullable = any)
  protocol: Enum (TCP, UDP, ICMP, All)
  action: Enum (Allow, Deny)
  priority: Integer (lower = higher priority)
  description: String
  is_auto_generated: Boolean (true if created by IPS/IDS auto-block)
  is_enabled: Boolean
  created_by: UUID → User.id
  created_at: Timestamp
}
```

---

## 13. API Requirements

### 13.1 API Design Principles

- All API endpoints MUST require authentication (JWT bearer token) except the login endpoint.
- All API responses MUST use standard HTTP status codes.
- All API endpoints MUST enforce role-based access control server-side.
- All API request bodies MUST be validated against JSON schemas before processing.
- All API endpoints MUST be rate-limited.
- The API MUST be versioned (e.g., `/api/v1/`).
- All API errors MUST return a consistent error envelope: `{ "error": { "code": "...", "message": "..." } }`.

### 13.2 Core API Groups

**Authentication**
- `POST /api/v1/auth/login` — Initiate login (returns MFA challenge)
- `POST /api/v1/auth/mfa/verify` — Submit TOTP code, receive JWT
- `POST /api/v1/auth/logout` — Invalidate session token

**Networks (Admin+)**
- `GET /api/v1/networks` — List all networks
- `POST /api/v1/networks` — Create a new network
- `GET /api/v1/networks/:id` — Get network details
- `PATCH /api/v1/networks/:id` — Update network
- `DELETE /api/v1/networks/:id` — Deactivate network

**Devices (Network Monitor+)**
- `GET /api/v1/networks/:networkId/devices` — List devices in a network
- `POST /api/v1/networks/:networkId/devices` — Register a new device
- `GET /api/v1/networks/:networkId/devices/:id` — Get device details
- `GET /api/v1/networks/:networkId/devices/:id/activities` — Get device activity history
- `GET /api/v1/networks/:networkId/devices/:id/sessions` — Get device sessions
- `GET /api/v1/networks/:networkId/devices/:id/privileges` — Get device privileges
- `DELETE /api/v1/networks/:networkId/devices/:id` — Deregister device

**Privileges (Network Monitor+)**
- `POST /api/v1/privileges` — Grant a privilege (device or group + resource path + privilege set + optional expiry)
- `PATCH /api/v1/privileges/:id` — Update privilege (change privilege set or expiry)
- `DELETE /api/v1/privileges/:id` — Revoke privilege

**Resource Paths (Network Monitor+)**
- `GET /api/v1/resource-paths` — List registered resource paths
- `POST /api/v1/resource-paths` — Register a new resource path
- `DELETE /api/v1/resource-paths/:id` — Unregister a resource path

**Groups (Network Monitor+)**
- `GET /api/v1/networks/:networkId/groups` — List groups in a network
- `POST /api/v1/networks/:networkId/groups` — Create a group
- `POST /api/v1/networks/:networkId/groups/:id/members` — Add device to group
- `DELETE /api/v1/networks/:networkId/groups/:id/members/:deviceId` — Remove device from group

**Firewall Rules (Admin+ for external; Network Monitor+ for internal)**
- `GET /api/v1/firewall/rules` — List rules (scoped by role)
- `POST /api/v1/firewall/rules` — Create a rule
- `PATCH /api/v1/firewall/rules/:id` — Update a rule
- `DELETE /api/v1/firewall/rules/:id` — Delete a rule

**Audit Log (role-scoped)**
- `GET /api/v1/audit/events` — Query audit events (role-scoped; supports all filter parameters)

**SIEM / Security Events (Admin+)**
- `GET /api/v1/siem/events` — Query security events
- `GET /api/v1/siem/incidents` — List incidents
- `GET /api/v1/siem/incidents/:id` — Get incident details + full event timeline
- `PATCH /api/v1/siem/incidents/:id` — Update incident status/assignment

**Alerts (role-scoped)**
- `GET /api/v1/alerts` — Get active alerts (role-scoped)
- `POST /api/v1/alerts/:id/acknowledge` — Acknowledge an alert
- `GET /api/v1/alerts/count` — Get alert counts by severity (for dashboard badge)

**Users (Admin+ for Network Monitors; Super Admin for Admins)**
- `GET /api/v1/users` — List users
- `POST /api/v1/users` — Create user
- `PATCH /api/v1/users/:id` — Update user
- `DELETE /api/v1/users/:id` — Deactivate user

---

## 14. Alert & Notification System

### 14.1 Alert Severity Definitions

| Severity | Definition | Example Triggers |
|---|---|---|
| **Normal** | Informational. Low probability of active attack. Logged for awareness. | Single failed login, low-volume 404 rate, single banner grab attempt |
| **Moderate** | Suspicious. Possible attack in progress. Should be reviewed. | Repeated failed logins from same IP, multiple 404s from same IP, credential stuffing pattern at low confidence |
| **Critical** | Active attack confirmed or high-confidence threat. Immediate action required. Automated responses triggered. | Port scan + enumeration from same IP, web shell upload attempt, privilege escalation attempt, honeypot account access, RCE detection, C2 beaconing |

### 14.2 Alert Routing

- External threat alerts → Admin
- Internal network alerts → Network Monitor assigned to that network
- Critical alerts not acknowledged within SLA (configurable, default: 15 minutes) → Escalated to Admin
- Admin-level Critical alerts not acknowledged within SLA → Escalated to Super Admin
- Alerts related to platform-wide security policy violations → Super Admin directly

### 14.3 Alert Content

Every alert MUST contain:
- Alert ID
- Timestamp
- Severity
- Affected component
- Attack category and specific attack type
- Source IP (if external)
- Affected device and network (if internal)
- Raw evidence (request payload, packet data, matched signature)
- Recommended response action(s)
- Quick-action buttons (Acknowledge, Block IP, Quarantine Device, View Full Detail)

### 14.4 Alert Delivery Channels

- **In-app dashboard panel** — Always. Real-time push to all authenticated sessions of the target role.
- **Email** — Configurable per-user. Critical alerts MUST be delivered regardless of email preference.
- **Webhook** — Configurable outbound webhook for integration with external notification systems (Slack, PagerDuty, etc.).

---

## 15. Non-Functional Requirements

### 15.1 Performance

| Metric | Requirement |
|---|---|
| Dashboard page load (initial) | < 2 seconds |
| Log Panel real-time event delivery latency | < 500ms from event to display |
| IPS inline block decision | < 50ms |
| WAF request inspection | < 100ms added latency per request |
| SIEM event ingestion throughput | Minimum 10,000 events/second |
| XDR automated playbook execution | < 500ms from SIEM correlation trigger to first action |
| API response time (95th percentile) | < 300ms |

### 15.2 Security Requirements

| Requirement | Specification |
|---|---|
| Password storage | Argon2id hashing with per-user salt. Minimum 12 characters enforced. |
| Session tokens | JWT signed with RS256. Expiry: 30 minutes (configurable). |
| MFA | TOTP (RFC 6238). Required for all human users without exception. |
| Database at rest | AES-256 encryption for all PII and credential fields. |
| Transport encryption | TLS 1.3 minimum for all HTTP traffic. TLS 1.2 and below rejected. |
| Log integrity | HMAC-SHA256 signature on every log record using a key not accessible to application code. |
| API rate limiting | Authentication endpoints: 10 requests/minute per IP. All other endpoints: 100 requests/minute per authenticated user. |
| SUID | All unnecessary SUID bits removed from server filesystem. Remaining SUID binaries audited regularly. |
| Kernel hardening | Seccomp and AppArmor profiles applied to all application processes. |
| No Docker | All services run bare-metal. No container runtime of any kind in the production stack. |

### 15.3 Reliability

- System uptime target: 99.9% (excluding planned maintenance windows).
- Log storage: No log events may be lost. A persistent queue must absorb burst load.
- Alert delivery: Critical alerts MUST be delivered within 5 seconds of generation.

### 15.4 Scalability

- The system MUST support at minimum: 50 registered networks, 1,000 registered devices, 10 network monitors.
- The audit log and SIEM event store MUST support storage of at least 100 million events.
- The architecture MUST be horizontally scalable at the API server tier.

### 15.5 Auditability

- Every action performed by any human user within the Oh-My-Guard dashboard (not just device actions) MUST be logged: who, what, when.
- This includes: rule changes, privilege modifications, device registrations, alert acknowledgments, and all admin actions.

---

## 16. Technology Stack

> **ABSOLUTE CONSTRAINT: Docker is strictly prohibited anywhere in the stack. All services run bare-metal.**

### 16.1 Frontend

| Component | Technology |
|---|---|
| Framework | React 19 (Vite build toolchain) |
| Language | TypeScript |
| State Management | React Context + hooks (or Zustand for global state) |
| Real-Time Updates | WebSocket (native browser API or socket.io-client) |
| HTTP Client | Axios or native fetch |
| Routing | React Router v7 |

### 16.2 Backend — API Server

| Component | Technology |
|---|---|
| Framework | Express 5 |
| Language | TypeScript (Node.js 20+) |
| ORM | Drizzle ORM |
| Database | PostgreSQL (bare-metal, systemd service) |
| Auth | JWT (jose library), TOTP (otplib) |
| Validation | Zod |
| Real-Time | ws (WebSocket server) or socket.io |
| File Scanning | ClamAV (via clamdscan CLI / node-clamscan) |

### 16.3 Backend — Security Engine

| Component | Technology |
|---|---|
| Framework | Python / FastAPI |
| Runtime | Python 3.11+ (bare-metal, systemd service) |
| Traffic Analysis | Scapy (packet inspection), pyshark |
| File Analysis | python-magic (magic byte detection), exiftool (metadata) |
| Cryptography | cryptography (PyCA), hashlib (SHA-256, HMAC) |
| IDS/IPS Engine | Custom rule engine built on pyshark + signature library |
| SIEM Event Bus | PostgreSQL LISTEN/NOTIFY or Redis pub/sub (bare-metal) |
| FIM | watchdog (Python file system events library) |

### 16.4 Infrastructure

| Component | Technology |
|---|---|
| Database | PostgreSQL (bare-metal) |
| Cache / Queue | Redis (bare-metal, systemd service) |
| VPN | WireGuard or OpenVPN (bare-metal) |
| Antivirus | ClamAV (bare-metal daemon, `clamd`) |
| Process Management | systemd (all services managed as systemd units) |
| Reverse Proxy | Nginx (bare-metal) — TLS termination, rate limiting, header sanitization |

### 16.5 Cryptography Standards

| Purpose | Standard |
|---|---|
| JWT Signing | RS256 (RSA-PKCS1v1.5 with SHA-256, 2048-bit minimum key) |
| Password Hashing | Argon2id |
| Log Record Signing | HMAC-SHA256 |
| File Hashing | SHA-256 |
| VPN Encryption | AES-256-GCM (WireGuard default) |
| Digital Signatures (device) | RSA-2048 or Ed25519 key pairs |
| Transport | TLS 1.3 |

---

## 17. Complete Live Scenario — End-to-End System Behaviour

**Setup:**  
A company hosts a web application on a server protected by Oh-My-Guard. The application allows authenticated users to upload records as files and edit them. An external attacker's goal is to break in and achieve root-level privilege escalation on the server.

The internal network has 12 registered devices in the "Finance" segment, managed by a Network Monitor.

---

### Stage 1: Reconnaissance — Attacker Scans the Server

**Attacker Action:** Runs `nmap -sV -O -A -p- 192.168.1.100` and `gobuster dir -u https://target.com -w biglist.txt`.

**Layer 1 — Firewall:**
- Detects rapid SYN packet bursts across multiple ports.
- Source IP `203.0.113.45` tagged as hostile. All further requests from this IP subjected to maximum scrutiny.

**Layer 1 — IDS:**
- SYN flood pattern matched against port scan signature in Threat Intelligence database.
- Alert generated: "Port scan reconnaissance detected from IP 203.0.113.45."
- Alert delivered to Admin dashboard immediately.

**Layer 1 — IPS:**
- Real service ports enter stealth mode — no response to probe packets (ports appear closed/filtered to attacker).
- Honeypot Engine activated: fake SSH on port 22, fake database on port 3306, fake admin panel on port 8080 — all visible to the attacker.
- OS fingerprint spoofing enabled — system reports a fake OS to the attacker's `-O` scan.

**Layer 2 — WAF:**
- Gobuster rapid 404 pattern detected: 22 rapid 404 responses in 8 seconds from same IP.
- Rate limiting applied: IP throttled to 1 request per 5 seconds.
- After 50 probes: IP auto-banned at Firewall level.
- Honeypot directories activated: `/admin`, `/backup`, `/config` serve fake content and log every probe.

**Layer 5 — SIEM + Threat Intelligence:**
- Threat Intelligence Feed confirms `203.0.113.45` appears in known malicious scanner IP list.
- SIEM logs full event package: attacker IP, timestamp, scan type, every port probed, every path probed.
- Admin receives Critical alert on dashboard: "Active reconnaissance from IP 203.0.113.45 — matched known malicious scanner."

**Result:** Attacker sees only honeypot services. Real services are completely invisible. No useful information was obtained. Attacker IP is now permanently flagged.

---

### Stage 2: Web Application Attack — SQL Injection Attempt

**Attacker Action:** Interacts with the honeypot admin panel, finds a search field, and submits `' UNION SELECT username, password FROM admin_users --`.

**Layer 2 — WAF:**
- UNION SELECT pattern matched instantly.
- Request blocked before reaching the database — the database never sees this query.
- Instead of an error (which would confirm the vulnerability), the WAF returns a convincing fabricated dataset: fake user records with traceable bogus data.
- Attacker believes the injection worked and extracted real data. They received nothing real.
- Exact injection payload logged with attacker IP, target endpoint, timestamp.

**Layer 1 — IDS/IPS:**
- SQLi attempt logged.
- Attacker IP tier escalated from "hostile" to "critical".
- Admin alert: "SQL injection attempt from 203.0.113.45 — exact payload logged."

**Layer 5 — SIEM:**
- Correlation: same IP performed reconnaissance (Stage 1) + SQLi (Stage 2) = CORR-002 — Targeted attack in active phase.
- NDR begins deep traffic inspection for all traffic from this IP across all protocols.
- XDR Engine armed: playbook CORR-003 conditions now being monitored (awaiting web shell upload attempt).

**Result:** Database untouched. Attacker believes they have data but received fabricated records. Under maximum surveillance.

---

### Stage 3: Malicious File Upload — Web Shell Attempt

**Attacker Action:** Attempts to upload `shell.php` renamed to `image.jpg` with Content-Type: image/jpeg. Also attempts `shell.php.jpg` and `shell.pHp%00.jpg`.

**Layer 2 — WAF / File Upload Security Pipeline:**

1. **Extension Check:** `.jpg` passes the extension allowlist.
2. **MIME Type Check:** Declared `image/jpeg` — passes header check.
3. **Magic Byte Check:** File header is `<?php` — does NOT match JPEG magic bytes `FF D8 FF`. Upload rejected immediately.
4. **Double extension attempt** `shell.php.jpg`: WAF detects double-extension pattern. Rejected.
5. **Null byte attempt** `shell.pHp%00.jpg`: Null byte `%00` detected in filename. Rejected.
6. **For files that made it further:** ClamAV antivirus scan — web shell signature detected. Quarantined.
7. **Filename:** Even for accepted files, the original name is discarded and replaced with a UUID. Attacker cannot predict the stored path.
8. **noexec:** Upload directory has `noexec` flag — even if a script were stored, it cannot execute.
9. SHA-256 hash of every attempted file logged for forensic records.

**Layer 2 — Sandbox:**
- A suspicious file is detonated in an isolated sandbox process. Shell execution attempt confirmed within sandbox. Logged.

**Layer 2 — Honeypot:**
- A convincing fake "upload successful" response is returned. A fake shell appears to execute.
- Attacker is routed to a monitored fake OS environment. Every command they type is logged in full.

**Layer 5 — SIEM:**
- CORR-003 triggered: reconnaissance + SQLi + web shell upload = active exploitation attempt confirmed.
- Admin alert: "Web shell upload attempt detected and blocked. Attacker now in honeypot shell environment. Full activity being logged."

**Result:** No web shell on real server. Attacker is generating intelligence in a fake environment.

---

### Stage 4: Attempted Lateral Movement

**Attacker Action:** Inside the honeypot shell, runs network discovery commands: `arp -a`, `ping 192.168.x.x`, attempts to connect to internal network hosts.

**Layer 5 — NDR:**
- Detects unusual connection attempts from the honeypot environment toward internal IP ranges.
- All lateral movement traffic is silently dropped — honeypot is completely isolated from real internal segments.
- NDR alert: "Lateral movement attempt — attacker attempting internal network reconnaissance from honeypot."

**Layer 5 — XDR Orchestration:**
- CORR-005 triggered: full kill chain confirmed (recon + SQLi + shell + lateral).
- XDR playbook executes within 500ms:
  1. IPS permanently bans attacker IP `203.0.113.45` at Firewall level.
  2. All honeypot sessions from this IP terminated.
  3. Full forensic capture of all interaction logs initiated.
  4. Admin receives Critical Incident Report: complete chronological attack timeline from Stage 1 through Stage 4.

**Result:** Attacker's IP is permanently blocked. All lateral movement failed. Complete attack forensics preserved.

---

### Stage 5: Privilege Escalation (Hypothetical — If Attacker Had Reached Real Server)

**Attacker Action:** Has somehow obtained a low-privilege shell as `www-data` on the real server. Runs `find / -perm -4000 2>/dev/null`, `sudo -l`, attempts to modify `/etc/cron.d/backup`.

**Layer 4 — EDR:**
- Anomalous process spawned by `www-data` — process tree flagged immediately.
- `find / -perm -4000` pattern detected — privilege escalation tool signature matched. Alert generated.
- Fake SUID honeypot binaries discovered by the attacker. Execution of any fake SUID binary triggers Critical alert.
- `sudo -l` — `www-data` has zero sudo privileges. Command logged and alerted.

**Layer 4 — Kernel Security (Seccomp / AppArmor):**
- Seccomp profile rejects any kernel syscall outside the approved profile.
- AppArmor profile confines the process to its authorized file paths — `/etc/cron.d` is inaccessible.
- Kernel exploit syscall patterns rejected at OS level.

**Layer 4 — FIM:**
- Cron modification attempt detected by File Integrity Monitor.
- `/etc/cron.d/backup` is owned by root and not writable by `www-data` — modification fails at OS permission level.
- FIM alert generated: "Cron script modification attempt detected." Admin and Network Monitor notified within seconds.

**Layer 4 — Network Quarantine:**
- EDR escalation triggers automatic network quarantine of affected server segment.
- Forensic memory dump and disk snapshot initiated.
- System rollback triggered — server restored to last known-clean snapshot.

**Result:** Even with a foothold, attacker cannot escalate privileges, cannot move laterally. Server is automatically recovered. Complete forensic record preserved.

---

### Final Summary

| Stage | Layers Engaged | Attacker Outcome | System Outcome |
|---|---|---|---|
| Reconnaissance | L1 (IDS/IPS), L2 (WAF), L5 (SIEM+Intel) | Sees only honeypots; IP flagged | Real services invisible; attacker under surveillance |
| SQL Injection | L2 (WAF) | Receives fake data; believes attack worked | Database untouched; payload logged |
| Web Shell Upload | L2 (WAF + Upload Security + Honeypot) | Lands in fake shell environment | No real shell; attacker feeding intelligence |
| Lateral Movement | L5 (NDR + XDR) | All attempts silently dropped | IP permanently banned; forensics captured |
| Privilege Escalation | L4 (EDR + Seccomp + FIM) | Cannot escalate; no SUID; no sudo | Server quarantined, rolled back, recovered |

---

## 18. Acceptance Criteria

### AC-01 — External Attack Coverage
The system MUST successfully detect and respond to all 32 documented external attack types (as defined in Section 10) in integration testing, with correct detection, correct deception response, and correct alert generation for each.

### AC-02 — Device Authentication
A device with all three credentials matching (MAC + Static IP + Digital Signature) + valid MFA MUST authenticate successfully. A device with any one credential modified MUST be rejected and generate the appropriate alert.

### AC-03 — Privilege Enforcement
A device with only "View" privilege on a resource MUST be able to view the resource and MUST be rejected when attempting Create, Edit, Delete, or Rename. All rejection attempts MUST be logged.

### AC-04 — Time-Limited Privilege Expiry
A privilege grant with a set expiry MUST be automatically revoked at the exact expiry time. Operations attempted after expiry MUST be rejected.

### AC-05 — SIEM Correlation
Simulated staged attack (reconnaissance → SQLi → web shell) MUST be detected as a correlated incident by SIEM within 30 seconds of the final stage event.

### AC-06 — Log Tamper Evidence
Any direct database modification to an AuditEvent record MUST be detectable through HMAC signature verification.

### AC-07 — Real-Time Log Panel
A resource interaction event MUST appear in the Log Panel within 500ms of occurrence.

### AC-08 — Role Isolation
A Network Monitor user MUST NOT be able to access data (devices, logs, alerts) from networks they are not assigned to. A Network Monitor MUST NOT be able to create or manage Admin accounts.

### AC-09 — Honeypot Operation
After a port scan is detected from an IP, a connection to port 22 from that IP MUST receive a fake SSH banner. A connection to port 3306 from that IP MUST receive a fake database banner. Real services MUST not respond to that IP.

### AC-10 — No Docker in Production**  
Deployment verification: no Docker daemon, no containerd, no docker-compose, no Kubernetes. All services verified as native systemd units.

---

## 19. Out of Scope

- **OS-level vulnerability patching** — Oh-My-Guard alerts on CVEs but does not apply patches.
- **Physical security** — No hardware controls.
- **Network hardware configuration** — Oh-My-Guard does not configure physical routers or switches.
- **Built-in antivirus engine** — ClamAV is integrated, not built.
- **Email security (DMARC/DKIM/SPF)** — Not in scope.
- **User device management (MDM)** — Oh-My-Guard registers device identifiers; it does not manage the device OS or installed software.
- **Automated penetration testing** — Oh-My-Guard is a defense platform, not an offensive testing tool.

---

## 20. Glossary

| Term | Definition |
|---|---|
| **ARP Spoofing** | An attack where a malicious actor sends fake ARP messages to associate their MAC address with a legitimate IP, intercepting traffic. |
| **AppArmor** | A Linux kernel security module that restricts program capabilities using per-program profiles. |
| **Beaconing** | Periodic outbound network connections made by malware to check in with its Command & Control server. |
| **C2 (Command & Control)** | Infrastructure used by an attacker to remotely control compromised systems. |
| **ClamAV** | An open-source antivirus engine used for file scanning. |
| **CVE** | Common Vulnerabilities and Exposures — a publicly disclosed software vulnerability identifier. |
| **Digital Signature** | A cryptographic mechanism using a key pair (public + private) to verify the identity of the signer. |
| **EDR** | Endpoint Detection & Response — monitors and responds to threats at the device/endpoint level. |
| **FIM** | File Integrity Monitoring — detects unauthorized changes to monitored files. |
| **Honeypot** | A deception system that appears to be a legitimate target to lure and study attackers. |
| **HMAC** | Hash-based Message Authentication Code — a cryptographic mechanism for verifying the integrity of a message. |
| **IDOR** | Insecure Direct Object Reference — accessing another user's resources by manipulating identifiers. |
| **IOC** | Indicator of Compromise — evidence that a system has been breached (malicious IP, hash, domain, etc.). |
| **IDS** | Intrusion Detection System — passively monitors traffic and alerts on threats. |
| **IPS** | Intrusion Prevention System — actively blocks threats inline with traffic. |
| **Kill Chain** | The stages of a cyberattack: Reconnaissance → Weaponization → Delivery → Exploitation → Installation → C2 → Actions on Objectives. |
| **Magic Bytes** | The binary header bytes at the start of a file that identify its actual file type regardless of extension. |
| **MFA / TOTP** | Multi-Factor Authentication / Time-Based One-Time Password — a second authentication factor that changes every 30 seconds. |
| **NDR** | Network Detection & Response — analyzes network traffic flows to detect threats. |
| **noexec** | A filesystem mount flag that prevents any file stored in that directory from being executed. |
| **RCE** | Remote Code Execution — an attack achieving arbitrary code execution on the target server. |
| **RS256** | RSA signature algorithm using SHA-256 — an asymmetric JWT signing algorithm. |
| **Seccomp** | Secure Computing Mode — a Linux kernel feature that restricts which system calls a process may make. |
| **SIEM** | Security Information & Event Management — aggregates and correlates logs from all security components. |
| **SQLi** | SQL Injection — injecting SQL commands into application inputs to manipulate the database. |
| **SSRF** | Server-Side Request Forgery — tricking the server into making requests to internal or unintended targets. |
| **SSTI** | Server-Side Template Injection — injecting template engine syntax to achieve code execution. |
| **SUID** | Set User ID — a Linux permission bit that allows a file to run with the permissions of its owner rather than the executing user. |
| **TLS 1.3** | The current standard for transport layer encryption. |
| **UUID** | Universally Unique Identifier — a randomly generated 128-bit identifier used to prevent predictable resource paths. |
| **VPN** | Virtual Private Network — an encrypted tunnel used to secure all internal network communication. |
| **WAF** | Web Application Firewall — inspects HTTP/HTTPS traffic to block web-specific attacks. |
| **XDR** | Extended Detection & Response — the integration of EDR, NDR, SIEM, and Threat Intelligence into a unified detection and response platform. |
| **XXE** | XML External Entity injection — abusing XML parsers to read local files or make server-side requests. |
| **Zero Trust** | A security model where no device, user, or connection is trusted by default — every interaction must be explicitly authenticated and authorized. |

---

*End of Document*

**Oh-My-Guard PRD v1.0 — Prepared for Development Team**  
*This document is the single source of truth for all Oh-My-Guard features, behaviours, and requirements. No other requirement specification document supersedes this one.*