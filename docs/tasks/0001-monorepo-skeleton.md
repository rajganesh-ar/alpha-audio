# Task 0001 — Monorepo skeleton and CI

Phase: P0 Foundations. Depends on: nothing. Read `CLAUDE.md` first.

## Goal
A pnpm + Turborepo monorepo where `pnpm dev` starts Payload 3 (pinned minor) with Next.js 16 and Postgres, `pnpm check` runs all gates, and a GitHub Actions workflow runs the same gates on every PR.

## Deliverables
- `pnpm-workspace.yaml`, `turbo.json`, root `package.json` with `packageManager` pinned, `.nvmrc`.
- `apps/web`: Payload 3 + Next.js 16 app from the official template, Postgres adapter, S3 storage adapter configured for MinIO locally, `localization` with `en` and `ar` (`rtl: true`), a placeholder `Users` and `Media` collection.
- `packages/config`: shared `tsconfig.base.json` (strict flags from CLAUDE.md), ESLint flat config with `@typescript-eslint` strict, `jsx-a11y`, import-boundary rule, and the custom `alpha/no-physical-direction` rule; Prettier config; Tailwind 4 preset reading `packages/ui/tokens.css` (tokens file may be a stub).
- `packages/core`, `packages/acoustics`, `packages/llm`, `packages/ui`, `packages/payload`: empty packages with `package.json`, `tsconfig.json`, an `index.ts` and one passing Vitest test each.
- `docker-compose.yml`: Postgres 16 with pgvector image, MinIO, Mailpit. Migration `0001` enables the `vector` extension.
- `.env.example` with every variable and a comment; `packages/config/env.ts` validating them with Zod at startup.
- `.github/workflows/ci.yml`: install with cache, type-check, lint, unit, integration (Testcontainers Postgres), `payload generate:types` diff check, build. Runs on PR and on `main`.
- `docs/adr/0001-monorepo-and-toolchain.md` recording the choices.
- Root `README.md`: how to run locally in five commands.

## Acceptance criteria
- [ ] Fresh clone: `pnpm install && pnpm dev` serves the Payload admin at `/admin` and a Next.js page at `/` with a local Postgres from Docker Compose.
- [ ] `pnpm check` passes with zero lint warnings.
- [ ] Renaming a Tailwind class to `ml-4` in any component fails lint with the `alpha/no-physical-direction` message.
- [ ] Importing `apps/web` from `packages/core` fails lint with the boundary message.
- [ ] Deleting a generated type and running CI fails on the types diff step.
- [ ] CI workflow green on the PR.
- [ ] No Payload or Next.js version other than the pinned ones in the lockfile.
