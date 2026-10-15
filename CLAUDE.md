# CLAUDE.md — alpha-platform

You are working in the Alpha Audio platform monorepo: one Payload 3 + Next.js 16 application that runs the GCC retail storefront, the dealer board (`partners.alphaaudios.com`), the trade portal, community, My Alpha, the operations core (stock ledger, purchasing, orders, fulfilment) and the intelligence tools (AI Advisor, Room Lab, System Builder). Six markets (ae, sa, qa, kw, bh, om), two locales (en, ar).

The full specification lives in `docs/spec/`. Read the relevant section before touching a domain. Tasks live in `docs/tasks/`; each has acceptance criteria that define done.

## Non-negotiable rules

1. **Stock is a ledger, never a field.** Quantities are derived from `StockMovements`. Every stock change goes through `LedgerService` (`createLedger(payload)` from `@alpha/payload`); movements and levels cannot be written any other way (access, hooks and a database trigger refuse it; ADR 0004). Supplier stock enters only by posting a goods receipt (`createReceiving(payload)`; ADR 0005). Never add a `quantity` field to a product.
2. **Money and compatibility are deterministic.** Prices, stock, VAT, rules and scores are computed in `packages/core` or `packages/acoustics`. The LLM layer (`packages/llm`) only interprets and explains; it never chooses a product or emits a figure that did not come from a tool result.
3. **Buyer context comes from the session, never from request parameters.** Company, group, market and currency are read from the authenticated session. Any handler that accepts a `companyId` from the client is a bug.
4. **Private by default.** Cost, landed cost, margin and contract prices are field-level restricted. Signed-in routes and the partners domain are `Cache-Control: private, no-store`. Public product pages never include cost.
5. **Everything is market-aware.** Currency, decimals, VAT, payment rails, address scheme and brand rights come from the `Markets` global and `BrandAgreements`. No `if (market === 'sa')` branches in components; read the record.
6. **Arabic is first-class.** Every component works in RTL. Logical CSS properties only. Localized fields carry `en` and `ar`. No hard-coded English strings in components; use the i18n dictionary.
7. **Nothing ships without a migration and tests.** Any collection change includes a Payload migration in the same PR. Any rule change includes a test.

## Repository layout

```
apps/web          Next.js 16 storefront + Payload admin + ops PWA route group (one process)
apps/partners     Dealer board (Next.js), separate deployment and domain
packages/payload  Collections, globals, hooks, access, jobs, migrations
packages/core     Ledger, price engine, checkout, lead routing (pure services, no React)
packages/acoustics Room Lab engine (pure TypeScript, no I/O)
packages/llm      Provider abstraction, tool definitions, prompts, evaluation harness
packages/ui       Design tokens, components, Storybook
packages/config   ESLint, TypeScript, Tailwind, Prettier presets
infra             Terraform (UAE region, Cloudflare), Dockerfiles
docs              spec/, tasks/, adr/, runbooks/, privacy/
```

Import boundaries: apps import packages; packages never import apps; `packages/core` and `packages/acoustics` never import React, Next.js or Payload UI. `packages/payload` may import `packages/core`. The ESLint boundary rule enforces this; do not disable it.

## Toolchain

- Node LTS as pinned in `.nvmrc`; pnpm as pinned in `package.json#packageManager`. Use `pnpm`, never `npm` or `yarn`.
- Payload pinned to a minor (see `packages/payload/package.json`); do not bump Payload or Next.js in a feature PR. Upgrades are their own PR titled `chore(deps): payload 3.x`.
- Postgres via `@payloadcms/db-postgres`; pgvector is enabled by the second migration, right after the generated initial schema (Payload records each migration in a table that the schema migration creates, so the schema always runs first).
- Local development: `pnpm dev` starts everything (Docker Compose brings up Postgres, MinIO and a mail catcher). If a service is missing, fix `docker-compose.yml`, do not work around it.
- Environment variables are documented in `.env.example`. Add every new variable there with a comment. The app fails fast at startup on a missing variable; extend `packages/config/env.ts` when you add one.

## TypeScript and code style

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` are on. Do not weaken tsconfig.
- No `any` without a `// reason:` comment on the same line. No `@ts-ignore`; use `@ts-expect-error` with a reason.
- Payload types are generated (`pnpm payload generate:types`) and committed. Regenerate after any collection change; CI fails on a diff.
- Money is an integer in minor units with `currency` and `decimals` beside it. Never use floating point for money. Use `packages/core/money`.
- Timestamps are ISO 8601 UTC in storage; format for display with the market timezone.
- Prettier formats everything; do not hand-format. ESLint must pass with zero warnings.
- Naming: collections PascalCase plural (`StockMovements`), slugs kebab-case (`stock-movements`), fields camelCase, database columns snake_case (Payload default), env vars SCREAMING_SNAKE.
- Files: one component per file, named as the component. Services in `packages/core` export a class or a set of functions with an explicit interface; no default exports outside Next.js pages.

## Payload conventions

- Every collection has `access` for `read`, `create`, `update`, `delete` written as named functions in `packages/payload/access/`. Never inline `() => true` on a commercial or inventory collection.
- `StockMovements` is insert-only: `create`, `update` and `delete` access return `false` for everyone including admins (the ledger writes it directly), and so do `StockLevels`, `SerialNumbers` and `Reservations`.
- Field-level `access.read` on `cost`, `landedCost`, `margin`, `contractPrices`, `creditLimit` (`canReadCost` for cost fields). Values only a system service writes (received quantities, posting stamps) get `access: { create: systemWritten, update: systemWritten }`.
- Local API calls made on behalf of a user pass `overrideAccess: false`. `overrideAccess: true` is allowed only inside `packages/payload/system/` and must carry a comment explaining why.
- Content and pricing collections use `versions: { drafts: true }`. Publishing requires the `publisher` role.
- Hooks are small and named for what they do (`revalidateStorefront`, `queueEmbedding`, `writeSlugRedirect`). A hook that does I/O to an external system enqueues a job instead of calling out directly.
- Jobs: every external call (accounting, courier, WhatsApp, LLM, email) runs as a queued task with an idempotency key, retries with backoff, and lands in the dead-letter view on final failure.
- Migrations: `pnpm payload migrate:create <name>`; never edit a migration that has been merged; write a new one.

## Next.js conventions

- App Router. Public routes live under `app/(frontend)/[market]/[locale]/`. Market and locale are validated in `apps/web/src/proxy.ts` (Next.js 16's name for middleware) against the `Markets` global; unknown or non-live values 404. Pages call `requireMarketRoute(params)`. Never `notFound()` from the market layout; see ADR 0002.
- Rendering: content pages are ISR with `revalidateTag` from Payload hooks (`revalidateStorefront`, `{ expire: 0 }`); anything reading a session, stock promise or buyer price is dynamic with `private, no-store`, or a live island inside an ISR page that renders the value at build time and refreshes it from a `private, no-store` `/api/v1` handler (`LiveStockLine`; ADR 0006). Cache Components is not enabled. Shop listings with filter, sort or page parameters render the dynamic twin `shop-results` through `proxy.ts`; the unfiltered listing stays ISR and never reads `searchParams` (ADR 0007).
- Data access from server components goes through the Payload Local API via `packages/payload/client`. Browsers call only `/api/v1/*` route handlers, validated with Zod.
- Legacy query-string redirects (`?bid=`, `?catid=`) are resolved in `proxy.ts` from the `LegacyRedirects` table; the redirects plugin handles path redirects only.
- Images through `next/image` with `sizes`; the LCP image is `priority`. No inline SVG icons; use the icon set in `packages/ui`.

## UI, RTL and accessibility

- Tokens only: colours, type, spacing and radii come from `packages/ui/src/tokens.css` (`--alpha-*`) through the Tailwind 4 theme in `@alpha/config/tailwind/theme.css`; Tailwind's default palette is switched off. No hex values in components. Text and lines use the role tokens (`text-ink`, `text-ink-muted`, `border-line-strong`, `text-critical`); amber, signal-green and bronze never colour text on a light background (contrast and conventions tests enforce this). See ADR 0003.
- Logical properties only: `ms-`, `me-`, `ps-`, `pe-`, `text-start`, `border-s`. The lint rule `alpha/no-physical-direction` fails on `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`.
- Direction icons (arrows, chevrons) get `rtl:-scale-x-100`. Logos, media controls and numerals never mirror.
- Numerals are Western digits everywhere, including Arabic pages. Prices use `formatMoney()` from `packages/core/money`.
- Every component ships a Storybook story for: default, loading, empty, error, RTL (exports `Default`, `Loading`, `Empty`, `Error`, `Rtl` named "RTL"). A component missing any state is not done; `components.conventions.test.tsx` lists what is missing. A visual change needs regenerated snapshots (`pnpm --filter @alpha/ui test:visual:update`) in the same PR.
- WCAG 2.2 AA: keyboard operable, visible focus, 44×44 px targets, labels tied to inputs, colour never the only signal. Run `pnpm test:a11y` before opening a PR.

## Testing

- Unit tests with Vitest next to the code (`*.test.ts`). `packages/core` and `packages/acoustics` require 90% line coverage; CI enforces it.
- Integration tests against a fresh, migrated Postgres in `apps/web/tests/integration/` (the Payload config lives in the app; `helpers/suite.ts` boots it): access functions, hooks, migrations, jobs. `DATABASE_URL` points at a server, otherwise Testcontainers starts one.
- Mandatory tests that must always exist and pass:
  - `ledger.invariants.test.ts`: no level below zero; movements sum to levels; each serial has one current state.
  - `reservation.concurrency.test.ts`: 200 parallel reservations on one SKU end with zero negative stock.
  - `price.leak.test.ts`: two companies sign in; neither can read the other's prices, stock setting, credit or quotes.
  - `price.rounding.test.ts`: 2-decimal and 3-decimal currencies, VAT as `total × rate ÷ (100 + rate)`.
  - `rtl.snapshots`: every component in LTR and RTL.
- End-to-end with Playwright in `apps/web/e2e/`: checkout in `ae/en` and `ae/ar`; dealer order with approval; receiving flow.
- Do not mock the database in integration tests. Do mock external providers with the fixtures in `packages/core/fixtures/`.
- LLM code is tested with the evaluation harness in `packages/llm/eval`; prompt or tool changes must run it.

## Git and pull requests

- Branches: `type/scope-short-title` (`feat/ledger-reservations`, `fix/checkout-vat-rounding`).
- Conventional Commits: `feat(scope): …`, `fix(scope): …`, `chore(deps): …`, `docs(adr): …`. Squash merge.
- One task per PR. Reference the task file (`docs/tasks/0004-ledger.md`) in the description and tick its acceptance criteria.
- PR description template: what changed, why, how tested, migration included (yes/no), RTL checked (yes/no), access rules tested (yes/no), screenshots for UI.
- Never commit secrets, `.env`, generated media or `node_modules`. Never force-push `main`.
- Any change to stack, data-model boundaries, integrations or security posture needs an ADR in `docs/adr/NNNN-title.md` in the same PR.

## Definition of done for any task

- Acceptance criteria in the task file all pass.
- Typed schema and migration committed; generated types regenerated.
- Access rules tested; both locales; RTL; loading, empty and error states.
- Telemetry events named as in `docs/spec` (observability section).
- Docs updated: ADR or runbook where relevant, `.env.example` for new variables.
- `pnpm check` (type-check, lint, unit, integration, a11y) green locally before the PR.

## What not to do

- Do not add a second ORM, query builder or state library. Payload's Local API plus Drizzle (bundled with the Postgres adapter) is enough.
- Do not use the Payload ecommerce plugin for orders, pricing or stock; it is beta and cannot express per-buyer pricing. Custom collections only.
- Do not put business logic in React components or route handlers; call a service in `packages/core`.
- Do not fetch external APIs from hooks synchronously; enqueue a job.
- Do not compute prices, VAT or stock in the browser.
- Do not translate Arabic copy with the LLM for publication; mark it `draft` for the native reviewer.
- Do not skip the concurrency and leak tests to get a build green.

## Useful commands

```
pnpm dev                 start everything locally
pnpm check               type-check + lint + unit + integration + a11y
pnpm test:e2e            Playwright against the local app
pnpm payload migrate:create <name>
pnpm payload generate:types
pnpm --filter @alpha/ui storybook       component library with the direction toolbar
pnpm test:visual         LTR and RTL screenshots of every story
pnpm eval:llm            run the Advisor evaluation set
```
