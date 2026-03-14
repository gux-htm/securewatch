# 🛡 SecureWatch — UI Design Document
### Version 1.0 | March 2026 | CONFIDENTIAL

---

> **Document Purpose:**
> This document defines the complete user interface design for the SecureWatch Admin Dashboard. It covers every screen, layout, component, interaction pattern, colour system, typography, and responsive behaviour required to build the frontend from scratch.
>
> **Audience:** Frontend engineers, UI/UX reviewers, product stakeholders.
>
> **Based On:** SecureWatch PRD v2.0 + TDD v1.0

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Design System](#2-design-system)
3. [Global Layout & Navigation](#3-global-layout--navigation)
4. [Screen 1 — Login & MFA](#4-screen-1--login--mfa)
5. [Screen 2 — Unified Admin Inbox](#5-screen-2--unified-admin-inbox)
6. [Screen 3 — Live Session View](#6-screen-3--live-session-view)
7. [Screen 4 — Resource Registry](#7-screen-4--resource-registry)
8. [Screen 5 — Integration Health Dashboard](#8-screen-5--integration-health-dashboard)
9. [Screen 6 — Audit Log Search & Export](#9-screen-6--audit-log-search--export)
10. [Screen 7 — Account Management](#10-screen-7--account-management)
11. [Screen 8 — Device Management](#11-screen-8--device-management)
12. [Screen 9 — Network Zones](#12-screen-9--network-zones)
13. [Screen 10 — Groups & Privileges](#13-screen-10--groups--privileges)
14. [Screen 11 — Settings & Notifications](#14-screen-11--settings--notifications)
15. [Screen 12 — Emergency Read-Only View](#15-screen-12--emergency-read-only-view)
16. [Global Components](#16-global-components)
17. [Interaction & Motion Principles](#17-interaction--motion-principles)
18. [Accessibility Requirements](#18-accessibility-requirements)
19. [Responsive Behaviour](#19-responsive-behaviour)
20. [Error & Empty States](#20-error--empty-states)

---

## 1. Design Philosophy

### 1.1 Core Principles

SecureWatch is a **security operations tool** — not a consumer product. Every design decision must serve operational efficiency, threat visibility, and cognitive clarity under pressure.

| Principle | Meaning in Practice |
|---|---|
| **Clarity Over Decoration** | No gratuitous animations, gradients, or visual noise. Every pixel must earn its place. |
| **Severity is Always Visible** | CRITICAL alerts must be visually impossible to miss — even with peripheral vision. |
| **Zero Ambiguity** | Labels, states, and statuses must be explicit. Never rely on colour alone to convey meaning. |
| **Speed First** | The Admin must be able to triage an alert within 10 seconds of opening the inbox. |
| **Minimal Click Depth** | No critical action should require more than 3 clicks from the dashboard. |
| **Information Density** | This is a professional tool — pack meaningful data. Avoid excessive whitespace. |

### 1.2 Design Tone

```
Dark-themed interface        — reduces eye strain during long monitoring sessions
High contrast severity colours — CRITICAL red is never ambiguous
Monospaced fonts for data    — IPs, UUIDs, timestamps always in monospace
Iconography is supplemental  — icons never replace text labels
```

---

## 2. Design System

### 2.1 Colour Palette

#### Base Colours

| Token | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#0D1117` | Main application background |
| `--bg-secondary` | `#161B22` | Sidebar, cards, panels |
| `--bg-tertiary` | `#21262D` | Table rows, input fields |
| `--bg-hover` | `#2D333B` | Hover states on rows/items |
| `--border` | `#30363D` | All borders and dividers |
| `--text-primary` | `#E6EDF3` | Primary body text |
| `--text-secondary` | `#7D8590` | Labels, metadata, timestamps |
| `--text-muted` | `#484F58` | Placeholder text, disabled states |

#### Severity Colours — Non-Negotiable

| Severity | Background | Text | Border | Usage |
|---|---|---|---|---|
| `CRITICAL` | `#3D0000` | `#FF4444` | `#FF4444` | Badges, alert rows, banners |
| `HIGH` | `#2D1A00` | `#FF8C00` | `#FF8C00` | Badges, alert rows |
| `MEDIUM` | `#2D2500` | `#FFD700` | `#FFD700` | Badges, alert rows |
| `LOW` | `#001A2D` | `#4FC3F7` | `#4FC3F7` | Badges, alert rows |
| `INFO` | `#1A1A2D` | `#9E9EF5` | `#9E9EF5` | Badges, alert rows |
| `GREEN` | `#001A00` | `#00C853` | `#00C853` | Green signal badges |

#### Status Colours — Integration Health

| Status | Colour | Hex |
|---|---|---|
| Active | Green | `#00C853` |
| Degraded | Amber | `#FF8C00` |
| Silent | Red | `#FF4444` |
| Disconnected | Grey | `#484F58` |

#### Brand Accent

| Token | Hex | Usage |
|---|---|---|
| `--accent-blue` | `#2E75B6` | Primary buttons, links, active nav |
| `--accent-blue-hover` | `#1B5994` | Hover on primary buttons |
| `--accent-blue-subtle` | `#0D2137` | Subtle highlight backgrounds |

### 2.2 Typography

```css
/* Primary font — UI labels, body text */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Monospace font — IPs, UUIDs, timestamps, log data, code */
font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
```

#### Type Scale

| Token | Size | Weight | Usage |
|---|---|---|---|
| `--text-xs` | 11px | 400 | Timestamps, metadata |
| `--text-sm` | 13px | 400 | Table rows, body |
| `--text-base` | 14px | 400 | Default body |
| `--text-md` | 16px | 500 | Section headers |
| `--text-lg` | 20px | 600 | Page titles |
| `--text-xl` | 24px | 700 | Dashboard counters |
| `--text-2xl` | 32px | 700 | KPI numbers |

### 2.3 Spacing System

```
4px  — micro spacing (icon gaps, tight padding)
8px  — small spacing (button padding, tag gaps)
12px — default inner padding
16px — card padding, list item height
24px — section gaps
32px — major section separation
48px — page-level margins
```

### 2.4 Elevation & Shadows

```css
/* Cards and panels */
box-shadow: 0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.6);

/* Modals and drawers */
box-shadow: 0 8px 32px rgba(0,0,0,0.6);

/* Dropdowns */
box-shadow: 0 4px 16px rgba(0,0,0,0.5);
```

### 2.5 Border Radius

```
4px  — buttons, badges, inputs
6px  — cards, table containers
8px  — modals, panels
0px  — table rows (sharp edges)
```

### 2.6 Core UI Components

#### Severity Badge
```
┌──────────────┐
│  ● CRITICAL  │  bg: #3D0000, text: #FF4444, border: 1px solid #FF4444
└──────────────┘
┌──────────┐
│  ● HIGH  │  bg: #2D1A00, text: #FF8C00, border: 1px solid #FF8C00
└──────────┘
```

#### Status Pill
```
┌─────────────┐
│  ● Active   │  dot: #00C853, text: --text-primary
└─────────────┘
┌──────────────┐
│  ● Degraded  │  dot: #FF8C00, text: --text-primary
└──────────────┘
┌────────────┐
│  ● Silent  │  dot: #FF4444, text: --text-primary
└────────────┘
```

#### Primary Button
```
┌─────────────────────┐
│    + Add Account    │  bg: #2E75B6, text: white, radius: 4px
└─────────────────────┘
hover → bg: #1B5994
```

#### Danger Button
```
┌───────────────────────┐
│  ⊘ Terminate Session  │  bg: transparent, border: #FF4444, text: #FF4444
└───────────────────────┘
hover → bg: #3D0000
```

#### Input Field
```
┌──────────────────────────────────┐
│  Search accounts...              │  bg: #21262D, border: #30363D
└──────────────────────────────────┘
focus → border: #2E75B6
```

---

## 3. Global Layout & Navigation

### 3.1 Application Shell

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                                  │
│  🛡 SecureWatch          [Tenant: Acme Corp ▾]    [🔔 3]  [Admin ▾]    │
├──────────────┬──────────────────────────────────────────────────────────┤
│              │                                                           │
│   SIDEBAR    │                  MAIN CONTENT AREA                       │
│   (220px)    │                                                           │
│              │                                                           │
│  ● Inbox     │                                                           │
│    Sessions  │                                                           │
│    Resources │                                                           │
│    Integrat. │                                                           │
│  ─────────── │                                                           │
│    Accounts  │                                                           │
│    Devices   │                                                           │
│    Zones     │                                                           │
│    Groups    │                                                           │
│  ─────────── │                                                           │
│    Audit Log │                                                           │
│    Settings  │                                                           │
│              │                                                           │
└──────────────┴──────────────────────────────────────────────────────────┘
```

### 3.2 Topbar

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🛡 SecureWatch   │   Tenant: Acme Corp ▾   │  ●●● 3 CRITICAL    🔔   │
│                   │                          │  [Admin]  [Sign Out]     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Topbar elements — left to right:**

| Element | Detail |
|---|---|
| Logo + name | `🛡 SecureWatch` — links to Inbox |
| Tenant selector | Dropdown — Platform Super Admin only; hidden for single-tenant Admin |
| Critical counter | Red pill showing count of unacknowledged CRITICAL alerts — always visible |
| Notification bell | Shows total unread count — click opens slide-over panel |
| Admin menu | Avatar/name → Profile, MFA settings, Sign Out |

### 3.3 Sidebar Navigation

```
┌──────────────────────┐
│  MONITOR             │  ← Section label (muted, uppercase, 11px)
│                      │
│  🔔 Inbox        [3] │  ← Active state: left accent bar + bg highlight
│  👁 Sessions         │
│  📁 Resources        │
│  🔌 Integrations     │
│                      │
│  ──────────────────  │  ← Divider
│                      │
│  MANAGE              │
│                      │
│  👤 Accounts         │
│  💻 Devices          │
│  🌐 Network Zones    │
│  👥 Groups           │
│                      │
│  ──────────────────  │
│                      │
│  AUDIT               │
│                      │
│  📋 Audit Log        │
│  ⚙  Settings        │
│                      │
└──────────────────────┘
```

**Active nav item:**
```
│ ▌ 🔔 Inbox        [3] │
  ↑
  3px solid #2E75B6 left border
  bg: #0D2137
```

**Badge on nav item:**
```
[3]  →  small pill, bg: #FF4444, text: white, min-width: 18px
```

### 3.4 CRITICAL Alert Banner

When one or more CRITICAL alerts are unacknowledged, a persistent banner appears directly below the topbar:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠  3 CRITICAL alerts require immediate attention    [View All]  [✕]   │
│     bg: #3D0000, border-bottom: 2px solid #FF4444                      │
└─────────────────────────────────────────────────────────────────────────┘
```

This banner cannot be permanently dismissed — it disappears only when all CRITICAL alerts are acknowledged.

---

## 4. Screen 1 — Login & MFA

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         bg: #0D1117                                      │
│                                                                          │
│                    ┌──────────────────────────┐                         │
│                    │    🛡 SecureWatch         │                         │
│                    │   Intelligent Security    │                         │
│                    │   Monitoring System       │                         │
│                    │                           │                         │
│                    │   Admin Login             │  ← Page title          │
│                    │   ─────────────────────   │                         │
│                    │                           │                         │
│                    │   Username                │                         │
│                    │   ┌─────────────────────┐ │                         │
│                    │   │                     │ │                         │
│                    │   └─────────────────────┘ │                         │
│                    │                           │                         │
│                    │   Password                │                         │
│                    │   ┌─────────────────────┐ │                         │
│                    │   │                     │ │                         │
│                    │   └─────────────────────┘ │                         │
│                    │                           │                         │
│                    │   ┌─────────────────────┐ │                         │
│                    │   │  Continue →          │ │  ← Primary button      │
│                    │   └─────────────────────┘ │                         │
│                    │                           │                         │
│                    │   ─────────────────────   │                         │
│                    │   🔒 All sessions are     │                         │
│                    │   monitored and logged    │                         │
│                    └──────────────────────────┘                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 MFA Step (Step 2)

After credential verification, the login card transitions to MFA entry:

```
│                    │   Two-Factor Authentication  │
│                    │   ──────────────────────────  │
│                    │                               │
│                    │   Open your authenticator app │
│                    │   and enter the 6-digit code. │
│                    │                               │
│                    │   ┌────┐ ┌────┐ ┌────┐        │
│                    │   │    │ │    │ │    │        │  ← 6 individual digit inputs
│                    │   └────┘ └────┘ └────┘        │    auto-advance on entry
│                    │   ┌────┐ ┌────┐ ┌────┐        │
│                    │   │    │ │    │ │    │        │
│                    │   └────┘ └────┘ └────┘        │
│                    │                               │
│                    │   ┌───────────────────────┐   │
│                    │   │  Verify & Sign In →   │   │
│                    │   └───────────────────────┘   │
│                    │                               │
│                    │   Use backup code instead     │  ← text link
```

### 4.3 Failure States

**Single failure (LOW alert):**
```
│   ⚠ Invalid credentials. Please try again.         │
│     1 attempt recorded.                             │
```

**Second failure:**
```
│   ⚠ Invalid credentials. 1 more attempt before    │
│     account lockout.                               │
```

**Third failure (CRITICAL — account locked):**
```
│   🔴 Account locked due to repeated failures.      │
│      Contact your Platform Super Admin to unlock.  │
│      This event has been logged.                   │
```

### 4.4 Behaviour Rules

- No username enumeration — identical error message for wrong username vs wrong password
- MFA token field clears automatically after failed attempt
- No "Remember this device" option — every login requires full MFA
- Session expires after configurable inactivity (shown in Settings)
- Login page is the only unauthenticated page in the application

---

## 5. Screen 2 — Unified Admin Inbox

### 5.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Admin Inbox                            [Filter ▾]  [Mark All Read]    │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  CRITICAL  ──────────────────────────────────────────────────────────   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ● CRITICAL   C1 · Unregistered account login attempt             │   │
│  │   Account: unknown_user@domain.com  Device: MAC-A1:B2:C3:D4     │   │
│  │   Source IP: 192.168.4.22  Zone: UNKNOWN   2 min ago            │   │
│  │   [View Detail]  [Terminate Session]  [Acknowledge]              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ● CRITICAL   C4 · System silent: prod-db-01   (7 min)           │   │
│  │   Last event: 07:43:22 UTC  Threshold: 5 min                    │   │
│  │   [View Integration]  [Acknowledge]                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  HIGH  ──────────────────────────────────────────────────────────────   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ● HIGH   H1 · Unrecognised device   john.doe@corp.com            │   │
│  │   Device: MAC-F1:E2:D3:C4 (unregistered)  09:12:44 UTC          │   │
│  │   [View Account]  [Whitelist Device]  [Acknowledge]              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  MEDIUM  ────────────────────────────────────────────────────────────   │
│  LOW  ───────────────────────────────────────────────────────────────   │
│  INFO / GREEN SIGNALS  ─────────────────────────────────────────────   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Alert Row Anatomy

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Severity Badge]  [Alert Code]  ·  [Short Description]      [Time ago] │
│  [Key field 1]  [Key field 2]  [Key field 3]                            │
│  [Primary Action]  [Secondary Action]  [Acknowledge]         [⋮ More]  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Row states:**

| State | Visual |
|---|---|
| Unacknowledged | Left border: severity colour, background slightly elevated |
| Acknowledged | Left border: none, text: muted, badge: greyed |
| Grouped/Deduplicated | Collapsed row with `(×12 occurrences)` count |

### 5.3 Alert Detail Drawer

Clicking "View Detail" opens a right-side drawer (480px wide) without leaving the inbox:

```
┌──────────────────────────────────────┐
│  ✕          Alert Detail             │
│  ──────────────────────────────────  │
│                                      │
│  ● CRITICAL  C1                      │
│  Unregistered account login attempt  │
│                                      │
│  TIMELINE                            │
│  ─────────                           │
│  09:14:33 UTC  Event detected        │
│  09:14:33 UTC  Alert generated       │
│  09:14:34 UTC  SMS sent to Admin     │
│  09:14:34 UTC  Email dispatched      │
│  ─ Unacknowledged ─                  │
│                                      │
│  EVENT DETAIL                        │
│  ─────────────                       │
│  Account     unknown_user@domain.com │  ← monospace
│  Device      MAC-A1:B2:C3:D4        │  ← monospace
│  Source IP   192.168.4.22           │  ← monospace
│  Network     UNKNOWN ZONE           │
│  Failed At   Layer 1 — Account      │
│  Reason      Not in registry        │  ← Admin eyes only
│                                      │
│  RECOMMENDED ACTIONS                 │
│  ─────────────────                   │
│  ▸ Verify if this is an authorised   │
│    user attempting login             │
│  ▸ If unauthorised — terminate       │
│    session immediately               │
│  ▸ Register or block the account     │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  Terminate Session           │    │  ← danger button
│  └──────────────────────────────┘    │
│  ┌──────────────────────────────┐    │
│  │  Acknowledge                 │    │  ← secondary button
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

### 5.4 Filter Bar

```
[All Severities ▾]  [All Types ▾]  [Date Range ▾]  [Unacknowledged only ☑]
```

### 5.5 Green Signal Row

Green signals appear at the bottom of the inbox in a collapsed section:

```
│  ✓ GREEN SIGNALS  ──────────────────────────────────────────── [3] ▾  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  ✓ GREEN   Resource created: quarterly_report.pdf                 │ │
│  │    Created by: alice@corp.com  09:01:22 UTC                       │ │
│  │    [Grant Privileges]  [Dismiss]                                  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
```

---

## 6. Screen 3 — Live Session View

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Live Sessions              ● 247 active    ↻ Refreshes every 10s      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  [Search sessions...]   [Filter: All Systems ▾]  [Filter: Status ▾]   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Username          System       IP              Device     Status  │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ john.doe          prod-app-01  10.0.1.44       REG-✓     CLEAN  │   │
│  │ alice.smith       prod-db-01   10.0.1.81       REG-✓     CLEAN  │   │
│  │ unknown_user  ⚠  prod-app-01  192.168.4.22    UNREG-✗  CRIT   │   │
│  │ bob.jones         dev-server   10.0.2.12       REG-✓     CLEAN  │   │
│  │ svc_account       prod-api     10.0.1.55       REG-✓     CLEAN  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Showing 247 of 247 sessions    [Export CSV]                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Session Table Columns

| Column | Format | Notes |
|---|---|---|
| Username | text | Monospace; unknown accounts shown in red |
| System | text | Linked to Integration detail |
| Login Time | `HH:MM:SS UTC` | Monospace |
| Duration | `2h 14m` | Live counter |
| Source IP | `000.000.000.000` | Monospace; red if outside zones |
| Device | `REG-✓` / `UNREG-✗` | Green check or red cross |
| Risk Verdict | Pill badge | CLEAN / SUSPICIOUS / CRITICAL |
| Actions | `[⋮]` | Terminate, View Detail, Flag |

### 6.3 Row Risk Colouring

| Verdict | Row Background | Left Border |
|---|---|---|
| CLEAN | Default `--bg-secondary` | None |
| SUSPICIOUS | `#2D2000` | 3px `#FF8C00` |
| CRITICAL | `#2D0000` | 3px `#FF4444` |

### 6.4 Session Detail Drawer

Clicking any session row opens a detail drawer:

```
┌──────────────────────────────────────┐
│  ✕       Session Detail              │
│  ──────────────────────────────────  │
│                                      │
│  john.doe@corp.com                   │
│  ● CLEAN — All layers passed         │
│                                      │
│  VERIFICATION LAYERS                 │
│  ─────────────────                   │
│  ✓ Layer 1   Account verified        │
│  ✓ Layer 2   Network zone: CORP-LAN  │
│  ✓ Layer 3   Device: MacBook-JD-001  │
│                                      │
│  SESSION INFO                        │
│  ────────────                        │
│  System      prod-app-01             │
│  Login       09:02:11 UTC            │
│  Duration    2h 14m 33s              │
│  Source IP   10.0.1.44               │
│  MAC         A1:B2:C3:D4:E5:F6      │  ← monospace
│                                      │
│  RECENT RESOURCE ACCESS              │
│  ──────────────────────              │
│  09:14:21  READ   report_q3.xlsx     │
│  09:11:04  WRITE  notes.txt          │
│  09:02:22  READ   dashboard.html     │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  Terminate Session           │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

### 6.5 Live Indicator

A pulsing green dot and countdown timer show the refresh cycle:

```
● 247 active    ↻ Refreshes in 8s
```

When a new session appears mid-cycle, a subtle flash animation highlights the new row for 2 seconds.

---

## 7. Screen 4 — Resource Registry

### 7.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Resource Registry              [+ Register Resource]  [Filter ▾]       │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  [Search resources...]   [Type: All ▾]  [Owner: All ▾]  [Status: All ▾] │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Name              Type       Owner         Status    ACL         │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ 📄 report_q3.xlsx FILE       alice.smith   ACTIVE    3 users     │   │
│  │ 🗄 prod_database  DATABASE   svc_account   ACTIVE    5 users     │   │
│  │ 🔌 /api/v1/users  API        john.doe      LOCKED  ⚠ No owner   │   │
│  │ 📁 /docs/shared   DIRECTORY  bob.jones     ACTIVE    12 users    │   │
│  │ ⚙  billing-svc    SERVICE    alice.smith   ACTIVE    2 groups    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Showing 5 of 1,204 resources                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Resource Type Icons

| Type | Icon |
|---|---|
| FILE | 📄 |
| DIRECTORY | 📁 |
| DATABASE | 🗄 |
| TABLE | 📊 |
| API | 🔌 |
| SERVICE | ⚙ |
| NETWORK_SHARE | 🔗 |
| APPLICATION | 🖥 |
| CUSTOM | ⬡ |

### 7.3 Resource Detail Page

Clicking a resource opens a full detail page (not a drawer — resources are complex):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Registry                                                      │
│                                                                          │
│  📄 report_q3.xlsx                    ● ACTIVE    [Transfer Ownership]  │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │  OWNERSHIP              │  │  ACCESS CONTROL LIST (ACL)          │  │
│  │  ─────────              │  │  ─────────────────────────────────  │  │
│  │  Owner   alice.smith    │  │                                     │  │
│  │  Created 2026-03-01     │  │  alice.smith   READ WRITE DELETE    │  │
│  │  Type    FILE           │  │  john.doe      READ                 │  │
│  │  Parent  /docs/shared   │  │  finance-grp   READ EXPORT          │  │
│  │  Inherit OFF            │  │                                     │  │
│  │                         │  │  [+ Grant Access]                   │  │
│  └─────────────────────────┘  └─────────────────────────────────────┘  │
│                                                                          │
│  VIEW HISTORY                    (Admin eyes only)                       │
│  ────────────────────────────────────────────────                        │
│  2026-03-12 09:14:21  READ   john.doe    10.0.1.44   ALLOWED            │
│  2026-03-12 08:55:03  READ   alice.smith 10.0.1.81   ALLOWED            │
│  2026-03-11 17:22:10  READ   unknown ⚠  192.168.x.x  DENIED            │
│                                                                          │
│  EDIT HISTORY                    (Admin eyes only)                       │
│  ────────────────────────────────────────────────                        │
│  2026-03-10 14:01:55  WRITE  alice.smith 10.0.1.81   ALLOWED            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Locked Resource State

When a resource is locked (owner account revoked):

```
│  🔴 /api/v1/users                     ⚠ LOCKED    [Assign Owner]      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ⚠ This resource is locked                                      │   │
│  │  Owner account john.doe was revoked on 2026-03-12 08:00 UTC.   │   │
│  │  All access to this resource is suspended until an Admin        │   │
│  │  assigns a new owner.                                           │   │
│  │                              [Assign New Owner →]               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
```

### 7.5 Grant Access Modal

```
┌──────────────────────────────────────────────┐
│  Grant Access — report_q3.xlsx               │
│  ──────────────────────────────────────────  │
│                                              │
│  Grant to                                   │
│  ○ Individual Account                        │
│  ○ Group                                     │
│                                              │
│  Account / Group                            │
│  ┌──────────────────────────────────────┐   │
│  │  Search accounts or groups...        │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Permitted Actions                          │
│  ☑ READ   ☐ WRITE   ☐ DELETE               │
│  ☐ EXECUTE   ☐ EXPORT                       │
│                                              │
│  Time Restrictions (optional)              │
│  Days:  ☑ Mon ☑ Tue ☑ Wed ☑ Thu ☑ Fri     │
│          ☐ Sat ☐ Sun                        │
│  Hours: [08:00] to [18:00]                  │
│                                              │
│  [Cancel]          [Grant Access →]         │
└──────────────────────────────────────────────┘
```

---

## 8. Screen 5 — Integration Health Dashboard

### 8.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Integration Health              [+ Add Integration]   [Refresh]        │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌────────────┐  ┌───────────────┐  ┌──────────┐  ┌──────────────┐    │
│  │  🟢  14    │  │  🟡  2        │  │  🔴  1   │  │  ⚫  3       │    │
│  │  Active    │  │  Degraded     │  │  Silent  │  │  Disconnected│    │
│  └────────────┘  └───────────────┘  └──────────┘  └──────────────┘    │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ System          Type       Method    Status     Last Event       │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ prod-db-01      DATABASE   AGENT     🔴 SILENT  7 min ago  [▸]  │   │
│  │ dev-postgres    DATABASE   AGENT     🟡 DEGRAD  2 min ago  [▸]  │   │
│  │ prod-app-01     APP        SDK       🟢 ACTIVE  4 sec ago  [▸]  │   │
│  │ legacy-erp      LEGACY     LOG       🟢 ACTIVE  58 sec ago [▸]  │   │
│  │ aws-iam         CLOUD      API       🟢 ACTIVE  12 sec ago [▸]  │   │
│  │ az-ad           DIRECTORY  API       ⚫ DISCON  Never      [▸]  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Status Summary Cards

Each summary card is a clickable filter:

```
┌────────────────────┐
│   🟢               │
│   14               │  ← large number, --text-2xl
│   Active           │  ← label, --text-secondary
└────────────────────┘
bg: --bg-secondary
border: 1px solid --border
hover → border: #00C853 (green)
active/selected → border: #00C853, bg: #001A00
```

### 8.3 Integration Row — Silent State

Silent integrations are visually elevated:

```
│ 🔴 prod-db-01   DATABASE  AGENT  ● SILENT (7m 22s)  07:43:22 UTC  [▸] │
│ ─────────────────────────────────────────────────────────────────────── │
│   ⚠ CRITICAL alert sent at 07:48:22 UTC — no events received           │
│   Last 60 min: ████████████████░░░░░░░░░░  (40min active, 20min silent)│
└────────────────────────────────────────────────────────────────────────┘
```

Row has left border: 3px `#FF4444`, background: `#1A0000`

### 8.4 Integration Detail Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    prod-db-01                  🟢 ACTIVE    [Edit]  [Deregister]│
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  SYSTEM INFO                │  │  HEALTH                         │  │
│  │  ───────────                │  │  ──────                         │  │
│  │  Type      DATABASE         │  │  Status     🟢 ACTIVE           │  │
│  │  Method    AGENT            │  │  Last Event 4 seconds ago       │  │
│  │  Version   v2.1.4           │  │  Threshold  5 minutes           │  │
│  │  Registered 2026-01-15      │  │  Events/min 342                 │  │
│  │  Registered by admin        │  │                                 │  │
│  └─────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                          │
│  EVENT VOLUME (Last 60 minutes)                                          │
│  ──────────────────────────────                                          │
│  400 │▂▃▄▅▆▇█▇▆▅▅▆▇▇▇▇▇▇▆▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▆▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▆  │
│    0 └─────────────────────────────────────────────────────────────  │
│        60m ago                                              now        │
│                                                                          │
│  MAINTENANCE WINDOWS                                                     │
│  ─────────────────────────────────────────────────────────────────────  │
│  No windows scheduled.    [+ Schedule Maintenance Window]               │
│                                                                          │
│  CONNECTOR UPDATES                                                       │
│  ─────────────────────────────────────────────────────────────────────  │
│  Current: v2.1.4   Latest: v2.1.4   ✓ Up to date                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.5 Add Integration Wizard

Multi-step modal — not full page:

```
Step 1 of 4: Select System Type
──────────────────────────────
○ Database        ○ File System
○ Application     ○ Cloud Service
○ Legacy System   ○ Directory / IAM
○ Custom

Step 2 of 4: Select Integration Method
────────────────────────────────────────
○ SecureWatch Agent   (recommended for servers)
○ REST API / Webhook  (for modern apps)
○ Log File Parser     (for legacy systems)
○ Native SDK          (for custom apps)

Step 3 of 4: Configure Connection
────────────────────────────────────────
System Name: [                    ]
Host / Endpoint: [                ]
Auth credentials: [generated automatically]
Silence threshold: [5] minutes

Step 4 of 4: Verify Connection
────────────────────────────────────────
✓ Connection established
✓ First event received
✓ Integration registered
[Finish →]
```

---

## 9. Screen 6 — Audit Log Search & Export

### 9.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Audit Log                                    [Export ▾]  [Verify HMAC] │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  SEARCH & FILTER                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  [Date: 2026-03-12 to 2026-03-12 ▾]  [Account ▾]  [Resource ▾] │   │
│  │  [Severity ▾]  [Outcome: All ▾]  [Event Type ▾]  [Search...]   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  2,847 results                                                           │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Time (UTC)   Account        Resource      Action  Outcome  Sig   │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ 09:14:33     unknown_user   —             LOGIN   DENIED   ✓    │   │
│  │ 09:14:21     john.doe       report_q3     READ    ALLOWED  ✓    │   │
│  │ 09:12:44     john.doe       —             LOGIN   ALLOWED  ✓    │   │
│  │ 09:11:04     alice.smith    notes.txt     WRITE   ALLOWED  ✓    │   │
│  │ 09:10:15     bob.jones      prod_db       READ    DENIED   ✓    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Page 1 of 29    [← Prev]  [1][2][3]...[29]  [Next →]                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Log Row Colouring

| Outcome | Row Indicator |
|---|---|
| ALLOWED | No indicator |
| DENIED | Left border: `#FF4444`, subtle red background |
| FLAGGED | Left border: `#FF8C00`, subtle amber background |

### 9.3 Log Entry Detail Drawer

```
┌──────────────────────────────────────┐
│  ✕       Log Entry Detail            │
│  ──────────────────────────────────  │
│                                      │
│  log_id                              │
│  a3f2c1d4-8e9b-4c2a-...             │  ← monospace, truncated UUID
│                                      │
│  OUTCOME: ● DENIED                   │
│                                      │
│  EVENT                               │
│  ───────                             │
│  Type     LOGIN                      │
│  Time     2026-03-12 09:14:33 UTC    │  ← monospace
│  Account  unknown_user@domain.com    │
│  Device   UNREGISTERED               │
│  IP       192.168.4.22               │  ← monospace
│  Zone     UNKNOWN                    │
│                                      │
│  VERIFICATION                        │
│  ────────────                        │
│  Layer 1  ✗ FAILED — Account         │
│            not in registry           │
│  Layer 2  — Not evaluated            │
│  Layer 3  — Not evaluated            │
│                                      │
│  Denial Reason                       │
│  Account not found in registry      │  ← Admin eyes only label
│                                      │
│  INTEGRITY                           │
│  ──────────                          │
│  HMAC     ✓ Signature valid          │
│  Signed   2026-03-12 09:14:33 UTC    │
│                                      │
│  [Copy Log ID]  [View Raw Event]     │
└──────────────────────────────────────┘
```

### 9.4 Export Modal

```
┌──────────────────────────────────────┐
│  Export Audit Log                    │
│  ──────────────────────────────────  │
│                                      │
│  Format                             │
│  ○ PDF       ○ CSV       ○ JSON      │
│                                      │
│  Date Range                         │
│  From: [2026-03-01]  To: [2026-03-12]│
│                                      │
│  Filters Applied                    │
│  ✓ Current search filters included  │
│                                      │
│  Estimated records: 2,847            │
│  Estimated size: ~4.2 MB             │
│                                      │
│  [Cancel]        [Export & Download] │
└──────────────────────────────────────┘
```

---

## 10. Screen 7 — Account Management

### 10.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Accounts                              [+ Register Account]             │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  [Search accounts...]     [Status: All ▾]    [Group: All ▾]            │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Username          Email               Status      Groups  Actions │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ john.doe          john@corp.com       ● ACTIVE    2       [⋮]   │   │
│  │ alice.smith       alice@corp.com      ● ACTIVE    3       [⋮]   │   │
│  │ bob.jones         bob@corp.com        ○ SUSPENDED 1       [⋮]   │   │
│  │ svc_account       —                   ● ACTIVE    0       [⋮]   │   │
│  │ unknown_user      —                   ✗ REVOKED   0       [⋮]   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Account Status Indicators

| Status | Indicator |
|---|---|
| ACTIVE | ● green dot |
| SUSPENDED | ○ amber outline |
| REVOKED | ✗ red cross |
| EXPIRED | △ grey triangle |

### 10.3 Account Actions Menu `[⋮]`

```
┌───────────────────────┐
│  View Detail          │
│  Edit Account         │
│  Suspend              │
│  Revoke               │  ← shows warning: "X resources will be locked"
│  View Session History │
│  View Access History  │
└───────────────────────┘
```

### 10.4 Revoke Warning Modal

```
┌──────────────────────────────────────────────────┐
│  ⚠ Revoke Account — john.doe                     │
│  ────────────────────────────────────────────── │
│                                                  │
│  This action will:                               │
│  • Terminate all active sessions immediately     │
│  • Lock 7 owned resources until reassigned       │
│  • Generate a CRITICAL audit log entry           │
│  • This action cannot be undone                  │
│                                                  │
│  Resources that will be locked:                  │
│  📄 report_q3.xlsx                               │
│  🔌 /api/v1/users                                │
│  📁 /docs/john/                                  │
│  + 4 more...                                     │
│                                                  │
│  Pre-assign ownership before revoking?           │
│  [Assign Ownership First]                        │
│                                                  │
│  [Cancel]         [Confirm Revoke]               │
└──────────────────────────────────────────────────┘
```

---

## 11. Screen 8 — Device Management

### 11.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Devices                                 [+ Register Device]            │
│  ─────────────────────────────────────────────────────────────────────  │
│  [Search...]    [Status: All ▾]    [Zone: All ▾]                        │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Hostname          MAC Address        Zone       Status   Actions  │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ MacBook-JD-001    A1:B2:C3:D4:E5:F6  CORP-LAN  ✓ REG   [⋮]    │   │
│  │ DevServer-01      B2:C3:D4:E5:F6:G7  DEV-NET   ✓ REG   [⋮]    │   │
│  │ UNKNOWN-DEVICE    F1:E2:D3:C4:B5:A6  UNKNOWN   ? PEND  [⋮]    │   │
│  │ OldLaptop-Bob     C3:D4:E5:F6:G7:H8  CORP-LAN  ✗ BLKL  [⋮]    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Pending Device Alert

Pending (unregistered) devices seen on the network appear highlighted:

```
│  ⚠ UNKNOWN-DEVICE  F1:E2:D3:C4:B5:A6  UNKNOWN  ? PENDING  │
│    First seen: 2026-03-12 09:14:00 UTC                      │
│    [Approve & Register]   [Blacklist]                        │
```

---

## 12. Screen 9 — Network Zones

### 12.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Network Zones                              [+ Add Zone]                │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Zone Name         CIDR Range          Devices    Created         │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ CORP-LAN          10.0.1.0/24         142        2026-01-10      │   │
│  │ DEV-NET           10.0.2.0/24         28         2026-01-10      │   │
│  │ GUEST-WIFI        192.168.10.0/24     0          2026-02-01      │   │
│  │ VPN-POOL          172.16.0.0/16       15         2026-01-15      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ⚠ 3 recent logins from outside all registered zones                   │
│  [View in Audit Log →]                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Screen 10 — Groups & Privileges

### 13.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Groups & Privileges                         [+ Create Group]           │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Group Name        Members   Resources   Conflicts  Created        │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │ finance-team      12        34          0          2026-01-10    │   │
│  │ dev-team          8         21          2  ⚠       2026-01-10    │   │
│  │ readonly-users    45        104         0          2026-02-01    │   │
│  │ svc-accounts      3         8           0          2026-01-15    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Group Detail Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    dev-team                         [Edit]  [Delete Group]      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ⚠ 2 privilege conflicts detected — most-restrictive rule applied       │
│  [View Conflicts →]                                                     │
│                                                                          │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  MEMBERS (8)  [+ Add]      │  │  PRIVILEGES (21)  [+ Grant]     │  │
│  │  ───────────────────────── │  │  ──────────────────────────────  │  │
│  │  john.doe                  │  │  📄 report_q3.xlsx  READ         │  │
│  │  alice.smith               │  │  🗄 prod_database   READ         │  │
│  │  bob.jones                 │  │  🔌 /api/v1/data    READ WRITE   │  │
│  │  + 5 more...               │  │  + 18 more...                   │  │
│  └─────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                          │
│  CONFLICT LOG (Admin eyes only)                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│  bob.jones → dev-team (WRITE) vs readonly-users (READ) = READ applied   │
│  john.doe  → dev-team (DELETE) vs svc-accounts (no DELETE) = blocked   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Screen 11 — Settings & Notifications

### 14.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Settings                                                                │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  [Notifications]  [Session Policy]  [Retention]  [Admin Security]       │
│                                                                          │
│  NOTIFICATION SETTINGS                                                   │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  Admin Email          [admin@corp.com              ]                    │
│  Admin Phone (SMS)    [+1-555-000-0000             ]                    │
│  Webhook URL          [https://hooks.slack.com/... ]                    │
│                                                                          │
│  Channel Routing                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Severity   Inbox   Email   SMS   Webhook                          │   │
│  │ CRITICAL   ✓       ✓       ✓     ✓                               │   │
│  │ HIGH       ✓       ✓       ✓     ☐                               │   │
│  │ MEDIUM     ✓       ✓       ☐     ☐                               │   │
│  │ LOW        ✓       ☐       ☐     ☐                               │   │
│  │ INFO       ✓       ☐       ☐     ☐                               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Creator Notifications                                                   │
│  Send email to resource creator on successful creation?  ○ Yes  ● No   │
│                                                                          │
│  [Save Notification Settings]                                           │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  SESSION POLICY                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  Session Timeout (inactivity)    [30] minutes                           │
│                                                                          │
│  Auto-Termination Policy                                                 │
│  Terminate session on CRITICAL verdict?   ○ Yes  ● No                  │
│  Terminate session on layer failure?      ○ Yes  ● No                  │
│                                                                          │
│  [Save Session Policy]                                                  │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ADMIN SECURITY                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  MFA Status       ✓ Enabled — cannot be disabled                        │
│  MFA Method       TOTP (Google Authenticator compatible)                 │
│  [Regenerate MFA QR Code]   [View Backup Codes]                         │
│                                                                          │
│  Recovery Key     [View / Regenerate Recovery Key]                      │
│  ⚠ Recovery key should be stored securely offline                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 14.2 Log Retention Settings

```
  AUDIT LOG RETENTION
  ─────────────────────────────────────────────────────────────────────

  Hot Storage Period     [365] days   (fast query, TimescaleDB)
  Cold Storage           AWS S3 / Azure Blob / MinIO
  Cold Storage URL       [s3://securewatch-logs/           ]

  Log Destruction
  ⚠ Permanent log destruction is a sensitive operation.
  When enabled, destruction requires MFA re-verification
  and generates a permanent CRITICAL audit entry.
  Destroyed metadata is retained forever.

  [Request Log Destruction →]  (requires MFA)
```

---

## 15. Screen 12 — Emergency Read-Only View

### 15.1 Access

Accessed at `https://[host]:8443/emergency` — separate port, separate credentials.

### 15.2 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🛡 SecureWatch — EMERGENCY READ-ONLY VIEW                               │
│  ⚠ This session is view-only. All actions are logged.                   │
│  Session expires in: 3h 42m 18s            [Exit Emergency View]        │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  [Audit Log]  [Sessions]  [Alerts]  [Resources]                         │
│                                                                          │
│  (Full read-only dashboard — identical layout to main dashboard)        │
│  (All write, terminate, acknowledge, grant actions are hidden/disabled) │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 15.3 Behaviour Rules

| Rule | Detail |
|---|---|
| No write operations | All buttons that mutate state are hidden at UI level and blocked at API level |
| Timer visible | Countdown to auto-expiry always visible in topbar |
| Access alert | Entering emergency view triggers CRITICAL alert to Admin inbox |
| Every action logged | Page views, searches, exports — all logged immutably |
| Credential separation | Emergency credentials are different from primary Admin credentials |

---

## 16. Global Components

### 16.1 Confirmation Modal (Destructive Actions)

Used for: Terminate session, Revoke account, Delete group, Assign ownership

```
┌──────────────────────────────────────────────┐
│  ⚠ Confirm Action                            │
│  ──────────────────────────────────────────  │
│                                              │
│  [Action description in plain language]     │
│                                              │
│  This action:                               │
│  • [Consequence 1]                           │
│  • [Consequence 2]                           │
│  • Will be logged permanently                │
│                                              │
│  Type CONFIRM to proceed:                   │
│  ┌──────────────────────────────────────┐   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [Cancel]             [Confirm →]           │
│                       (disabled until typed) │
└──────────────────────────────────────────────┘
```

### 16.2 Toast Notifications

Non-blocking feedback for completed actions:

```
┌─────────────────────────────────────────┐
│  ✓ Session terminated successfully      │  ← success toast: green left border
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  ✓ Privilege granted to finance-team    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  ✗ Failed to connect — check API token  │  ← error toast: red left border
└─────────────────────────────────────────┘
```

Position: bottom-right corner, auto-dismiss after 4 seconds.

### 16.3 Empty States

```
┌──────────────────────────────────────────────┐
│                                              │
│              🔍                              │
│                                              │
│     No results match your filters.          │
│                                              │
│     Try adjusting the date range or         │
│     clearing some filters.                  │
│                                              │
│     [Clear Filters]                         │
└──────────────────────────────────────────────┘
```

### 16.4 Loading States

Skeleton loaders replace content while data loads:

```
┌──────────────────────────────────────────────────┐
│  ████████████████░░░░░░░░░   ████░░   ██████░░  │  ← animated shimmer
│  ████████████████████░░░░░   ████░░   ██████░░  │
│  ████████░░░░░░░░░░░░░░░░░   ████░░   ██████░░  │
└──────────────────────────────────────────────────┘
```

No spinners — skeleton loaders maintain layout stability.

### 16.5 Pagination Component

```
Showing 101–200 of 2,847 results

[← Prev]  [1] ... [2] [3] [4] ... [29]  [Next →]

Rows per page: [25 ▾]  [50 ▾]  [100 ▾]
```

---

## 17. Interaction & Motion Principles

### 17.1 Motion Budget

SecureWatch is a security tool — motion is functional, never decorative.

| Interaction | Duration | Easing |
|---|---|---|
| Drawer open/close | 200ms | ease-out |
| Modal appear | 150ms | ease-out |
| Toast appear | 200ms | ease-out |
| Row hover | 80ms | linear |
| Alert banner appear | 300ms | ease-out |
| Tab switch | 100ms | linear |
| Skeleton → content | 200ms | ease-in |

**No animations exceeding 300ms anywhere in the application.**

### 17.2 Real-Time Update Behaviour

| Event | UI Behaviour |
|---|---|
| New CRITICAL alert | Red banner appears at top; inbox badge increments; notification bell flashes once |
| New session appears | Row slides in at top of live sessions table; highlights for 2s |
| Session terminated | Row fades out over 300ms, row count decrements |
| Integration goes silent | Status pill transitions red; status card count updates |
| Integration restored | Status pill transitions green; optional toast notification |

### 17.3 Keyboard Navigation

| Key | Action |
|---|---|
| `Tab` | Move between focusable elements |
| `Esc` | Close drawer / modal |
| `Enter` | Confirm focused action |
| `Ctrl+K` | Global search |
| `Ctrl+/` | Focus filter bar |
| `1–9` | Jump to nav section (when sidebar focused) |

---

## 18. Accessibility Requirements

| Requirement | Implementation |
|---|---|
| WCAG 2.1 AA compliance | Minimum contrast ratio 4.5:1 for all text |
| Severity never colour-only | All severity indicators include text label AND icon |
| Screen reader support | All interactive elements have `aria-label` |
| Focus indicators | Visible focus ring on all interactive elements |
| Error announcements | Form errors announced via `aria-live` regions |
| Table accessibility | All tables include `<caption>` and `scope` attributes |
| Keyboard-only navigable | Every action achievable without a mouse |

---

## 19. Responsive Behaviour

SecureWatch is a **desktop-first professional tool.** Mobile is supported but not the primary use case.

| Breakpoint | Behaviour |
|---|---|
| ≥ 1440px | Full layout — sidebar expanded, full table columns |
| 1200–1439px | Sidebar collapsed to icons only; some columns hidden |
| 1024–1199px | Sidebar hidden; hamburger menu; tables scroll horizontally |
| < 1024px | Emergency read-only view only; no write operations on mobile |

### Sidebar Collapse (1200–1439px)

```
┌─────┬──────────────────────────────────────┐
│ 🔔  │                                      │
│ 👁  │       MAIN CONTENT                   │
│ 📁  │                                      │
│ 🔌  │                                      │
│ ─── │                                      │
│ 👤  │                                      │
│ 💻  │                                      │
└─────┴──────────────────────────────────────┘
```

Hovering any icon expands a tooltip with the label.

---

## 20. Error & Empty States

### 20.1 API Error States

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              ⚠                                     │
│                                                     │
│     Unable to load session data.                   │
│     The API returned an error.                     │
│                                                     │
│     [Retry]        [Report Issue]                  │
└─────────────────────────────────────────────────────┘
```

### 20.2 Connection Lost Banner

When WebSocket connection drops:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠ Live connection lost — data may be stale. Reconnecting...           │
│  bg: #2D1A00, border-bottom: 2px solid #FF8C00                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Automatically dismisses when connection is restored.

### 20.3 First-Run Empty States

When a tenant has no data yet:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│          🛡                                                │
│                                                             │
│     No integrations connected yet.                         │
│     Connect your first system to start monitoring.         │
│                                                             │
│     [+ Add Your First Integration →]                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Document Control

| Field | Value |
|---|---|
| **Document** | SecureWatch UI Design Document |
| **Version** | 1.0 |
| **Status** | Ready for Review |
| **Based On** | SecureWatch PRD v2.0 + TDD v1.0 |
| **Classification** | Confidential |

---

*SecureWatch UI Design v1.0 • Confidential • March 2026*
