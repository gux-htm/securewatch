# Project Structure

## Root Layout

```
/
├── artifacts/          # Deployable applications (each is a pnpm workspace package)
│   ├── Oh-My-Guard!/     # React SPA frontend — Oh-My-Guard! (@workspace/Oh-My-Guard!)
│   ├── api-server/     # Express 5 API server (@workspace/api-server)
│   └── mockup-sandbox/ # UI mockup/prototyping sandbox
├── lib/                # Shared libraries (pnpm workspace packages)
│   ├── api-spec/       # OpenAPI 3.1 spec + Orval codegen config (source of truth for API)
│   ├── api-client-react/ # AUTO-GENERATED React Query hooks (do not edit)
│   ├── api-zod/        # AUTO-GENERATED Zod schemas (do not edit)
│   └── db/             # Drizzle ORM schema + PostgreSQL connection
├── Oh-My-Guard!/         # Python/FastAPI native backend (standalone, not a pnpm package)
├── scripts/            # Utility TypeScript scripts (@workspace/scripts)
├── .kiro/steering/     # AI steering rules
├── tsconfig.base.json  # Shared TypeScript compiler options
├── tsconfig.json       # Root project references
└── pnpm-workspace.yaml # Workspace package globs + shared catalog versions
```

## Frontend — `artifacts/Oh-My-Guard!/src/`

```
src/
├── pages/          # One file per route/view (Dashboard, Devices, Networks, Firewall, IdsIps, etc.)
├── components/
│   ├── ui/         # shadcn/ui primitives (Radix-based, do not modify generated files)
│   └── Layout.tsx  # App shell / nav
├── hooks/          # Data-fetching hooks (use-devices.ts, use-alerts.ts, etc.) — wrap API client
├── lib/
│   └── utils.ts    # cn() and other shared utilities
├── App.tsx         # Router setup (Wouter)
└── main.tsx        # React entry point
```

- Routing: Wouter (not React Router)
- Path alias `@/` maps to `src/`, `@assets/` maps to `attached_assets/`
- UI components come from `src/components/ui/` (shadcn/ui pattern)
- Data hooks in `src/hooks/` consume generated React Query hooks from `@workspace/api-client-react`

## API Server — `artifacts/api-server/src/`

```
src/
├── routes/         # One file per domain (devices.ts, networks.ts, firewall.ts, etc.)
│   └── index.ts    # Mounts all sub-routers under /api
├── middlewares/    # Express middleware
├── lib/
│   └── logger.ts   # Pino logger instance
├── app.ts          # Express app setup (CORS, body parsing, route mounting)
└── index.ts        # Server entry — reads PORT, starts listening
```

- All routes are mounted under `/api`
- Request/response validation uses Zod schemas from `@workspace/api-zod`
- DB access via `@workspace/db`

## Shared DB Layer — `lib/db/src/`

```
src/
├── schema/         # One file per table (devices.ts, networks.ts, audit_logs.ts, etc.)
│   └── index.ts    # Barrel re-export of all schemas
└── index.ts        # Exports: pool, db (Drizzle instance), and all schema
```

- Add new tables as `lib/db/src/schema/<tablename>.ts` and re-export from `schema/index.ts`
- Use `drizzle-zod` to derive insert/select Zod schemas from table definitions
- Dev schema changes: `pnpm --filter @workspace/db run push`

## API Contract — `lib/api-spec/`

- `openapi.yaml` is the single source of truth for all API shapes
- After editing `openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen` to regenerate `api-zod` and `api-client-react`
- Never manually edit files in `lib/api-zod/src/generated/` or `lib/api-client-react/src/generated/`

## Python Backend — `Oh-My-Guard!/`

```
Oh-My-Guard!/
├── server/         # FastAPI app (main.py, routers/, services/, middlewares/, config.py)
├── agent/          # Lightweight Python client daemon
├── vpn/            # OpenVPN + Easy-RSA management
├── crypto/         # Internal CA, RSA-PSS signing/verification
├── dashboard/      # Jinja2 templates (HTMX + TailwindCSS SOC UI)
├── database/       # SQLAlchemy models + Alembic migrations
├── install/        # install.sh (Linux) + install.ps1 (Windows)
└── docs/           # Deployment and admin guides
```

- Completely independent from the pnpm monorepo — has its own `requirements.txt`
- FastAPI routers live in `server/routers/`, one file per domain
- All models in `database/models.py`; migrations managed by Alembic (`alembic.ini`)

## Scripts — `scripts/src/`

- Each `.ts` file is a standalone runnable script
- Add a corresponding entry in `scripts/package.json` `scripts` section
- Run via: `pnpm --filter @workspace/scripts run <script-name>`
