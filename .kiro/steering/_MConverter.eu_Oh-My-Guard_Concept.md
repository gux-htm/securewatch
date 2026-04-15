**OH-MY-GUARD**

**Comprehensive Security Platform**

Concept & Architecture Document

Multi-Layer Infrastructure Security Solution

Prepared for Team Review & Development Planning

Version 1.0 --- Concept Draft

> **1. EXECUTIVE OVERVIEW**

Oh-My-Guard is an enterprise-grade, multi-layer security platform designed to protect servers, the services hosted on them, and the internal networks that communicate with them. It simultaneously defends against external threats originating from the internet and internal threats originating from within the infrastructure.

The platform unifies multiple security disciplines --- Intrusion Detection, Intrusion Prevention, Firewalling, Endpoint Detection & Response, Network Detection & Response, Threat Intelligence, and SIEM --- into a single cohesive system, culminating in Extended Detection & Response (XDR) capability.

> **1.1 Core Mission**

- Protect servers and the services hosted on them (websites, databases, APIs, etc.) from external attackers.

- Monitor and secure internal networks and devices to eliminate insider threats.

- Provide a secure, encrypted communication channel for all device-to-server interactions.

- Grant fine-grained access control and privilege management across all users and devices.

- Detect, respond to, and log every security event across all layers in real time.

> **1.2 What Oh-My-Guard Protects**

|                    |                                                                               |
|--------------------|-------------------------------------------------------------------------------|
| **Asset Type**     | **Examples**                                                                  |
| Hosted Services    | Websites (frontend/backend), databases, REST APIs, file storage               |
| Servers            | Application servers, database servers, file servers within the infrastructure |
| Internal Networks  | Segmented networks (e.g., Finance, Marketing, HR) connected via VPN           |
| Registered Devices | Any endpoint registered to an internal network and granted server access      |

> **2. SYSTEM ARCHITECTURE --- SECURITY LAYERS**

Oh-My-Guard operates across five distinct security layers. Each layer adds an independent line of defense. An attacker must breach every layer to reach a protected asset.

|           |                          |                                                                                  |
|-----------|--------------------------|----------------------------------------------------------------------------------|
| **Layer** | **Name**                 | **Primary Role**                                                                 |
| **1**     | Network Perimeter        | Firewall, IPS, IDS --- blocks/detects all external traffic threats               |
| 2         | Web Application          | WAF, input sanitization, upload security, honeypots                              |
| **3**     | Internal Network         | VPN enforcement, device authentication, segmentation, firewall rules per network |
| 4         | Endpoint & Behavior      | EDR, session monitoring, privilege enforcement, file integrity monitoring        |
| **5**     | Intelligence & Analytics | NDR, SIEM, Threat Intelligence Feed --- cross-layer correlation and XDR          |

> **3. SECURITY COMPONENTS --- DETAILED BREAKDOWN**

Each component below operates at a specific layer and contributes to the overall XDR capability of Oh-My-Guard.

> **3.1 Firewall**

The Firewall is the first line of defense. It controls all traffic entering and leaving the network based on rule sets defined by administrators and network monitors.

**Scope & Operation**

- Admin manages the external firewall --- rules for all internet traffic interacting with services hosted on the protected server.

- Network Monitors manage internal firewall rules --- rules specific to their network segment, groups, or individual devices.

**Key Features**

- Stateful packet inspection --- tracks connection state, not just individual packets.

- Protocol enforcement --- enforces allowed communication protocols per network or device.

- Rule-based allow/deny --- admins define which traffic types, ports, and IPs are permitted.

- Per-network, per-group, and per-device rule granularity.

- Automatic IP blocking --- hostile IPs escalated by IDS/IPS are enforced at firewall level.

- Traffic logging --- all allowed and denied traffic is logged for SIEM correlation.

> **3.2 IDS --- Intrusion Detection System**

The IDS passively monitors all network traffic and system activity to identify suspicious patterns, known attack signatures, and policy violations. It does not block traffic --- it alerts.

**Scope & Operation**

- Admin uses IDS for external traffic --- detects threats arriving from the internet.

- Network Monitors use IDS for internal traffic --- detects anomalous behavior within their network segment.

**Key Features**

- Signature-based detection --- matches traffic/behavior against a library of known attack patterns (updated via Threat Intelligence Feed).

- Anomaly-based detection --- establishes baselines of normal behavior; deviations trigger alerts.

- Reconnaissance detection --- identifies port scans, banner grabbing, directory enumeration, and DNS enumeration.

- Web attack detection --- detects SQLi, XSS, SSRF, path traversal, file upload abuse, and more.

- Credential attack detection --- detects brute force, credential stuffing, session hijacking.

- Privilege escalation detection --- identifies sudo abuse, SUID exploitation, cron hijacking, kernel exploit attempts.

- Alert generation --- every detection produces a timestamped alert delivered to the relevant admin or network monitor.

- Device credential mismatch alert --- if a registered device\'s MAC, static IP, or digital signature fails to match, the network monitor is alerted. Complete mismatch triggers high alert.

> **3.3 IPS --- Intrusion Prevention System**

The IPS actively intercepts and blocks threats in real time, acting on detections made by the IDS and its own inline inspection engine. It sits inline with traffic and can drop, modify, or redirect packets instantly.

**Scope & Operation**

- Admin uses IPS for external threats --- auto-blocks hostile internet traffic.

- Network Monitors use IPS for their internal networks --- auto-blocks rogue or compromised devices.

**Key Features**

- Inline packet dropping --- malicious packets blocked before reaching the server.

- Automatic IP banning --- after threshold violations (e.g., 50 rapid probes), attacker IP is auto-banned.

- Rate limiting --- suspicious traffic is throttled (e.g., after 20 rapid 404s, rate-limited to 1 req/5 sec).

- Session termination --- active malicious sessions forcibly ended.

- Network quarantine --- if a device or host shows signs of compromise, it is isolated from the network immediately.

- Device removal --- network monitors can forcibly remove malicious or unrecognized devices from their network.

- Automated response escalation --- responses escalate from throttling → session kill → IP ban → quarantine based on threat severity.

> **3.4 WAF --- Web Application Firewall**

The WAF operates at Layer 7 (application layer), inspecting HTTP/HTTPS traffic specifically targeting web services. It protects the hosted applications from web-specific attack classes.

**Key Features**

- SQL injection blocking --- detects and blocks SQLi payloads; returns convincing fake database responses to deceive attacker.

- XSS prevention --- script-pattern detection, Content Security Policy enforcement, HttpOnly cookie flags.

- SSRF prevention --- blocks requests to internal IP ranges, cloud metadata endpoints (169.254.169.254), and localhost.

- Path traversal prevention --- detects and rejects ../ sequences; enforces chroot jail for file access.

- File upload security --- magic byte verification, MIME type validation, strict extension allowlist, UUID renaming, antivirus scanning, noexec enforcement, sandboxed analysis.

- Deserialization protection --- dangerous serialization formats (Pickle, Java Object) rejected.

- Command injection prevention --- shell special characters stripped; all execution uses no-shell subprocess calls.

- Header sanitization --- all response headers stripped of version/software information.

- Banner falsification --- fake service banners returned to misled fingerprinting attempts.

- Honeypot integration --- fake admin panels, fake directories, fake config files served as traps for enumerating attackers.

> **3.5 EDR --- Endpoint Detection & Response**

EDR monitors activity at the endpoint level --- on the devices registered to internal networks. It tracks device behavior, enforces privilege controls, and responds to compromised endpoints.

**Key Features**

- Device registration & credential binding --- each device\'s MAC address, static IP, and digital signature are registered. All three must match on every connection.

- Multi-factor authentication (MFA) --- every user must pass MFA in addition to device credential verification before accessing the server.

- VPN enforcement --- all internal network communication occurs exclusively over VPN; no device communicates outside VPN.

- Session monitoring --- tracks login time, VPN connection time, server communication start and end time per device.

- Privilege enforcement --- each device has defined privileges per resource path (view, create, edit, delete, rename); operations outside granted privileges are blocked.

- Resource path control --- server resources (files, directories) are registered and assigned to specific devices or groups with specific privileges.

- File Integrity Monitoring (FIM) --- monitors registered resource paths; any unauthorized modification triggers an immediate alert.

- Activity history --- complete timestamped log of every action performed by a device on any resource.

- Anomalous process detection --- flags unexpected processes spawned on endpoints or servers.

- Container isolation --- web applications run in Docker with no-new-privileges; processes cannot escape container boundary.

- Kernel security --- Seccomp and AppARM or restrict syscalls available to application processes.

> **3.6 NDR --- Network Detection & Response**

NDR analyzes all network traffic flows across the entire infrastructure. While IDS looks at individual packets and signatures, NDR builds a behavioral picture of all traffic patterns and detects threats that span multiple sessions or timeframes.

**Key Features**

- Full traffic flow analysis --- captures and analyzes NetFlow, packet captures, and metadata across all network segments.

- Behavioral baseline modeling --- learns what normal traffic looks like for each network, device, and service; deviations trigger investigation.

- Lateral movement detection --- identifies unusual device-to-device or device-to-server communication patterns suggesting an attacker moving through the network.

- Encrypted traffic analysis --- inspects metadata of encrypted sessions to detect malicious patterns without decrypting content.

- Command & Control (C2) detection --- detects beaconing patterns, unusual outbound connections, and DNS tunneling that suggest malware communicating with external controllers.

- DDoS detection --- identifies volumetric attack patterns; integrates with IPS for automatic mitigation.

- Protocol anomaly detection --- flags use of unexpected protocols or ports per device or network segment.

- East-west traffic monitoring --- monitors traffic between internal networks, not just north-south internet traffic.

> **3.7 SIEM --- Security Information & Event Management**

The SIEM is the central log aggregation and correlation engine. Every other component feeds events into the SIEM. It connects the dots across all layers to identify attack campaigns that individual components might miss in isolation.

**Key Features**

- Centralized event collection --- collects logs from Firewall, IDS, IPS, WAF, EDR, NDR, VPN, and all registered devices.

- Real-time correlation --- applies correlation rules to detect attack sequences spanning multiple components (e.g., reconnaissance detected by IDS + login attempt detected by WAF + privilege escalation detected by EDR = coordinated attack campaign).

- Log panel --- a real-time event dashboard showing all monitored resource events, sortable by recency. Each file row displays the most recent event; clicking expands the full chronological event tree.

- Structured event records --- every event captures: event type, status (normal/moderate/critical), device, network, IP, MAC, digital signature, timestamp, and privileges active at the time.

- Threat hunting --- security staff can query historical logs to investigate potential incidents retroactively.

- Forensic audit trail --- immutable, tamper-evident log records for compliance and post-incident analysis.

- Alert prioritization --- events ranked by severity; critical alerts surface immediately to the relevant admin or monitor.

> **3.8 Threat Intelligence Feed**

The Threat Intelligence Feed continuously supplies Oh-My-Guard with up-to-date information about known threats --- IP reputation lists, malware signatures, attack patterns, CVEs, and indicators of compromise (IOCs).

**Key Features**

- Automatic signature updates --- IDS and WAF signature libraries updated in real time from threat feeds.

- IP reputation integration --- known malicious IPs, Tor exit nodes, and botnet IPs pre-blocked at the Firewall.

- CVE awareness --- the feed alerts the system when a CVE is published that affects running software versions; administrators are notified for patch prioritization.

- IOC matching --- indicators of compromise (file hashes, domains, IPs, URLs) from the feed are matched against all incoming traffic and file uploads.

- Breach credential database --- login attempts are checked against known breached credential databases to detect credential stuffing attacks.

- Geographic intelligence --- unusual login geographies (compared to device\'s known location history) trigger additional verification.

> **3.9 XDR --- Extended Detection & Response**

XDR is not a standalone component but the emergent capability that arises from the integration of EDR, NDR, and the Threat Intelligence Feed --- all unified through the SIEM. XDR provides a holistic, cross-layer view of threats and enables coordinated automated responses across all components simultaneously.

**How XDR Works in Oh-My-Guard**

- EDR contributes endpoint telemetry --- device behavior, process activity, file changes, session data.

- NDR contributes network telemetry --- traffic flows, lateral movement, C2 patterns.

- Threat Intelligence enriches all detections --- context about known adversary TTPs (Tactics, Techniques, Procedures).

- SIEM correlates across all three --- a single pane of glass showing the full attack picture.

- XDR orchestrates response --- a threat detected by NDR can automatically trigger EDR to quarantine the source endpoint, IPS to block the IP, and SIEM to escalate to the admin --- all in one coordinated action.

**XDR Benefits**

- Eliminates detection silos --- threats that evade one layer are caught by cross-layer correlation.

- Accelerates response --- automated playbooks trigger responses in milliseconds, not minutes.

- Reduces false positives --- cross-layer context means fewer alerts require human investigation.

- Complete attack visibility --- reconstructs the full kill chain from initial reconnaissance to privilege escalation.

> **4. USER HIERARCHY & ROLES**

Oh-My-Guard manages infrastructure security through a structured hierarchy of users, each with clearly defined responsibilities, capabilities, and access scopes. Every action taken within the system is tied to a role, ensuring accountability at every level.

> **4.1 Role Hierarchy Overview**

|           |                   |                                                         |                                                                                   |
|-----------|-------------------|---------------------------------------------------------|-----------------------------------------------------------------------------------|
| **Level** | **Role**          | **Scope**                                               | **Key Responsibilities**                                                          |
| 1         | Super Admin       | Entire Oh-My-Guard system                               | System configuration, all admin management, global policy                         |
| 2         | Admin             | External perimeter & all internal networks              | External firewall, IDS/IPS for internet traffic, overall infrastructure oversight |
| 3         | Network Monitor   | Assigned network segment(s)                             | Internal firewall, IDS/IPS per network, device management, privilege grants       |
| 4         | End Device / User | Their registered device and granted resource paths only | Interact with server via permitted actions (view/create/edit/delete/rename)       |

> **4.2 Super Admin**

The Super Admin is the highest authority within Oh-My-Guard. This role exists to manage the platform itself, not individual networks.

- Creates and manages Admin accounts.

- Configures global system settings and platform-wide security policies.

- Has visibility into all logs, all networks, and all alerts across the entire infrastructure.

- Cannot be locked out by any other role.

> **4.3 Admin**

The Admin is responsible for the security of the external perimeter --- all traffic arriving from the internet --- and has oversight authority over the entire internal infrastructure.

**External Responsibilities**

- Configures and manages the external Firewall --- defining rules for all internet traffic.

- Uses IDS for external threat detection --- port scans, web attacks, DDoS, reconnaissance.

- Uses IPS for external threat response --- auto-blocking hostile IPs, rate limiting, session termination.

- Manages honeypot infrastructure --- fake services, fake directories, OS fingerprint spoofing.

- Receives high-priority alerts for all external attack detections.

**Internal Oversight Responsibilities**

- Creates and manages Network Monitor accounts.

- Views consolidated SIEM dashboard across all networks.

- Sets infrastructure-wide security baselines (encryption standards, VPN policy, MFA requirements).

- Receives escalated alerts when network monitors fail to respond to critical threats.

> **4.4 Network Monitor**

Network Monitors are assigned to one or more internal network segments. They are responsible for the security and device management within their assigned networks.

**Device Management**

- Registers new devices to the network --- captures MAC address, assigns static IP, registers digital signature.

- Views device details --- MAC, IP, digital signature, registration date.

- Views device activity history --- complete chronological log of all server interactions.

- Views device sessions --- login time, VPN connection time, server communication windows.

- Grants and manages privileges for devices --- view, create, edit, delete, rename --- per resource path.

- Sets time-limited privileges --- access grants can have automatic expiry times.

- Removes malicious or unauthorized devices from the network.

**Security Responsibilities**

- Configures internal Firewall rules for their network segment.

- Sets firewall rules per group or per individual device.

- Uses IDS to monitor internal traffic for anomalies and threat signatures.

- Uses IPS to block rogue devices or suspicious internal sessions.

- Receives alerts when a device\'s credentials do not match --- IP mismatch, MAC mismatch, or digital signature mismatch.

- Receives high alert when all credentials of a device fail to match simultaneously.

**Group Management**

- Creates device groups within their network (e.g., Accounting Team within Finance Network).

- Assigns privileges at the group level --- all devices in the group inherit group privileges.

- Group-level firewall rules can be applied to enforce protocol and traffic restrictions per group.

> **4.5 End Device / User**

End devices are the registered client machines (laptops, workstations, servers) that interact with the protected server. They are the operational layer --- not security managers.

**How End Devices Interact with the System**

- Connect to VPN using registered credentials (MAC + static IP + digital signature).

- Authenticate via MFA after VPN connection.

- Interact with server exclusively through Oh-My-Guard\'s secure, encrypted communication interface.

- Can only perform operations on resource paths for which they have been granted privileges.

- All interactions are logged --- no action is unrecorded.

> **5. INTERNAL SECURITY --- HOW IT WORKS**

The internal security model of Oh-My-Guard governs everything that happens inside the infrastructure --- between registered devices and the protected servers.

> **5.1 Network Architecture**

- Multiple isolated network segments can be created (e.g., Finance, Marketing, HR, Engineering).

- Each network segment is independent --- devices in Finance cannot communicate with devices in Marketing unless explicitly permitted.

- All network communication is carried exclusively over VPN --- no unencrypted or non-VPN communication is permitted.

- Each network has an assigned Network Monitor responsible for its security.

> **5.2 Device Registration & Authentication**

Before any device can access the internal network or interact with the server, it must be registered. Registration is a one-time process performed by the Network Monitor.

**Registration Process**

1.  Network Monitor captures the device\'s MAC address.

2.  A static IP address is assigned to the device within the network.

3.  A digital signature is generated and registered for the device.

4.  These three form the device\'s credential set.

**Authentication on Every Connection**

5.  Device connects to VPN.

6.  System automatically checks: MAC address matches registered MAC, static IP matches registered IP, digital signature matches registered signature.

7.  If all three match: device proceeds to MFA login.

8.  If any one credential fails: Network Monitor is alerted --- partial credential mismatch.

9.  If all three credentials fail: Network Monitor receives HIGH ALERT --- possible rogue device or impersonation attempt.

10. User completes MFA authentication to gain full server access.

> **5.3 Resource Path System**

Server resources --- files, directories, and their contents --- are registered as Resource Paths. Access to these resources is controlled at a granular privilege level.

**Privilege Types**

- View --- device can open and read the resource.

- Create --- device can create new files or subdirectories within the resource path.

- Edit --- device can modify existing files within the resource path.

- Delete --- device can delete files within the resource path.

- Rename --- device can rename files or directories within the resource path.

**Privilege Assignment**

- Privileges are assigned by Network Monitors per device per resource path.

- Group-level privileges can be set --- all devices in a group inherit the group\'s privileges.

- Privileges can be time-limited --- automatically expire after a set duration.

- A device can have different privileges on different resource paths simultaneously.

> **5.4 Encrypted Communication Channel**

- All device-to-server communication is encrypted end-to-end.

- Even if an attacker captures the communication, the content is unreadable without the decryption keys.

- Protocol enforcement --- specific communication protocols are enforced per network/device; unauthorized protocols are blocked.

- File transfer restrictions --- certain devices may be restricted from downloading, copying, or sending files to the server.

- The secure interface provides all server interaction capabilities: file creation, editing, viewing, deletion, and transfer.

> **5.5 Event Logging & Log Panel**

Every interaction between a registered device and a server resource is logged with full detail.

**Event Record Structure**

|                   |                                                                            |
|-------------------|----------------------------------------------------------------------------|
| **Field**         | **Description**                                                            |
| Event             | Action performed --- Viewed, Created, Edited, Deleted, Renamed             |
| Status            | Severity classification --- Normal, Moderate, or Critical                  |
| Device            | Identifier of the device that performed the action                         |
| Network           | Network segment the device belongs to                                      |
| IP                | Current IP of the device at the time of the event                          |
| MAC               | Current MAC address of the device at the time of the event                 |
| Digital Signature | Digital signature of the device at the time of the event                   |
| Timestamp         | Exact date and time of the event                                           |
| Privileges        | Privileges active for the device on this resource at the time of the event |

**Log Panel Behavior**

- The log panel displays a row for each monitored resource (file or directory).

- Each row shows the most recent event for that resource.

- When a new event occurs on a resource, that resource\'s row moves to the top of the panel.

- Clicking the expand arrow on any row reveals the full chronological event tree --- every event ever recorded for that resource, in sequence.

> **6. EXTERNAL SECURITY --- DEFENSE AGAINST OUTSIDE THREATS**

Oh-My-Guard defends against the full attack kill chain for external threats. The system intercepts and responds at every stage of an attack, from initial reconnaissance through to privilege escalation attempts.

> **6.1 The Attack Kill Chain --- Oh-My-Guard\'s Interception Points**

|                      |                                                      |                                                                        |
|----------------------|------------------------------------------------------|------------------------------------------------------------------------|
| **Kill Chain Stage** | **Attacker\'s Goal**                                 | **Oh-My-Guard Response**                                               |
| Reconnaissance       | Discover open ports, services, software versions     | Honeypots, OS spoofing, port silencing, IP flagging                    |
| Weaponization        | Craft exploit payloads using discovered info         | Banner falsification, metadata stripping limit attacker information    |
| Delivery             | Send malicious payload to the server                 | WAF, IPS, Firewall intercept and block delivery vectors                |
| Exploitation         | Trigger vulnerability (SQLi, XSS, file upload, etc.) | WAF rules, input sanitization, sandbox analysis, parameterized queries |
| Installation         | Install web shell, malware, or backdoor              | Execution prevention (noexec), antivirus scan, FIM alert               |
| Command & Control    | Establish external control channel                   | NDR detects C2 beaconing; IPS blocks outbound C2 traffic               |
| Privilege Escalation | Gain root or admin access to the server              | Container isolation, seccomp, FIM, fake SUID honeypots, quarantine     |

> **6.2 Attack Category Summary**

Oh-My-Guard handles 32 documented external attack types across 6 categories:

|                                  |                                                                                                                  |
|----------------------------------|------------------------------------------------------------------------------------------------------------------|
| **Attack Category**              | **Attacks Covered**                                                                                              |
| Reconnaissance                   | Port scanning, banner grabbing, directory enumeration, DNS enumeration, OSINT/metadata harvesting                |
| Web Application Attacks          | Malicious file upload, MIME bypass, SQLi, Blind SQLi, XSS, XXE, SSRF, IDOR, path traversal, business logic abuse |
| Authentication & Session Attacks | Brute force, credential stuffing, session hijacking, JWT manipulation                                            |
| Post-Exploitation                | RCE, SSTI, insecure deserialization, command injection, formula injection                                        |
| Network & Infrastructure Attacks | DDoS on upload, MITM, DNS hijacking                                                                              |
| Privilege Escalation             | Vertical & horizontal privilege escalation, kernel exploits, SUID abuse, cron job hijacking                      |

> **7. SYSTEM ARCHITECTURE DIAGRAM**

The diagram below shows the complete layered structure of Oh-My-Guard --- from external internet traffic at the top, through each security layer, down to protected assets at the bottom. Each layer is independent; a threat must breach all layers to reach a protected asset.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>INTERNET / EXTERNAL TRAFFIC</strong></p>
<p>External attackers, web users, API consumers</p></td>
</tr>
<tr class="even">
<td><strong>▼</strong></td>
</tr>
<tr class="odd">
<td><p><strong>LAYER 1 — NETWORK PERIMETER</strong></p>
<p>External Firewall | IDS (External) | IPS (External) | Threat Intelligence Feed</p>
<p><em>Blocks hostile IPs, detects reconnaissance, intercepts and drops attack traffic</em></p></td>
</tr>
<tr class="even">
<td><strong>▼</strong></td>
</tr>
<tr class="odd">
<td><p><strong>LAYER 2 — WEB APPLICATION</strong></p>
<p>WAF | Honeypot Engine | File Upload Security | Header Sanitization | Rate Limiter</p>
<p><em>Blocks web-layer attacks: SQLi, XSS, SSRF, file upload abuse, path traversal, and more</em></p></td>
</tr>
<tr class="even">
<td><strong>▼</strong></td>
</tr>
<tr class="odd">
<td><p><strong>PROTECTED SERVER &amp; SERVICES</strong></p>
<p>Web Applications | Databases | APIs | File Storage</p></td>
</tr>
<tr class="even">
<td><strong>▼</strong></td>
</tr>
<tr class="odd">
<td><p><strong>LAYER 3 — INTERNAL NETWORK</strong></p>
<p>VPN Gateway | Internal Firewall (per network) | IDS (Internal) | IPS (Internal)</p>
<p><em>Device credential verification, network segmentation, protocol enforcement, internal threat detection</em></p></td>
</tr>
<tr class="even">
<td><strong>▼</strong></td>
</tr>
<tr class="odd">
<td><p><strong>LAYER 4 — ENDPOINT &amp; BEHAVIOR</strong></p>
<p>EDR | Session Monitor | File Integrity Monitor | MFA Engine | Resource Path Controller</p>
<p><em>Tracks device activity, enforces privileges, monitors file changes, isolates compromised endpoints</em></p></td>
</tr>
<tr class="even">
<td><strong>▼</strong></td>
</tr>
<tr class="odd">
<td><p><strong>LAYER 5 — INTELLIGENCE &amp; XDR</strong></p>
<p>NDR | SIEM | Threat Intelligence Feed | XDR Orchestration Engine</p>
<p><em>Cross-layer correlation, behavioral analytics, automated coordinated response, forensic audit trail</em></p></td>
</tr>
<tr class="even">
<td><strong>▼</strong></td>
</tr>
<tr class="odd">
<td><p><strong>INTERNAL DEVICES (END POINTS)</strong></p>
<p>Registered Devices on Internal Networks (Finance, Marketing, HR, etc.)</p></td>
</tr>
</tbody>
</table>

> **7.1 User Role Hierarchy Diagram**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>[ SUPER ADMIN ]</strong></p>
<p><em>Full system authority — platform configuration, global policy, all-network visibility</em></p>
<p><strong>▼</strong></p>
<p><strong>[ ADMIN ]</strong></p>
<p><em>External perimeter security — Firewall, IDS/IPS for internet traffic, honeypot management, infrastructure oversight</em></p>
<p><strong>▼</strong></p>
<p><strong>[ NETWORK MONITOR ]</strong></p>
<p><em>Per-network security — internal Firewall, IDS/IPS, device registration, privilege management, group management</em></p>
<p><strong>▼</strong></p>
<p><strong>[ END DEVICE / USER ]</strong></p>
<p><em>VPN + MFA authenticated access — interacts with server via encrypted channel within granted privileges only</em></p></td>
</tr>
</tbody>
</table>

> **8. LIVE SCENARIO --- COMPLETE SYSTEM RESPONSE**

The following scenario demonstrates how Oh-My-Guard behaves across all layers when a determined external attacker attempts to breach a server hosting a file management website. The scenario traces the attack kill chain from initial reconnaissance through attempted privilege escalation --- showing how each layer responds, how the system survives, and how the protected assets remain safe.

> **Scenario Setup**

|                  |                                                                                         |
|------------------|-----------------------------------------------------------------------------------------|
| **Element**      | **Description**                                                                         |
| Protected Server | Hosts a web application where users can upload, view, and edit records stored as files  |
| Internal Network | Finance Network --- 12 registered devices, monitored by a Network Monitor               |
| Attacker Profile | External threat actor with no prior access, goal: gain root-level control of the server |
| Attacker\'s Plan | Reconnaissance → Web attack → Shell upload → Lateral movement → Privilege escalation    |

> **Stage 1: Reconnaissance --- Attacker Scans the Server**

The attacker runs an Nmap scan targeting the server to discover open ports, running services, and the operating system.

**IDS Response (Layer 1)**

- Rapid SYN packets across multiple ports detected within milliseconds.

- IDS identifies the pattern as a port scan --- attack signature matched against Threat Intelligence Feed database.

- Alert generated: \"Port scan reconnaissance detected from IP 203.0.113.45.\"

- IP is immediately tagged as hostile in the threat registry.

**IPS Response (Layer 1)**

- Attacker\'s IP escalated to hostile tier --- all subsequent requests subjected to maximum scrutiny.

- Real service ports enter stealth mode --- no response to probe packets (ports appear closed).

- Honeypot services activated: fake SSH on port 22, fake database on port 3306, fake admin panel on port 8080.

- OS fingerprint spoofing enabled --- system reports a different OS to mislead attacker.

**SIEM & Threat Intel Response (Layer 5)**

- Reconnaissance event logged with full details: attacker IP, timestamp, scan type, ports probed.

- Threat Intelligence Feed confirms 203.0.113.45 is a known scanner associated with previous attack campaigns.

- Admin receives high-priority alert on dashboard.

RESULT: The attacker sees a honeypot environment. Real services are invisible. They have no useful information.

> **Stage 2: Web Application Attack --- SQL Injection Attempt**

The attacker interacts with the honeypot admin panel, discovers the web application, and attempts SQL injection on the record upload search field.

**WAF Response (Layer 2)**

- SQL injection pattern detected in the input field: \' OR \'1\'=\'1.

- WAF rule triggers --- request blocked before reaching the database.

- Instead of an error (which would confirm the vulnerability), a convincing fake dataset of dummy user records is returned --- completely false data.

- Attacker does not know the injection was blocked; the fake response suggests the application is vulnerable.

**IDS/IPS Response (Layer 1)**

- SQLi attempt logged against attacker IP --- IP tier upgraded from hostile to critical.

- Admin alert: \"SQL injection attempt detected from IP 203.0.113.45 --- exact payload logged.\"

**SIEM (Layer 5)**

- SIEM correlates: same IP performed reconnaissance (Stage 1) + SQLi (Stage 2) = active attack campaign confirmed.

- XDR escalation: NDR begins deep traffic inspection for all traffic from this IP across all protocols.

RESULT: Database is untouched. Attacker believes they extracted data, but received fake records. Their IP is now under maximum surveillance.

> **Stage 3: Malicious File Upload --- Web Shell Attempt**

The attacker, believing the system is vulnerable, attempts to upload a PHP web shell disguised as a JPEG image file (shell.php.jpg).

**WAF / File Upload Security Response (Layer 2)**

- File extension allowlist check: .jpg is permitted --- initial check passes.

- Magic byte verification: file header does not match JPEG signature (FF D8 FF) --- actual header matches PHP script. Upload rejected.

- Filename sanitization: even if the extension had passed, the file would have been renamed to a random UUID --- attacker cannot predict the path.

- Antivirus scan (ClamAV): file scanned before any storage consideration --- web shell signature detected.

- The upload directory has the noexec filesystem flag --- even if a script were stored, it cannot execute.

- File hash (SHA-256) logged for forensic records.

**Sandbox Analysis (Layer 2/4)**

- Suspicious file detonated in an isolated sandbox environment.

- Sandbox confirms malicious behavior --- shell execution attempt within sandbox logged.

- Admin alert: \"Web shell upload attempt detected and blocked --- file quarantined in sandbox.\"

**Honeypot Response (Layer 2)**

- A fake version of the shell is served to the attacker, appearing to execute successfully.

- The \"shell\" connects the attacker to a fake OS environment --- every command entered by the attacker is logged.

- Attacker believes they have code execution; in reality they are operating in an isolated deception environment.

RESULT: No web shell reached the real server. Attacker is in a honeypot, unknowingly providing intelligence about their post-exploitation techniques.

> **Stage 4: Attempted Command Execution & Lateral Movement**

Inside the honeypot, the attacker runs commands attempting to map the internal network and move laterally.

**NDR Response (Layer 5)**

- NDR detects unusual outbound connection attempts from the honeypot environment toward internal IP ranges.

- Traffic flows flagged: honeypot attempting to reach internal network segments (Finance Network, Marketing Network).

- All lateral movement traffic is silently dropped --- the honeypot is fully isolated from real internal segments.

- NDR alert: \"Lateral movement attempt detected --- attacker attempting internal network reconnaissance.\"

**XDR Orchestration (Layer 5)**

- XDR correlates: port scan (Stage 1) + SQLi (Stage 2) + shell upload (Stage 3) + lateral movement (Stage 4) = full kill chain attack confirmed.

- XDR triggers automated coordinated response: IPS permanently bans attacker IP at Firewall, all honeypot sessions from this IP are terminated, full forensic capture of all interaction logs initiated, admin receives incident report with complete attack timeline.

RESULT: The attacker\'s IP is permanently blocked. All lateral movement attempts failed. The complete attack timeline is preserved for forensic analysis.

> **Stage 5: Privilege Escalation Attempt (If Attacker Had Reached the Real System)**

In this hypothetical final stage, we demonstrate what would happen if the attacker had somehow bypassed all previous layers and obtained a low-privilege shell on the real server.

**EDR Response (Layer 4)**

- Anomalous process spawned by the web application user (www-data) --- process tree flagged immediately.

- Process attempts to find SUID binaries: find / -perm -4000. Regular SUID audit has already removed all non-essential SUID bits. Fake SUID honeypot binaries are discovered --- execution of any fake binary triggers an immediate admin alert.

- Process attempts sudo -l to check permissions --- www-data has zero sudo privileges.

- Every shell command matching privilege escalation patterns (find, sudo -l, id, whoami, uname -r) triggers EDR alerts.

**Container Isolation (Layer 4)**

- Web application runs inside a Docker container with the no-new-privileges flag --- privilege escalation within the container is structurally impossible.

- Seccomp profile restricts available kernel syscalls --- kernel exploit attempts fail at the syscall level.

- AppArmor profile confines the process to its authorized file paths only.

**File Integrity Monitoring (Layer 4)**

- Attacker attempts to modify a cron script to execute malicious code as root.

- FIM detects the modification attempt instantly --- admin and Network Monitor alerted within seconds.

- Cron scripts are owned by root and not writable by the web application user --- modification fails at the OS permission level.

**Network Quarantine (Layer 3/5)**

- EDR escalation triggers automatic network quarantine of the affected server segment.

- Server is isolated from all internal network communication --- no further lateral movement is possible.

- Forensic memory dump and disk snapshot initiated automatically.

- System rollback triggered --- server restored to last known-clean snapshot.

RESULT: Even with a foothold on the real system, the attacker cannot escalate privileges, cannot move laterally, and the server is automatically recovered. The complete attack is documented for forensic analysis, and all layers are re-armed.

> **Scenario Summary**

|                      |                                    |                                           |                                              |
|----------------------|------------------------------------|-------------------------------------------|----------------------------------------------|
| **Attack Stage**     | **Layer Engaged**                  | **Attacker Outcome**                      | **System Outcome**                           |
| Reconnaissance       | Layer 1 --- IDS/IPS + Threat Intel | Sees only honeypots                       | Attacker IP flagged; real ports hidden       |
| SQL Injection        | Layer 2 --- WAF                    | Receives fake data; unaware attack failed | Database untouched; payload logged           |
| Web Shell Upload     | Layer 2 --- File Upload Security   | Lands in honeypot fake shell              | No real shell on server; attacker monitored  |
| Lateral Movement     | Layer 5 --- NDR + XDR              | All attempts silently dropped             | IP permanently banned; full forensic capture |
| Privilege Escalation | Layer 4 --- EDR + Container        | Cannot escalate --- no SUID, no sudo      | Server quarantined and restored              |
