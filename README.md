# alpha-platform

The Alpha Audio GCC platform: one Payload 3 + Next.js 16 application for the retail storefront, admin and warehouse tools, plus the dealer board, built on shared pure packages. Read [`CLAUDE.md`](CLAUDE.md) for the rules every change follows and [`docs/spec/engineering-spec.md`](docs/spec/engineering-spec.md) for the full specification.

## Run it locally

You need Node 22 (see `.nvmrc`), pnpm 10 (`corepack enable` provides it) and Docker.

```bash
pnpm install
cp .env.example .env && cp apps/web/.env.example apps/web/.env   # then set PAYLOAD_SECRET: openssl rand -hex 32
docker compose up -d                                             # Postgres + pgvector, MinIO, Mailpit
pnpm --filter @alpha/web migrate                                 # create the schema and enable pgvector
pnpm --filter @alpha/web seed:markets                            # the six GCC markets (safe to re-run)
pnpm dev                                                         # http://localhost:3000 → /ae/en/
```

Open <http://localhost:3000/admin> and create the first admin user. The storefront is at `/ae/en/` and `/ae/ar/`; only the UAE is live until a market's status is changed under Settings → Markets. MinIO's console is at <http://localhost:9001> (`alpha` / `alpha-secret`) and Mailpit at <http://localhost:8025>.

## Checks

```bash
pnpm check                         # typecheck, lint, unit, integration, a11y — the same gates CI runs
pnpm format:check
pnpm generate:types                # after any collection change; commit the result
pnpm --filter @alpha/web migrate:create <name>   # after any collection change; commit the migration
pnpm --filter @alpha/ui storybook                # component library at http://localhost:6006 (Direction toolbar: LTR/RTL)
pnpm test:visual                                 # LTR + RTL screenshots of every story against the baselines
pnpm --filter @alpha/ui test:visual:update       # after an intended visual change; review the image diff
```

`pnpm test:a11y` and `pnpm test:visual` build Storybook and drive it with Playwright 1.56.1 (Chromium build 1194). Outside the cloud workspace, install that browser once with `pnpm --filter @alpha/ui exec playwright install chromium`.

Integration tests use the database in `DATABASE_URL` when it is set, otherwise they start a throwaway Postgres with Testcontainers (needs Docker). Each run creates and drops its own database.

## Layout

| Path                 | What lives there                                                              |
| -------------------- | ----------------------------------------------------------------------------- |
| `apps/web`           | Next.js storefront + Payload admin (one process)                              |
| `packages/payload`   | Collections, globals, hooks, access, jobs                                     |
| `packages/core`      | Ledger, price engine, checkout (pure, no React)                               |
| `packages/acoustics` | Room Lab engine (pure, no I/O)                                                |
| `packages/llm`       | LLM provider abstraction and evaluation harness                               |
| `packages/ui`        | Design tokens and components                                                  |
| `packages/config`    | ESLint (with `eslint-plugin-alpha`), TypeScript, Tailwind presets, env schema |
| `docs`               | Specification, tasks, ADRs, runbooks                                          |

## Notes

- `pnpm dev` lets Payload push schema changes to your local database automatically. Production runs migrations only, so a collection change is not done until `migrate:create` has generated its migration.
- Checking a production build (`pnpm build && pnpm --filter @alpha/web start`)? Point it at a database `pnpm dev` has never touched: production boots from migrations and stops at Payload's prompt if dev mode has pushed schema to that database.
- Old-site links (`/brand?bid=13`) are redirected from Settings → Legacy redirects. Routing, 404s and redirects are explained in [`docs/adr/0002-market-routing-and-legacy-redirects.md`](docs/adr/0002-market-routing-and-legacy-redirects.md).
- Never put `NODE_ENV` in `.env`; Next.js sets it, and a stray `NODE_ENV=development` breaks `next build`.
- Fonts are copied from the pinned Fontsource packages into `apps/web/public/fonts` by `pnpm --filter @alpha/web fonts` (run by `dev` and `build`); the folder is not committed.
- Decisions behind this setup are in [`docs/adr/`](docs/adr/): toolchain (0001), market routing (0002), design system (0003).

```

```
