# SecureWatch — Tech Stack & Build

## Frontend (current workspace)

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) |
| Routing | React Router v6 |
| State | Zustand v4 |
| Charts | Recharts |
| Icons | lucide-react |
| Utilities | clsx, tailwind-merge |

## Full Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 LTS + TypeScript, Fastify v4 |
| Database | MySQL 8.0 via XAMPP (single instance, port 3306) |
| Cache | node-cache (in-process, npm package — no Redis) |
| Agent | Go v1.22 (proprietary, static binary) |
| SDK | TypeScript → npm (open source, event forwarding only) |

**Database driver: `mysql2` only. Do NOT use `pg`, `sequelize` with postgres, or any PostgreSQL/Redis client.**
**No Docker, no docker-compose, no PostgreSQL, no TimescaleDB, no Redis.**
All database operations use `mysql2/promise`. Caching uses `node-cache` (in-process).

## XAMPP Setup

Start MySQL via XAMPP Control Panel. Run `npm run migrate` in `services/rest-api` to create the database and all tables.

## Common Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # tsc + vite build
npm run preview    # Preview production build
```

## Package Management

Use `npm` only. Do not use yarn, pnpm, or bun.

## TypeScript

Strict mode is mandatory. No `any`, no `!.` non-null assertions, no `@ts-ignore`.
See `tsconfig.json` for enforced compiler options.

## Tailwind CSS v4 Notes

- Theme tokens are defined in `src/index.css` under `@theme { }` — not in a `tailwind.config.js`
- All design tokens (colours, fonts) are available as Tailwind utility classes (e.g. `bg-bg-primary`, `text-critical-text`)
- Do not add a `tailwind.config.js` — configuration lives in CSS

## Environment

- Development: `.env` files (never commit)
- Production: all secrets from HashiCorp Vault
