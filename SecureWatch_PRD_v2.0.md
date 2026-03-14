

**🛡 SecureWatch**

Intelligent Security Monitoring System

**Product Requirements Document (PRD)**

| Field | Value |
| :---- | :---- |
| **Version** | 2.0 — Updated |
| **Date** | March 2026 |
| **Classification** | CONFIDENTIAL |
| **Status** | Approved for Development |
| **Supersedes** | PRD v1.0 — March 2026 |

# **1\. Executive Summary**

SecureWatch is a lightweight, pluggable, universal security monitoring platform designed to give organisations full visibility over who accesses their systems, from where, and what they do once inside. It integrates directly into any existing infrastructure — whether on-premise, cloud-hosted, or hybrid — and raises real-time alerts the moment an anomaly is detected.

Universal Integration is the foundational architectural principle of SecureWatch. The platform is built from the ground up to connect to any system, database, API, application, legacy infrastructure, or cloud service with minimal friction. SecureWatch acts as a monitoring layer that wraps around anything — enforcing controls and maintaining tamper-evident audit trails across every integration point, regardless of technology stack.

**The core problem SecureWatch solves is straightforward: most organisations cannot answer five basic questions at any given moment:**

* Who is currently logged in to our systems?

* Is every active session tied to an authorised, recognised account and device?

* What resources has each user accessed, and when?

* Are there active brute-force or credential stuffing attacks in progress?

* Are privileged and service accounts being used within their authorised scope?

SecureWatch answers all five continuously and automatically, making it an essential layer in any zero-trust or defence-in-depth security strategy.

# **2\. Problem Statement**

Unauthorised access is among the leading causes of data breaches globally. Traditional perimeter-based defences (firewalls, VPNs) are no longer sufficient on their own. Attackers who compromise a single valid credential can move laterally through a network largely undetected, often for weeks or months before discovery.

The specific pain points SecureWatch addresses are:

* Undetected unauthorised logins — accounts that were never registered appearing in active sessions

* Rogue devices — known credentials used from unrecognised hardware or unknown network locations

* Insider threats and privilege abuse — legitimate users accessing resources outside their authorisation scope

* Privileged account abuse — admin and service accounts operating outside expected parameters or time windows

* Credential stuffing and brute-force attacks — automated attempts to gain access using compromised or guessed credentials

* Lack of audit trail — no detailed, tamper-evident log of who accessed what, and when

* Delayed incident response — threats discovered too late because alerts were absent or buried

# **3\. Product Vision & Goals**

## **3.1 Vision**

To be the universal security monitoring layer for any system, database, or infrastructure — providing real-time visibility, anomaly detection, and a tamper-evident audit trail across every integration point, regardless of technology stack.

## **3.2 Primary Goals**

| Goal | Name | Description |
| :---- | :---- | :---- |
| **G1** | Universal Integration | Connect to any system, database, API, legacy infrastructure, or cloud service — integration is the foundational architectural pillar |
| **G2** | Real-Time Visibility | Show all active sessions (accounts \+ devices) at any moment across all integrated systems |
| **G3** | Anomaly Detection | Automatically flag unauthorised accounts, unknown devices, out-of-scope access, brute-force attempts, and privileged account abuse |
| **G4** | Resource Audit Trail | Maintain a complete, tamper-evident, indestructible log of every resource access event including ownership, viewer, and editor history |
| **G5** | Alerting & Response | Deliver instant, actionable alerts through multiple channels when threats are detected, with automated session termination capability |
| **G6** | Compliance Enablement | Help organisations meet audit requirements (ISO 27001, SOC 2, HIPAA, GDPR, etc.) |

# **4\. Scope**

## **4.1 In Scope (Version 2.0)**

* Universal Integration Layer — connect to any system, database, API, legacy infrastructure, or cloud service

* Account session monitoring across all registered systems

* Device and network fingerprinting for anomaly detection

* Multi-layer authorisation verification (account \+ device \+ network) on every action

* Resource ownership and lifecycle tracking — creator, owner, ACL, view/edit history

* Inherited permissions engine — child resources inherit parent ACL unless overridden

* Ownership transfer workflow — revoked owner triggers resource lock until Admin reassigns

* Resource access logging for all resource types: files, databases, APIs, services, applications, network shares, and custom assets

* Indestructible audit log — append-only, cryptographically signed, permanently non-deletable by any role

* Real-time alerting via dashboard, email, SMS, and webhook

* Automated session termination — configurable per policy alongside monitor-and-alert mode

* Admin dashboard with unified inbox, live session view, integration health panel, and audit log search

* Single Admin operator model with group-based privilege management

* Multi-tenant operation — complete data isolation per tenant

* REST API for integration with existing SIEM or ticketing systems

* Emergency read-only Admin view — separate URL/port, auto-expiring

## **4.2 Out of Scope (Future Versions)**

* Behavioural biometrics and keystroke dynamics

* Full endpoint detection & response (EDR) capabilities

* Mobile device management (MDM) integration

* Dual-Admin approval for critical configuration changes (planned v2.1)

* ML-based behavioural baselining (planned v2.1)

# **5\. Stakeholders**

| Stakeholder | Role | Interest in SecureWatch |
| :---- | :---- | :---- |
| SecureWatch Admin | Primary Operator | Sole operator of SecureWatch — monitors threats, manages privileges, reviews audit logs, configures all policies |
| System / Resource Owners | Decision Makers | Risk reduction, overall security posture |
| Compliance Officers | Secondary Users | Audit reports for regulatory requirements |
| End Users | Indirectly Affected | Their sessions and access patterns are monitored; they interact with their systems normally |
| Development Team | Builders | Implement and maintain the platform |
| Platform Super Admin | Platform Operator | Manages multi-tenant provisioning; one per SecureWatch deployment |

# **6\. Core Features & Functional Requirements**

## **6.1 Account Session Monitor**

SecureWatch maintains a live registry of all authenticated sessions across all connected systems.

* FR-1.1  The system shall continuously poll or receive session events from all integrated hosts via the Universal Integration Layer

* FR-1.2  Every active session shall be mapped to a registered account record in the SecureWatch identity store

* FR-1.3  Sessions belonging to accounts not found in the authorised registry shall trigger a CRITICAL alert immediately

* FR-1.4  The dashboard shall display a real-time list of all active sessions including: username, account status, login time, session duration, source IP, and device identifier

* FR-1.5  The Admin may manually mark an account as authorised, suspended, or revoked

* FR-1.6  Brute-force and credential stuffing attacks shall be detected via failed login escalation rules and trigger alerts of appropriate severity

* FR-1.7  Privileged and service accounts shall be monitored with equivalent rigour to standard user accounts

## **6.2 Multi-Layer Authorisation Engine**

Authorisation is verified across three independent layers before any session or resource action is permitted. A session must pass all three layers to be considered clean. Failing any one layer blocks the action and triggers an alert of appropriate severity.

**Layer 1 — Account Verification**

* FR-2.1  Compare active session account against the registered accounts database

* FR-2.2  Flag accounts that are unregistered, expired, or revoked

**Layer 2 — Network Context Verification**

* FR-2.3  SecureWatch shall maintain a registry of authorised network zones (IP ranges, subnets, VLANs)

* FR-2.4  Login events originating from outside registered network zones shall trigger a HIGH or CRITICAL alert

* FR-2.5  The system shall support geo-fencing rules to restrict sessions to specific geographic regions

**Layer 3 — Device Fingerprinting**

* FR-2.6  Each registered device is assigned a unique fingerprint (MAC address, hostname, hardware identifiers)

* FR-2.7  A session using a registered account from an unrecognised device shall trigger a HIGH alert

* FR-2.8  Administrators may whitelist new devices after verification

**Denial Behaviour**

* FR-2.9  When any layer fails, the action is blocked and the end user receives only a generic 'Access Denied' message — no reason, no system detail, no layer information is ever revealed to the end user

* FR-2.10  The Admin inbox receives full detail of every denial — which layer failed, why, which account, device, resource, and timestamp

**Automated Session Termination**

* FR-2.11  Automated session termination shall be configurable per policy — Admin may configure auto-terminate on CRITICAL verdict or three-layer failure

* FR-2.12  Every automated session termination shall be logged as a CRITICAL event in the audit log

## **6.3 Resource Access Monitor**

Every resource connected to SecureWatch is tracked with full ownership lifecycle management and an access policy defining who can access it, what actions they may perform, and during which time windows. Three-layer verification is enforced before every resource action.

**Resource Ownership & Lifecycle**

* FR-3.1  Every resource shall have a designated owner — the account that created it

* FR-3.2  If the owner's account is revoked, the resource shall be immediately and automatically locked until the Admin manually reassigns ownership

* FR-3.3  Creating a resource grants ownership record only — all three verification layers still apply before any action, including by the creator

* FR-3.4  Ownership transfer requires Admin initiation and is logged as a MEDIUM event

**Resource Types**

* FR-3.5  Resources shall include: files, directories, databases, database tables, APIs, applications, network shares, services, and any custom system asset

**Access Control & Permissions**

* FR-3.6  Each resource shall have a defined Access Control List (ACL) specifying authorised users/roles and permitted actions (read, write, execute, delete, export)

* FR-3.7  Privileges may be granted by the Admin directly to individuals or to groups — individuals inherit all privileges of their assigned groups

* FR-3.8  If a user belongs to two groups with conflicting privileges, the most restrictive rule always wins — this is non-configurable

* FR-3.9  Inherited permissions — child resources (e.g., files within a folder, tables within a database) shall inherit the parent resource's ACL unless explicitly overridden — inheritance is OFF by default and must be explicitly enabled by the Admin

**Resource Action Logging**

* FR-3.10  Every access event shall be logged with: timestamp (UTC), user identity, device, source IP, resource identifier, resource type, action type, verification layers passed/failed, and outcome (allowed/denied/flagged)

* FR-3.11  A view history and edit history shall be maintained per resource — these are visible to the Admin only and are never visible to the resource owner

* FR-3.12  Access to any resource by a user not in that resource's ACL shall trigger an alert and be denied

* FR-3.13  Time-based access restrictions shall be enforceable

* FR-3.14  Bulk access events shall trigger a DATA EXFILTRATION alert

**Audit Log Protection**

* FR-3.15  All audit logs — including view history and edit history — are tamper-evident, append-only, and permanently non-deletable by any role including the Admin

* FR-3.16  Any deletion attempt by any role shall be automatically blocked and immediately generate a CRITICAL alert

* FR-3.17  Audit logs may only be viewed and exported — never deleted or modified

## **6.4 Alerting & Notification System**

* FR-4.1  Alerts shall be classified into severity levels: INFO, LOW, MEDIUM, HIGH, and CRITICAL

* FR-4.2  All events and alerts shall land in the unified Admin inbox, prioritised by severity (CRITICAL first)

* FR-4.3  Alert delivery channels shall include: Admin inbox (always), email, SMS (CRITICAL/HIGH only), webhook (Slack, Teams, PagerDuty), and SIEM integration (Syslog/CEF)

* FR-4.4  Each alert shall include: timestamp, severity level, triggering event description, affected account, device, resource, failed verification layer (if applicable), and recommended action

* FR-4.5  Alert rules shall be fully configurable; Admin can tune thresholds and silence low-priority alerts

* FR-4.6  All alerts shall be stored and searchable in the audit log

* FR-4.7  Repeated alerts of the same type within a configurable window shall be deduplicated and grouped to prevent alert fatigue

* FR-4.8  Green signals — resource creation confirmations, successful integrations — shall be delivered to the Admin inbox with optional email notification to the creating user

## **6.5 Audit Log & Reporting**

* FR-5.1  A tamper-evident audit log shall record every monitored event in an append-only structure using TimescaleDB

* FR-5.2  Log entries shall be cryptographically signed using HMAC-SHA256 to detect tampering

* FR-5.3  The audit log shall be searchable by: date range, user, device, resource, event type, severity, and outcome

* FR-5.4  Administrators shall be able to export reports in PDF, CSV, and JSON formats

* FR-5.5  Pre-built compliance report templates shall be available for ISO 27001, SOC 2, and general IT audit purposes

* FR-5.6  Log retention policy: hot storage default 365 days; beyond 365 days archived to cold storage — logs are never deleted

* FR-5.7  Cold storage archiving moves logs to separate NAS or cloud object storage (AWS S3/Azure Blob compatible) with compression; HMAC signatures are preserved

* FR-5.8  Log destruction requires Admin MFA re-verification, explicit confirmation, and generates a permanent CRITICAL audit entry — the metadata of what was destroyed, when, and by whom is retained forever even if content is purged

* FR-5.9  An emergency read-only Admin view shall be accessible via a separate URL and port using separate emergency credentials, auto-expiring after 4 hours, with every action logged

## **6.6 Universal Integration Framework**

Universal Integration is a foundational architectural pillar — not a deployment step. SecureWatch is designed from the ground up to connect to any system, database, or infrastructure with minimal friction.

**Integration Methods**

| Method | Best For | Description |
| :---- | :---- | :---- |
| SecureWatch Agent | Servers, workstations | Lightweight proprietary daemon installed on host; streams events in real time |
| REST API / Webhook | Modern apps, cloud services | System pushes events to SecureWatch endpoint; mutual TLS required |
| Log File Parser | Legacy systems, databases | SecureWatch pulls and normalises log files; real-time or scheduled batch (minimum 1-minute interval) |
| Native SDK (Open Source) | Custom-built applications | Developer embeds open-source SDK; events automatically forwarded; exposes event forwarding interface only — no detection logic revealed |

**Supported System Types**

* Servers and workstations (Windows, Linux, macOS)

* Databases: MySQL, PostgreSQL, MongoDB, Redis, Oracle, MSSQL, and any DB via query log parsing

* Directory & identity systems: Active Directory / LDAP, AWS IAM, Azure AD, Google Workspace

* Cloud infrastructure: AWS, Azure, GCP, Docker, Kubernetes

* Legacy systems: SNMP, WMI, flat file syslog, custom log format mapping

* Custom applications via open-source SDK

**Universal Event Schema**

All events regardless of source are normalised into the Universal Event Schema before processing:

* event\_id (UUID), timestamp (UTC), source\_system, source\_type, tenant\_id

* account\_id, device\_id, source\_ip, action, resource\_id, resource\_type

* outcome (ALLOWED | DENIED | FLAGGED), raw\_event (original log entry — preserved immutably)

**Integration Health**

* FR-6.1  Every connected system is continuously monitored for event flow

* FR-6.2  If no events are received beyond a configurable threshold (default 5 minutes): status moves to DEGRADED (warning) then SILENT (CRITICAL alert)

* FR-6.3  Admin may configure maintenance windows per system — silence suppressed during window; MFA re-verification required to schedule

* FR-6.4  Integration health dashboard shows: Active (green), Degraded (amber), Silent (red), Disconnected (grey) per connected system

* FR-6.5  Every integration added, modified, or removed is permanently logged and triggers an Admin notification

* FR-6.6  Integration versioning — connector updates are backward compatible; breaking changes require Admin approval before deployment

* FR-6.7  Initial integration of any new system type shall require no more than 30 minutes for a technical administrator

* FR-6.8  Events from unregistered sources are rejected, logged, and trigger a CRITICAL alert

# **7\. Non-Functional Requirements**

| Category | Requirement | Target |
| :---- | :---- | :---- |
| Performance | Alert generation latency from event detection | \< 5 seconds |
| Performance | Dashboard session data refresh rate | Every 10 seconds |
| Scalability | Concurrent monitored sessions | Up to 10,000 (v2.0) |
| Scalability | Log ingestion throughput | 50,000 events/min |
| Availability | Platform uptime SLA | 99.9% (\< 8.7 hrs/year) |
| Security | Data in transit | TLS 1.3 mandatory |
| Security | Data at rest | AES-256 encryption |
| Security | Admin authentication | MFA enforced — non-negotiable, cannot be disabled |
| Security | Integration endpoints | Mutual TLS authentication required |
| Compliance | Audit log integrity | HMAC-SHA256 on all entries |
| Compliance | Audit log deletion | Permanently prohibited — any role |
| Database | Audit log store technology | TimescaleDB (free, open source) |
| Integration | New system integration time | \< 30 minutes — hard requirement |
| Usability | Admin dashboard learnability | Productive within 2 hours |
| On-Premise | Minimum server specification | 16-core CPU, 32GB RAM, 2TB NVMe SSD, 1Gbps network, Ubuntu 22.04 LTS |

# **8\. System Architecture (High-Level)**

SecureWatch is built on a modular, event-driven architecture. Universal Integration is the foundational entry layer — all other components depend on it.

| Component | Description |
| :---- | :---- |
| **Universal Integration Layer** | Foundational entry point for ALL event sources — Agent, REST API/Webhook, Log File Parser, SDK. Authenticates every source before accepting events. Rejects and alerts on events from unregistered sources. Maintains connection state per integrated system. Deployed in redundant active-active configuration. |
| **Event Normalizer** | Receives raw events from the Integration Layer. Detects source format (syslog, JSON, CSV, proprietary, DB query log). Maps all events to Universal Event Schema. Preserves original raw event immutably. Normalises timestamps to UTC. Sandboxed — malformed events are rejected and logged before reaching the Event Bus. |
| **Event Bus (Message Broker)** | Decoupled message queue (Kafka / RabbitMQ). Receives normalised events and routes them to the appropriate processing pipeline. Buffers events during Integration Layer degradation — no events are lost. |
| **Integration Registry & Health Monitor** | Tracks all connected systems — type, integration method, connector version, health status, last event timestamp. Continuously monitors event flow per system. Triggers CRITICAL alert on silent systems. Cannot be disabled by any role. |
| **Authorisation Engine** | Core three-layer policy processor (Account \+ Network \+ Device). Evaluates every event. Produces a risk verdict. Enforces generic denial response to end users. Passes full detail to Notification Engine for Admin. |
| **Resource Access Policy Engine** | Enforces ACLs for all registered resources. Manages time-based restrictions, bulk access detection, inherited permissions, and group conflict resolution (most-restrictive wins). Logs every access event. |
| **Resource Registry** | Central store of all resources — type, owner, ACL, inheritance flag, view history, edit history. Manages ownership lifecycle. Locks resources on owner account revocation. View/edit history visible to Admin only. |
| **Alert Manager** | Processes risk verdicts and policy violations. Applies deduplication, severity classification, escalation rules, and routing. Dispatches to Notification Engine. |
| **Notification Engine** | Manages the unified Admin inbox (priority queue — CRITICAL first). Dispatches email, SMS (CRITICAL/HIGH), and webhooks. Logs delivery confirmation. Sends green signals for resource creation and integration events. |
| **Audit Log Store** | TimescaleDB — append-only, HMAC-SHA256 signed, indestructible. Supports fast search and export. Hot storage (365 days default), cold storage archiving beyond threshold. Deletion permanently blocked at application layer — any attempt triggers CRITICAL alert. |
| **Admin Dashboard** | Web-based UI — single Admin operator model. Panels: Unified Admin Inbox, Live Session View, Resource Registry View, Integration Health Dashboard, Audit Log Search & Export. Emergency read-only view on separate URL/port. |
| **REST API Gateway** | Exposes all SecureWatch functionality programmatically. Used for agentless integrations, SIEM forwarding, and third-party tooling. |
| **Identity & Device Registry** | Central database of registered accounts, devices (fingerprints, MAC addresses), network zones, groups, and privilege assignments. The ground truth against which all events are validated. |

# **9\. Alert Severity Matrix**

## **9.1 CRITICAL — Immediate Response**

| \# | Trigger | Default Action |
| :---- | :---- | :---- |
| C1 | Unregistered account logged in | Alert \+ auto-notify Admin \+ lock session flag |
| C2 | Known credential from unknown device AND unknown network simultaneously | Alert \+ lock session flag \+ auto-notify Admin |
| C3 | Audit log deletion attempted — any role including Admin | Block action \+ CRITICAL alert \+ notify Admin |
| C4 | Connected system silent beyond threshold (default 5 min) | Alert \+ notify Admin immediately |
| C5 | Connector tampering detected | Alert \+ isolate connector \+ notify Admin |
| C6 | Admin authentication failure — 3+ attempts | Lock Admin account \+ CRITICAL alert \+ notify Admin |
| C7 | Event received from completely unregistered source | Reject event \+ CRITICAL alert \+ notify Admin |
| C8 | Resource owner account revoked — resource auto-locked | Lock resource \+ CRITICAL alert \+ notify Admin |

## **9.2 HIGH — Response Within 5 Minutes**

| \# | Trigger | Default Action |
| :---- | :---- | :---- |
| H1 | Registered account from unrecognised device | Alert Admin |
| H2 | Login from outside authorised network zone | Alert Admin |
| H3 | Access to restricted resource outside permitted hours | Alert \+ log event |
| H4 | Unauthorised resource access attempt — any resource type | Block \+ Alert \+ log event |
| H5 | Event received from registered but degraded source | Alert Admin \+ investigate |
| H6 | Three-layer verification failure on resource action | Block action \+ Alert \+ log all failed layers |

## **9.3 MEDIUM — Response Within 15 Minutes**

| \# | Trigger | Default Action |
| :---- | :---- | :---- |
| M1 | Unusually high volume of resource access events | Alert \+ flag for review |
| M2 | Bulk access / data exfiltration attempt detected | Alert \+ flag \+ log event |
| M3 | Integration added, modified, or removed | Alert Admin \+ log event |
| M4 | Group conflict detected — most-restrictive rule auto-applied | Alert Admin \+ log resolution |
| M5 | Ownership transfer initiated — pending Admin approval | Alert Admin \+ lock resource pending approval |

## **9.4 LOW — Response Within 1 Hour**

| \# | Trigger | Default Action |
| :---- | :---- | :---- |
| L1 | Failed login attempt — single occurrence | Log \+ notify if repeated |
| L2 | Admin authentication failure — single occurrence | Log \+ monitor |
| L3 | Privilege granted or revoked by Admin | Log \+ notify Admin confirmation |
| L4 | Access outside permitted time window — single occurrence | Log \+ notify Admin |

## **9.5 INFO — Best Effort**

| \# | Trigger | Default Action |
| :---- | :---- | :---- |
| I1 | New device seen on network — pending registration | Log only |
| I2 | Privilege grant/revoke confirmed successfully | Log only |
| I3 | Resource created successfully — green signal | Admin inbox notification; optional email to creator |
| I4 | New integration registered successfully | Log \+ Admin inbox notification |
| I5 | Integration health restored — system active again | Log \+ Admin inbox notification |

## **9.6 Escalation Rules**

* Admin Auth Failure: 1st attempt → LOW; 2nd attempt → LOW \+ warning; 3rd+ attempt → CRITICAL \+ account locked

* End User Failed Login: single → LOW; 3 in 5 min → MEDIUM; 5+ in 5 min → HIGH

* Silent System: \< 5 min → DEGRADED warning; \> 5 min → CRITICAL alert

* Bulk Access: exceeds threshold N → MEDIUM; exceeds 2x threshold → HIGH

## **9.7 Response SLA & Notification Channels**

| Severity | SLA | Notification Channels |
| :---- | :---- | :---- |
| **CRITICAL** | Immediate | Admin Inbox \+ Email \+ SMS \+ Webhook |
| **HIGH** | \< 5 min | Admin Inbox \+ Email \+ SMS |
| **MEDIUM** | \< 15 min | Admin Inbox \+ Email |
| **LOW** | \< 1 hour | Admin Inbox only |
| **INFO** | Best effort | Admin Inbox only |

# **10\. Data Model — Key Entities**

All entities include a tenant\_id field for multi-tenant isolation.

## **10.1 Account**

| Field | Type | Description |
| :---- | :---- | :---- |
| account\_id | UUID | Unique identifier |
| username | String | Login name |
| email | String | Associated email address |
| status | Enum | ACTIVE | SUSPENDED | REVOKED | EXPIRED |
| registered\_at | DateTime (UTC) | When the account was added |
| created\_by | Admin ID | Admin who registered the account |
| last\_verified\_at | DateTime (UTC) | Timestamp of last successful three-layer verification |
| failed\_login\_count | Integer | Running count for escalation rules |
| group\_ids | Array\[GroupID\] | Groups this account belongs to |
| authorized\_resources | Array\[ResourceID\] | Direct resource grants |
| tenant\_id | UUID | Tenant isolation identifier |

## **10.2 Device**

| Field | Type | Description |
| :---- | :---- | :---- |
| device\_id | UUID | Unique identifier |
| fingerprint | String | Hash of MAC, hostname, hardware IDs |
| mac\_address | String | Physical MAC address — Layer 3 verification anchor |
| hostname | String | Device hostname |
| network\_zone\_id | UUID | Assigned network zone |
| registered\_by | Admin ID | Admin who approved the device |
| approved\_at | DateTime (UTC) | Timestamp of Admin approval |
| status | Enum | REGISTERED | PENDING | BLACKLISTED |
| blacklist\_reason | String (nullable) | Reason for blacklisting if applicable |
| last\_seen | DateTime (UTC) | Timestamp of most recent event |
| tenant\_id | UUID | Tenant isolation identifier |

## **10.3 Session Event**

| Field | Type | Description |
| :---- | :---- | :---- |
| event\_id | UUID | Unique event identifier |
| timestamp | DateTime (UTC) | When the event occurred |
| account\_id | UUID | Account involved |
| device\_id | UUID | Device the session originated from |
| source\_ip | String | IP address of the client |
| network\_zone | String | Resolved network zone (or UNKNOWN) |
| event\_type | Enum | LOGIN | LOGOUT | SESSION\_ACTIVE | AUTH\_FAIL |
| risk\_verdict | Enum | CLEAN | SUSPICIOUS | CRITICAL |
| failed\_layer | Enum (nullable) | NONE | LAYER\_1 | LAYER\_2 | LAYER\_3 |
| denial\_reason | String (nullable) | Full denial detail — Admin eyes only; never exposed to end user |
| normalized\_event\_id | UUID | Link to Universal Event Schema record |
| alert\_id | UUID (nullable) | Linked alert if verdict \!= CLEAN |
| tenant\_id | UUID | Tenant isolation identifier |

## **10.4 Resource Access Log**

| Field | Type | Description |
| :---- | :---- | :---- |
| log\_id | UUID | Unique log entry identifier |
| timestamp | DateTime (UTC) | When access occurred |
| account\_id | UUID | Who accessed the resource |
| device\_id | UUID | From which device |
| resource\_id | UUID | Which resource was accessed |
| resource\_type | Enum | FILE | DIRECTORY | DATABASE | TABLE | API | SERVICE | NETWORK\_SHARE | APPLICATION | CUSTOM |
| parent\_resource\_id | UUID (nullable) | Parent resource for inherited permission context |
| action | Enum | READ | WRITE | DELETE | EXECUTE | EXPORT |
| outcome | Enum | ALLOWED | DENIED | FLAGGED |
| verification\_layers\_passed | Array\[Enum\] | Which of LAYER\_1, LAYER\_2, LAYER\_3 passed |
| denial\_reason | String (nullable) | Full denial detail — Admin eyes only |
| hmac\_signature | String | Tamper-evident HMAC-SHA256 signature |
| tenant\_id | UUID | Tenant isolation identifier |

## **10.5 Resource Registry (NEW)**

| Field | Type | Description |
| :---- | :---- | :---- |
| resource\_id | UUID | Unique resource identifier |
| resource\_name | String | Human-readable name |
| resource\_type | Enum | FILE | DIRECTORY | DATABASE | TABLE | API | SERVICE | NETWORK\_SHARE | APPLICATION | CUSTOM |
| owner\_account\_id | UUID | Account that created/owns the resource |
| created\_at | DateTime (UTC) | Resource creation timestamp |
| parent\_resource\_id | UUID (nullable) | Parent resource for ACL inheritance |
| inheritance\_active | Boolean | Whether child inherits parent ACL — OFF by default |
| ownership\_status | Enum | ACTIVE | LOCKED | TRANSFERRED |
| acl | Array\[ACLEntry\] | account\_id/group\_id, permitted\_actions\[\], time\_restrictions{} |
| view\_history | Array\[LogID\] | Admin eyes only — never visible to owner |
| edit\_history | Array\[LogID\] | Admin eyes only — never visible to owner |
| locked\_at | DateTime (nullable) | When resource was locked |
| lock\_reason | String (nullable) | Reason for lock (e.g. owner revoked) |
| tenant\_id | UUID | Tenant isolation identifier |

## **10.6 Group (NEW)**

| Field | Type | Description |
| :---- | :---- | :---- |
| group\_id | UUID | Unique group identifier |
| group\_name | String | Display name |
| created\_by | Admin ID | Admin who created the group |
| created\_at | DateTime (UTC) | Creation timestamp |
| member\_accounts | Array\[AccountID\] | Accounts in this group |
| privileges | Array\[PrivilegeEntry\] | resource\_id, permitted\_actions\[\], time\_restrictions{} |
| conflict\_rule | Enum (fixed) | MOST\_RESTRICTIVE — non-configurable system behaviour |
| tenant\_id | UUID | Tenant isolation identifier |

## **10.7 Integration Registry (NEW)**

| Field | Type | Description |
| :---- | :---- | :---- |
| system\_id | UUID | Unique system identifier |
| system\_name | String | Display name |
| system\_type | Enum | DATABASE | FILE\_SYSTEM | APPLICATION | CLOUD | LEGACY | DIRECTORY |
| integration\_method | Enum | AGENT | API | LOG\_PARSER | SDK |
| connector\_version | String | Current connector version |
| status | Enum | ACTIVE | DEGRADED | SILENT | DISCONNECTED |
| registered\_at | DateTime (UTC) | Registration timestamp |
| registered\_by | Admin ID | Admin who registered the system |
| last\_event\_at | DateTime (UTC) | Timestamp of most recent received event |
| health\_threshold\_mins | Integer | Silence threshold before CRITICAL alert (default: 5\) |
| breaking\_change | Boolean | Whether pending connector update is a breaking change |
| admin\_approved | Boolean | Whether breaking change has Admin approval |
| tenant\_id | UUID | Tenant isolation identifier |

## **10.8 Notification Record (NEW)**

| Field | Type | Description |
| :---- | :---- | :---- |
| notification\_id | UUID | Unique notification identifier |
| timestamp | DateTime (UTC) | When notification was generated |
| severity | Enum | CRITICAL | HIGH | MEDIUM | LOW | INFO | GREEN\_SIGNAL |
| event\_type | String | Human-readable event category |
| message | String | Short notification summary |
| detail | String | Full detail including failed layer and reason — Admin eyes only |
| delivery\_channels | Array\[Enum\] | INBOX | EMAIL | SMS | WEBHOOK |
| delivery\_status | Enum | DELIVERED | PENDING | FAILED |
| acknowledged | Boolean | Whether Admin has acknowledged |
| tenant\_id | UUID | Tenant isolation identifier |

## **10.9 Privilege Assignment (NEW)**

| Field | Type | Description |
| :---- | :---- | :---- |
| assignment\_id | UUID | Unique assignment identifier |
| granted\_by | Admin ID | Admin who granted the privilege |
| granted\_at | DateTime (UTC) | Timestamp of grant — immediately effective |
| target\_type | Enum | ACCOUNT | GROUP |
| target\_id | UUID | AccountID or GroupID receiving the privilege |
| resource\_id | UUID | Resource being granted |
| permitted\_actions | Array\[Enum\] | READ | WRITE | DELETE | EXECUTE | EXPORT |
| time\_restrictions | Object (nullable) | days\_of\_week\[\], start\_time, end\_time |
| status | Enum | ACTIVE | REVOKED |
| revoked\_at | DateTime (nullable) | Timestamp of revocation |
| revoked\_by | Admin ID (nullable) | Admin who revoked |
| tenant\_id | UUID | Tenant isolation identifier |

# **11\. User Roles & Permissions**

SecureWatch operates on a single Admin operator model. The Admin is the sole direct user of SecureWatch. All other users (end users) interact with their systems normally and are subject to the controls SecureWatch enforces invisibly behind the scenes.

| Role | Capabilities |
| :---- | :---- |
| **Platform Super Admin** | Manages multi-tenant provisioning — creates and manages tenant instances. One per SecureWatch deployment. Cannot access individual tenant data. |
| **Admin (SecureWatch Operator)** | Full access to all SecureWatch configuration. Monitors all sessions, alerts, and audit logs. Grants and revokes privileges to individuals and groups. Creates and manages groups. Registers and deregisters accounts and devices. Manages network zones and resource ACLs. Views and exports audit logs. Receives all alerts and green signals via unified inbox. Cannot delete audit logs. |
| **API Service Account** | Programmatic access to ingest events or query data via REST API. Scoped to specific operations only. |
| **End Users** | Not direct users of SecureWatch. Interact with their own systems normally. SecureWatch enforces controls silently. Blocked actions return only 'Access Denied' — no reason, no system detail ever revealed. |

## **11.1 Privilege Management Model**

* Individual Grant: Admin assigns privileges directly to a specific account for a specific resource

* Group Grant: Admin creates a group, adds member accounts, assigns privileges to the group — members inherit all group privileges

* Conflict Resolution: if a user belongs to two groups with conflicting privileges, the most restrictive rule always wins — non-configurable

* Privilege Propagation: Admin-granted privileges take effect immediately and atomically — logged with timestamp and Admin identity

* Audit Log Permissions: Admin and API Service Account may view and export; deletion blocked permanently for all roles

## **11.2 Admin Account Security**

* MFA enforced on all Admin logins — hard non-negotiable requirement, cannot be disabled under any circumstance

* Admin sessions time out after configurable inactivity period

* Admin login from unrecognised device or network triggers CRITICAL alert

* 3+ failed Admin login attempts triggers account lock and CRITICAL alert

* Admin account recovery requires offline recovery key \+ MFA re-verification — recovery event generates CRITICAL alert and new recovery key

* All Admin actions logged immutably — tamper-evident, indestructible

# **12\. Compliance & Legal Considerations**

* SecureWatch must comply with applicable data protection regulations (GDPR, PDPA) in how it stores personal data related to monitored accounts

* All access logs are sensitive audit data and must be protected with equivalent rigour to the systems they monitor

* Organisations deploying SecureWatch must have appropriate policies in place notifying employees that system access is monitored

* Log retention periods are configurable to meet jurisdiction-specific legal requirements — hot storage default 365 days; cold storage archiving beyond threshold

* Logs are never deleted — only archived to cold storage. Destruction of log content requires Admin MFA \+ explicit confirmation \+ generates permanent CRITICAL audit entry

* Destroyed log metadata is retained forever: what was destroyed, when, and by whom

* Multi-tenant deployments maintain complete data isolation at database level per tenant

* SecureWatch shall not store raw user credentials under any circumstances

* Audit logs must be exportable for legal discovery or regulatory audit purposes

* Pre-built compliance report templates available for ISO 27001, SOC 2, and general IT audit purposes

# **13\. Milestones & Phased Roadmap**

| Phase | Timeline | Deliverable |
| :---- | :---- | :---- |
| Phase 0 — Discovery | Weeks 1–2 | Requirements finalised, architecture approved, dev environment set up, Universal Integration framework designed |
| **Phase 1 — Universal Integration Foundation** | Weeks 3–5 | Universal Integration Layer, Event Normalizer, Integration Registry, Health Monitor, Universal Event Schema, REST API Gateway, all four integration methods operational |
| Phase 2 — Identity & Authorisation | Weeks 6–8 | Identity & Device Registry, Three-Layer Authorisation Engine, Group & Privilege Assignment engine, account/device/network zone management, Admin operator model |
| **Phase 3 — Resource Registry & Monitor** | Weeks 9–11 | Resource Registry, ownership lifecycle model, ACL engine, inheritance engine, time-based restrictions, tamper-evident audit log store (TimescaleDB), view/edit history |
| Phase 4 — Alerting & Notification | Weeks 12–13 | Alert Manager, complete severity matrix with escalation rules, Notification Engine, unified Admin inbox, email/SMS/webhook delivery, green signals, automated session termination |
| **Phase 5 — Admin Dashboard** | Weeks 14–15 | Unified Admin dashboard, live session view, integration health panel, resource registry view, audit log search & export, emergency read-only view |
| Phase 6 — Hardening & QA | Weeks 16–17 | Security testing, penetration test, performance benchmarking, silent system testing, log integrity verification, multi-tenant isolation testing |
| **Phase 7 — Beta Release** | Week 18 | Closed beta with pilot organisations, feedback collection |
| **v2.0 GA Release** | **Week 21** | General availability with full documentation, SDK, and support |

# **14\. Success Metrics (KPIs)**

| KPI | Definition | Target (6 months post-launch) |
| :---- | :---- | :---- |
| Alert Accuracy | % of CRITICAL alerts that are true positives | \> 90% |
| Mean Time to Alert | Time from anomalous event to alert delivery | \< 10 seconds |
| Integration Time | Time for any new system to be fully integrated | \< 30 minutes |
| False Positive Rate | % of alerts that are false alarms | \< 10% |
| Log Query Performance | Time to return results on audit log search | \< 3 seconds |
| Integration Coverage | % of target system types with working connectors | \> 95% |
| Customer Satisfaction | NPS from pilot organisations | \> 40 |

# **15\. Risks & Mitigations**

| Risk | Likelihood | Impact | Mitigation |
| :---- | :---- | :---- | :---- |
| R1 — High false-positive rate degrades Admin trust | Medium | High | Tunable thresholds; escalation rules; ML-based baselining planned v2.1 |
| R2 — Agent causes performance overhead on monitored hosts | Low | High | Lightweight async event-forwarding; tested under load; agent resource cap |
| R3 — Log store becomes high-value attack target | Medium | Critical | Air-gapped backup; HMAC signatures; Admin-only access; deletion attempts trigger CRITICAL alert |
| R4 — Integration complexity slows adoption | Medium | Medium | Pre-built connectors; open-source SDK; 30-min target; detailed integration docs |
| R5 — Regulatory non-compliance in certain jurisdictions | Low | High | Configurable retention; cold storage archiving; legal review before launch per region |
| R6 — Universal Integration Layer: single point of failure | High | Critical | Redundant active-active deployment; Event Bus buffers during degradation; Integration Layer itself monitored; mutual TLS on all endpoints; isolated network segment |
| R7 — Admin account compromise \= total system compromise | Low | Critical | MFA mandatory (non-negotiable); session timeout; all actions logged; unrecognised device/network triggers CRITICAL alert; offline recovery key; 3-fail lockout |
| R8 — Audit log storage growth over time | High | Medium | Hot/cold storage tiering; compression on archive; HMAC preserved; storage threshold alerts; export before archive option |
| R9 — False CRITICAL alerts from legitimate system silence | Medium | Medium | Configurable silence threshold per system; maintenance window scheduling (MFA required); baseline activity profiling; degraded warning before CRITICAL |
| R10 — Misconfigured ACL inheritance propagates incorrectly | Medium | High | Inheritance OFF by default; Admin preview of impact before applying; child can override; inheritance change requires Admin confirmation; fully logged |
| R11 — Over-restriction at scale from group conflicts | Medium | Medium | Admin notified on every conflict trigger; conflict frequency dashboard; group membership review tools; all conflicts logged immutably |
| R12 — Mass resource lockout on bulk account revocation | Low | Critical | Pre-revocation warning shows owned resources; Admin can pre-assign ownership transfer; emergency bulk-unlock (Admin only, every unlock CRITICAL-logged); locked resources dashboard panel |
| R13 — Malicious event normalisation attack | Medium | High | Input validation before normalisation; malformed events rejected and logged; malicious pattern detection; normaliser sandboxed; failures trigger CRITICAL alert; rate limiting per source |
| R14 — Legitimate user frustration from generic denial | High | Low | Admin inbox shows full denial detail; optional contact info configurable; repeated denials escalate alert severity; denial frequency dashboard per user |

# **16\. Open Questions — All Resolved**

| \# | Question | Decision |
| :---- | :---- | :---- |
| OQ1 | Automated session termination in v2.0? | RESOLVED — Both monitor-alert AND automated termination included in v2.0. Auto-terminate configurable per policy. |
| OQ2 | Preferred audit log database technology? | RESOLVED — TimescaleDB. Free, open source, time-series optimised, built on PostgreSQL, handles 50,000 events/min, built-in hot/cold partitioning. |
| OQ3 | Agent open source or proprietary? | RESOLVED — Proprietary agent. SDK open source. Agent detection logic must not be exposed to potential attackers. |
| OQ4 | Multi-tenant or single-tenant for v2.0? | RESOLVED — Multi-tenant in v2.0. Complete data isolation per tenant at database level. Platform Super Admin manages tenant provisioning. |
| OQ5 | On-premise hardware minimum specification? | RESOLVED — 16-core CPU, 32GB RAM, 2TB NVMe SSD, 1Gbps network, Ubuntu 22.04 LTS. Cold storage via separate NAS or cloud object storage. |
| NQ1 | Admin account recovery mechanism? | RESOLVED — Offline recovery key \+ MFA re-verification both required. Recovery triggers CRITICAL alert. New key issued after each use. |
| NQ2 | SDK open source or proprietary? | RESOLVED — Open source. Exposes event forwarding interface only — no detection logic. Drives integration adoption. |
| NQ3 | Cold storage maximum retention period? | RESOLVED — Configurable per jurisdiction; default keep forever. Destruction requires Admin MFA \+ confirmation \+ CRITICAL audit entry. Metadata retained forever. |
| NQ4 | Maintenance window MFA re-verification? | RESOLVED — Yes, mandatory. Prevents session hijacking abuse of silence suppression. Post-window report generated. |
| NQ5 | Real-time streaming only or also batch ingestion? | RESOLVED — Both supported. Real-time default. Batch minimum 1-minute interval for legacy systems. Events timestamped with original log timestamp. |
| NQ6 | Emergency read-only Admin view in v2.0? | RESOLVED — Included. Separate URL/port, separate credentials, view-only, auto-expires 4 hours, access triggers CRITICAL alert, every action logged. |

# **17\. Glossary**

| Term | Definition |
| :---- | :---- |
| ACL (Access Control List) | A list specifying which users or roles are permitted to perform which actions on a given resource |
| Device Fingerprint | A unique identifier derived from hardware and software attributes of a device (MAC address, hostname, hardware IDs) |
| Universal Event Schema | The standardised data structure into which all raw events from any source are normalised before processing |
| Universal Integration Layer | The foundational architectural component that accepts events from all source types — Agent, REST API, Log Parser, and SDK |
| Three-Layer Verification | The mandatory sequential check of Account (Layer 1), Network Zone (Layer 2), and Device MAC (Layer 3\) before any session or resource action is permitted |
| Network Zone | A defined IP address range or subnet recognised as a trusted network segment |
| RBAC | Role-Based Access Control — permissions are assigned to roles (groups), and roles are assigned to users |
| SIEM | Security Information and Event Management — a platform that aggregates and correlates security log data |
| Tamper-Evident Log | A log whose entries are cryptographically signed (HMAC-SHA256) so any alteration is detectable |
| Indestructible Audit Log | An audit log that is permanently non-deletable by any role including Admin — deletion attempts are blocked and trigger a CRITICAL alert |
| Zero-Trust | A security model in which no user, device, or network is trusted by default — all access is continuously verified |
| Geo-fencing | Restricting system access based on the physical geographic location of the connecting device/IP |
| Alert Fatigue | The desensitisation of operators to alerts caused by excessive false-positive or low-priority notifications |
| Green Signal | An Admin inbox notification confirming a successful expected event — e.g., resource created, integration registered |
| Hot Storage | Fast-access audit log storage for recent data (default: last 365 days) — supports real-time search |
| Cold Storage | Archival audit log storage for data beyond hot storage threshold — compressed, HMAC-preserved, never deleted |
| Multi-Tenancy | A deployment mode where a single SecureWatch instance serves multiple organisations with complete data isolation between tenants |
| Most-Restrictive Rule | The group conflict resolution policy — when a user belongs to two groups with conflicting privileges, the more restrictive permission always wins |

**END OF DOCUMENT**

SecureWatch PRD v2.0  •  Confidential  •  March 2026