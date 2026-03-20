# SecureWatch — Project Structure

## Current Workspace (Frontend SPA)

```
/
├── src/
│   ├── main.tsx              # Entry point
│   ├── App.tsx               # Router setup — BrowserRouter + Routes
│   ├── index.css             # Tailwind v4 @theme tokens (design system)
│   ├── components/
│   │   └── Layout.tsx        # Shell: topbar + sidebar + <Outlet />
│   └── pages/
│       ├── Login.tsx         # /login — credentials + MFA (2-step)
│       ├── Inbox.tsx         # /inbox — unified admin alert inbox
│       ├── Sessions.tsx      # /sessions — live session view
│       ├── Resources.tsx     # /resources — resource registry
│       └── Integrations.tsx  # /integrations — integration health dashboard
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Screens Still To Build

| Route | Screen |
|---|---|
| `/audit-log` | Audit Log Search & Export |
| `/accounts` | Account Management |
| `/devices` | Device Management |
| `/zones` | Network Zones |
| `/groups` | Groups & Privileges |
| `/settings` | Settings & Notifications |
| `:8443/emergency` | Emergency Read-Only View |

## Layout Pattern

All authenticated pages render inside `Layout.tsx` via React Router's `<Outlet />`.
- Topbar: fixed, 56px, `z-50`
- CRITICAL alert banner: fixed below topbar, `z-40` (shown when unacknowledged criticals exist)
- Sidebar: fixed left, 220px wide, `z-30`
- Main content: `ml-[220px]`, `pt-[90px]` (topbar + banner height)

New pages go in `src/pages/` and are registered as child routes of the `/` Layout route in `App.tsx`.

## Backend Structure

```
services/rest-api/
├── src/
│   ├── app.ts              # Fastify bootstrap
│   ├── config.ts           # Env-based config (MySQL, JWT, Kafka)
│   ├── kafka.ts            # KafkaJS shared client
│   ├── db/
│   │   ├── mysql.ts        # mysql2/promise pool + query helpers
│   │   ├── cache.ts        # node-cache wrapper (replaces Redis)
│   │   └── migrate.ts      # MySQL migration runner
│   └── routes/
│       └── health.ts       # GET /api/v1/health
├── .env.example
└── package.json

database/
└── migrations/             # 001–011 MySQL .sql files (run via npm run migrate)
```

No Dockerfiles, no docker-compose, no k8s/, no helm/ directories.

| Artifact | Convention | Example |
|---|---|---|
| Page components | PascalCase `.tsx` | `AuditLog.tsx` |
| Shared components | PascalCase `.tsx` | `SeverityBadge.tsx` |
| Hooks | camelCase, `use` prefix | `useAlerts.ts` |
| Stores (Zustand) | camelCase, `use` prefix | `useSessionStore.ts` |
| Utilities | camelCase | `formatTimestamp.ts` |

## Design Token Usage

All colours, spacing, and typography come from CSS custom properties defined in `src/index.css`.
Use Tailwind utility classes that map to these tokens — never hardcode hex values in components.

```tsx
// Correct
<div className="bg-bg-secondary text-text-primary border border-border">

// Wrong
<div style={{ background: '#161B22', color: '#E6EDF3' }}>
```

## Data Display Rules

- IPs, MACs, UUIDs, timestamps, log entries → always `font-mono` class
- Severity indicators → always colour + text label + dot (never colour alone)
- Tables → always include empty state when no data
- Loading states → skeleton loaders only, never spinners
