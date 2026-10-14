# Task 0001 — Monorepo skeleton and CI

Phase: P0 Foundations. Depends on: nothing. Read `CLAUDE.md` first.

## Goal

A pnpm + Turborepo monorepo where `pnpm dev` starts Payload 3 (pinned minor) with Next.js 16 and Postgres, `pnpm check` runs all gates, and a GitHub Actions workflow runs the same gates on every PR.

## Deliverables

- `pnpm-workspace.yaml`, `turbo.json`, root `package.json` with `packageManager` pinned, `.nvmrc`.
- `apps/web`: Payload 3 + Next.js 16 app from the official template, Postgres adapter, S3 storage adapter configured for MinIO locally, `localization` with `en` and `ar` (`rtl: true`), a placeholder `Users` and `Media` collection.
- `packages/config`: shared `tsconfig.base.json` (strict flags from CLAUDE.md), ESLint flat config with `@typescript-eslint` strict, `jsx-a11y`, import-boundary rule, and the custom `alpha/no-physical-direction` rule; Prettier config; Tailwind 4 preset reading `packages/ui/tokens.css` (tokens file may be a stub).
- `packages/core`, `packages/acoustics`, `packages/llm`, `packages/ui`, `packages/payload`: empty packages with `package.json`, `tsconfig.json`, an `index.ts` and one passing Vitest test each.
- `docker-compose.yml`: Postgres 16 with pgvector image, MinIO, Mailpit. A migration enables the `vector` extension. (Delivered as the second migration, after Payload's generated initial schema: Payload records every migration in `payload_migrations`, which the schema migration creates, so the schema must run first. See ADR 0001.)
- `.env.example` with every variable and a comment; `packages/config/env.ts` validating them with Zod at startup.
- `.github/workflows/ci.yml`: install with cache, type-check, lint, unit, integration (Testcontainers Postgres), `payload generate:types` diff check, build. Runs on PR and on `main`.
- `docs/adr/0001-monorepo-and-toolchain.md` recording the choices.
- Root `README.md`: how to run locally in five commands.

## Acceptance criteria

- [x] Fresh clone: `pnpm install && pnpm dev` serves the Payload admin at `/admin` and a Next.js page at `/` with a local Postgres from Docker Compose.
  - Verified with `pnpm install --frozen-lockfile`, `payload migrate` and `next dev` against Postgres 16 + pgvector: `/` returns 200, `/admin` renders the first-user screen, and registering an admin through the API writes to Postgres. The cloud session could not pull the Compose images (Docker Hub blocked by egress policy), so Postgres ran natively; Compose itself is to be confirmed on a developer machine.
- [x] `pnpm check` passes with zero lint warnings. (23 of 23 tasks.)
- [x] Renaming a Tailwind class to `ml-4` in any component fails lint with the `alpha/no-physical-direction` message.
- [x] Importing `apps/web` from `packages/core` fails lint with the boundary message. Importing React or Next.js from `core`, `acoustics` or `llm` now fails too (it silently did not before); covered by `eslint-plugin-alpha/tests/boundaries.test.js`.
- [x] Deleting a generated type and running CI fails on the types diff step. Verified by committing a `payload-types.ts` with `interface Media` removed on a throwaway branch and running the step's script: exit 1 with the stale-files error; exit 0 on the real commit.
- [ ] CI workflow green on the PR.
- [x] No Payload or Next.js version other than the pinned ones in the lockfile. (payload 3.90.2, next 16.4.0; CI checks this.)
