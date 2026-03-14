# Steering File 05 — Alert Severity Matrix & Escalation Rules
## Every alert code, trigger, and routing rule is defined here exactly.

---

## Alert Code Reference

### CRITICAL — Immediate Response

| Code | Trigger | Default Action |
|---|---|---|
| C1 | Unregistered account login attempt | Alert + auto-notify Admin + flag session |
| C2 | Known credential + unknown device + unknown network simultaneously | Alert + flag session + auto-notify Admin |
| C3 | Audit log deletion attempted — any role including Admin | Block action + CRITICAL alert + notify Admin |
| C4 | Connected system silent beyond threshold (default 5 min) | Alert + notify Admin immediately |
| C5 | Connector tampering detected | Alert + isolate connector + notify Admin |
| C6 | Admin authentication failure — 3+ attempts | Lock Admin account + CRITICAL alert |
| C7 | Event received from completely unregistered source | Reject event + CRITICAL alert + notify Admin |
| C8 | Resource owner account revoked — resource auto-locked | Lock resource + CRITICAL alert |

### HIGH — Response Within 5 Minutes

| Code | Trigger | Default Action |
|---|---|---|
| H1 | Registered account from unrecognised device | Alert Admin |
| H2 | Login from outside authorised network zone | Alert Admin |
| H3 | Access to restricted resource outside permitted hours | Alert + log event |
| H4 | Unauthorised resource access attempt — any resource type | Block + Alert + log event |
| H5 | Event received from registered but degraded source | Alert Admin + investigate |
| H6 | Three-layer verification failure on resource action | Block action + Alert + log all failed layers |

### MEDIUM — Response Within 15 Minutes

| Code | Trigger | Default Action |
|---|---|---|
| M1 | Unusually high volume of resource access events | Alert + flag for review |
| M2 | Bulk access / data exfiltration attempt detected | Alert + flag + log event |
| M3 | Integration added, modified, or removed | Alert Admin + log event |
| M4 | Group conflict detected — most-restrictive rule auto-applied | Alert Admin + log resolution |
| M5 | Ownership transfer initiated — pending Admin approval | Alert Admin + lock resource pending approval |

### LOW — Response Within 1 Hour

| Code | Trigger | Default Action |
|---|---|---|
| L1 | Failed login attempt — single occurrence | Log + notify if repeated |
| L2 | Admin authentication failure — single occurrence | Log + monitor |
| L3 | Privilege granted or revoked by Admin | Log + notify Admin confirmation |
| L4 | Access outside permitted time window — single occurrence | Log + notify Admin |

### INFO — Best Effort

| Code | Trigger | Default Action |
|---|---|---|
| I1 | New device seen on network — pending registration | Log only |
| I2 | Privilege grant/revoke confirmed successfully | Log only |
| I3 | Resource created successfully — green signal | Admin inbox notification; optional email to creator |
| I4 | New integration registered successfully | Log + Admin inbox notification |
| I5 | Integration health restored — system active again | Log + Admin inbox notification |

---

## Escalation Rules — Hardcoded, Non-Configurable

### End User Failed Login
```
1 failure in 5 min    → L1 (LOW)
3 failures in 5 min   → MEDIUM
5+ failures in 5 min  → HIGH
```

### Admin Authentication Failure
```
1st failure  → L2 (LOW) + log
2nd failure  → L2 (LOW) + warning message in response
3rd+ failure → C6 (CRITICAL) + account locked immediately
```

### Integration Silence
```
> (threshold * 0.8) minutes  → DEGRADED status + H5 (HIGH)
> threshold minutes           → SILENT status + C4 (CRITICAL)
Default threshold: 5 minutes (configurable per system)
```

### Bulk Access / Exfiltration
```
Count >= threshold     → M2 (MEDIUM)
Count >= threshold * 2 → H4_EXFIL (HIGH)
```

Default thresholds (configurable per tenant):
```typescript
const EXFILTRATION_THRESHOLDS = {
  files_per_minute:    50,
  exports_per_minute:  10,
  deletes_per_minute:  20,
};
```

---

## Notification Channel Routing

| Severity | Admin Inbox | Email | SMS | Webhook |
|---|---|---|---|---|
| CRITICAL | ✅ Always | ✅ | ✅ | ✅ |
| HIGH | ✅ Always | ✅ | ✅ | ❌ |
| MEDIUM | ✅ Always | ✅ | ❌ | ❌ |
| LOW | ✅ Always | ❌ | ❌ | ❌ |
| INFO | ✅ Always | ❌ | ❌ | ❌ |

SMS is sent for CRITICAL and HIGH ONLY. This is not configurable to lower severities.
Admin inbox receives ALL severities always — this cannot be disabled.

---

## Deduplication Windows

```typescript
const DEDUP_WINDOWS: Record<Severity, number> = {
  CRITICAL: 60,    // 60 seconds — re-fires every 60s if condition persists
  HIGH:     300,   // 5 minutes
  MEDIUM:   900,   // 15 minutes
  LOW:      3600,  // 1 hour
  INFO:     3600,  // 1 hour
};
```

Deduplicated alerts show occurrence count in Admin inbox: `(×12 occurrences)`

---

## Admin Inbox Priority Queue

Sorted by: severity weight first, then timestamp (newest first within same severity).

```typescript
const SEVERITY_WEIGHTS: Record<Severity, number> = {
  CRITICAL: 0,   // Always at top
  HIGH:     1,
  MEDIUM:   2,
  LOW:      3,
  INFO:     4,
};

// Redis sorted set score:
const score = SEVERITY_WEIGHTS[alert.severity] * 1e13 + Date.now();
```

---

## Alert Required Fields

Every alert object must contain ALL of these fields:

```typescript
interface Alert {
  alert_id:     string;        // UUID
  tenant_id:    string;        // UUID
  alert_code:   string;        // e.g. 'C1', 'H2', 'M3'
  severity:     Severity;
  triggered_at: Date;          // UTC
  account_id:   string | null; // Affected account
  device_id:    string | null; // Affected device
  resource_id:  string | null; // Affected resource
  system_id:    string | null; // Affected integrated system
  detail:       string;        // Full detail — Admin eyes only, never in HTTP response
  dedup_key:    string;        // Used for deduplication window
}
```

---

## Green Signal Delivery

Green signals are positive confirmations. They arrive in the Admin inbox as INFO-level items in a separate collapsed section.

```typescript
type GreenSignalType =
  | 'RESOURCE_CREATED'
  | 'INTEGRATION_REGISTERED'
  | 'PRIVILEGE_GRANTED'
  | 'INTEGRATION_HEALTH_RESTORED';
```

Optional email to resource creator on `RESOURCE_CREATED` — controlled by tenant settings.

---

## Automated Session Termination

Off by default. Admin configures per tenant:

```typescript
interface TerminationPolicy {
  tenant_id:               string;
  terminate_on_critical:   boolean;  // Default: false
  terminate_on_layer_fail: boolean;  // Default: false
}
```

Every automated termination is logged as a CRITICAL event in the audit log — even if termination policy is running in automatic mode.

---

*SecureWatch Steering 05 — Alert Matrix • March 2026*
