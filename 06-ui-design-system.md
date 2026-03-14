# Steering File 06 — UI Design System
## Every frontend component must use these exact values. No deviations.

---

## Colour Tokens — Use These Exact Hex Values

### Base (Background & Text)
```css
--bg-primary:     #0D1117   /* Main app background */
--bg-secondary:   #161B22   /* Sidebar, cards, panels */
--bg-tertiary:    #21262D   /* Table rows, input fields */
--bg-hover:       #2D333B   /* Hover states */
--border:         #30363D   /* All borders and dividers */
--text-primary:   #E6EDF3   /* Primary body text */
--text-secondary: #7D8590   /* Labels, metadata, timestamps */
--text-muted:     #484F58   /* Placeholder text, disabled */
```

### Severity Colours — Non-Negotiable

```css
/* CRITICAL */
--critical-bg:     #3D0000
--critical-text:   #FF4444
--critical-border: #FF4444

/* HIGH */
--high-bg:     #2D1A00
--high-text:   #FF8C00
--high-border: #FF8C00

/* MEDIUM */
--medium-bg:     #2D2500
--medium-text:   #FFD700
--medium-border: #FFD700

/* LOW */
--low-bg:     #001A2D
--low-text:   #4FC3F7
--low-border: #4FC3F7

/* INFO */
--info-bg:     #1A1A2D
--info-text:   #9E9EF5
--info-border: #9E9EF5

/* GREEN SIGNAL */
--green-bg:     #001A00
--green-text:   #00C853
--green-border: #00C853
```

### Integration Health Status
```css
--status-active:       #00C853   /* Green */
--status-degraded:     #FF8C00   /* Amber */
--status-silent:       #FF4444   /* Red */
--status-disconnected: #484F58   /* Grey */
```

### Brand Accent
```css
--accent-blue:        #2E75B6   /* Primary buttons, links, active nav */
--accent-blue-hover:  #1B5994   /* Hover on primary buttons */
--accent-blue-subtle: #0D2137   /* Subtle highlight backgrounds */
```

---

## Typography

```css
/* UI font */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Data font — IPs, UUIDs, timestamps, log data, code */
font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
```

### Type Scale
```css
--text-xs:   11px / 400   /* Timestamps, metadata */
--text-sm:   13px / 400   /* Table rows, body */
--text-base: 14px / 400   /* Default body */
--text-md:   16px / 500   /* Section headers */
--text-lg:   20px / 600   /* Page titles */
--text-xl:   24px / 700   /* Dashboard counters */
--text-2xl:  32px / 700   /* KPI numbers on health cards */
```

**Rule:** IPs, MAC addresses, UUIDs, timestamps, log entries, and all raw data fields must use the monospace font family. Never render these in Inter.

---

## Spacing System (4px base grid)
```
4px   micro — icon gaps, tight padding
8px   small — button padding, tag gaps
12px  default inner padding
16px  card padding, list item height
24px  section gaps
32px  major section separation
48px  page-level margins
```

---

## Border Radius
```
4px  buttons, badges, inputs
6px  cards, table containers
8px  modals, panels
0px  table rows — sharp edges always
```

---

## Application Layout

```
Topbar:   fixed, 56px tall, z-index: 100
Sidebar:  fixed left, 220px wide (desktop), z-index: 90
Content:  margin-left: 220px, padding-top: 56px
```

### Topbar Contents (left → right)
1. Logo `🛡 SecureWatch` — links to Inbox
2. Tenant selector dropdown — Platform Super Admin only
3. Critical alert counter — red pill, always visible if CRITICAL alerts exist
4. Notification bell — total unread count
5. Admin name → dropdown: Profile, MFA Settings, Sign Out

### CRITICAL Alert Banner
Appears below topbar when CRITICAL alerts are unacknowledged:
```css
background: #3D0000;
border-bottom: 2px solid #FF4444;
```
Cannot be permanently dismissed. Disappears only when all CRITICAL alerts acknowledged.

### Sidebar Active State
```css
/* Active navigation item */
border-left: 3px solid #2E75B6;
background: #0D2137;
```

### Sidebar Nav Badge (unread count)
```css
background: #FF4444;
color: white;
border-radius: 9px;
min-width: 18px;
font-size: 11px;
```

---

## Component Specifications

### Severity Badge
```
Text: "● CRITICAL" / "● HIGH" / "● MEDIUM" / "● LOW" / "● INFO"
Padding: 3px 8px
Border-radius: 4px
Border: 1px solid [severity-border-colour]
Background: [severity-bg-colour]
Font: 11px / 600 / Inter
```

Severity is NEVER conveyed by colour alone — always include the text label and dot.

### Status Pill (Integration Health)
```
Text: "● Active" / "● Degraded" / "● Silent" / "● Disconnected"
Dot colour: matches --status-* colour
Text colour: --text-primary
Background: transparent
```

### Primary Button
```css
background: #2E75B6;
color: white;
border-radius: 4px;
padding: 8px 16px;
font: 14px / 500 / Inter;
/* hover */
background: #1B5994;
```

### Danger Button
```css
background: transparent;
border: 1px solid #FF4444;
color: #FF4444;
border-radius: 4px;
padding: 8px 16px;
/* hover */
background: #3D0000;
```

### Input Field
```css
background: #21262D;
border: 1px solid #30363D;
border-radius: 4px;
padding: 8px 12px;
font: 14px / Inter;
color: #E6EDF3;
/* focus */
border-color: #2E75B6;
outline: none;
```

### Table Row Hover
```css
background: #2D333B;
transition: background 80ms linear;
```

### Row State — Verification Verdicts
```css
/* SUSPICIOUS session row */
background: #2D2000;
border-left: 3px solid #FF8C00;

/* CRITICAL session row */
background: #2D0000;
border-left: 3px solid #FF4444;
```

### Row State — Audit Log Outcomes
```css
/* DENIED */
border-left: 3px solid #FF4444;
background: subtle red tint;

/* FLAGGED */
border-left: 3px solid #FF8C00;
background: subtle amber tint;
```

---

## Motion Rules

No animation exceeds 300ms. Motion is functional, never decorative.

```
Drawer open/close:    200ms / ease-out
Modal appear:         150ms / ease-out
Toast appear:         200ms / ease-out
Row hover:            80ms  / linear
Alert banner appear:  300ms / ease-out
Tab switch:           100ms / linear
Skeleton → content:   200ms / ease-in
New session row:      highlight 2s then fade to normal
```

---

## Real-Time Update Behaviours

| Event | UI Action |
|---|---|
| New CRITICAL alert | Red banner appears; inbox badge increments; bell flashes once |
| New active session | Row slides in at top; highlights for 2s |
| Session terminated | Row fades out over 300ms; count decrements |
| Integration goes SILENT | Status pill transitions red; count card updates |
| Integration restored | Status pill transitions green; optional toast |
| WebSocket disconnected | Amber banner appears: "Live connection lost — reconnecting..." |

---

## Screen Inventory — All 12 Must Be Built

| # | Screen | Route |
|---|---|---|
| 1 | Login & MFA | `/login` |
| 2 | Unified Admin Inbox | `/inbox` |
| 3 | Live Session View | `/sessions` |
| 4 | Resource Registry | `/resources` |
| 5 | Integration Health Dashboard | `/integrations` |
| 6 | Audit Log Search & Export | `/audit-log` |
| 7 | Account Management | `/accounts` |
| 8 | Device Management | `/devices` |
| 9 | Network Zones | `/zones` |
| 10 | Groups & Privileges | `/groups` |
| 11 | Settings & Notifications | `/settings` |
| 12 | Emergency Read-Only View | `https://[host]:8443/emergency` |

---

## Loading States

Use skeleton loaders — never spinners.
Skeleton loaders use an animated shimmer effect on grey blocks.
Skeleton blocks match the approximate dimensions of the content they replace.
This maintains layout stability during data load.

---

## Empty States

Every table and list must have an empty state. Format:
```
[Icon — large, centered]
[Primary message — 16px, --text-primary]
[Secondary message — 14px, --text-secondary]
[Action button — if applicable]
```

---

## Toast Notifications

Position: bottom-right corner
Auto-dismiss: 4 seconds
Max visible at once: 3

```css
/* Success toast */
border-left: 3px solid #00C853;
background: #161B22;

/* Error toast */
border-left: 3px solid #FF4444;
background: #161B22;
```

---

## Responsive Breakpoints

| Width | Behaviour |
|---|---|
| ≥ 1440px | Full layout, sidebar expanded, all columns visible |
| 1200–1439px | Sidebar collapses to icon-only (48px), some table columns hidden |
| 1024–1199px | Sidebar hidden, hamburger menu, tables scroll horizontally |
| < 1024px | Emergency read-only view only; all write operations blocked |

---

## Accessibility — Mandatory

- WCAG 2.1 AA minimum compliance
- All severity indicators: colour + text label + icon (never colour alone)
- All interactive elements: visible focus ring, `aria-label`
- All tables: `<caption>` + `scope` attributes
- Form errors: announced via `aria-live="polite"`
- Every action achievable via keyboard only

---

*SecureWatch Steering 06 — UI Design System • March 2026*
