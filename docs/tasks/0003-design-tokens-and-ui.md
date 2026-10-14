# Task 0003 — Design tokens, `packages/ui` and Storybook

Phase: P0 Foundations. Depends on: 0001. Spec: section 4 (Design system).

## Goal

A token-driven component library with Storybook, RTL stories and visual snapshots, used by `apps/web`.

## Deliverables

- `packages/ui/tokens.css` with the palette (lacquer `#141B24`, aluminium `#F2F3F5`/`#D5D8DC`, graphite `#252C34`, bronze `#9A7B56`, vu-amber `#E3A13B`, signal-green `#3F8A5F`, alert `#A6412A`), type scale, spacing scale, radii, motion durations; mirrored into the Tailwind 4 theme in `packages/config`.
- Fonts: Archivo (Latin), Noto Kufi Arabic and IBM Plex Sans Arabic (Arabic), JetBrains Mono (data); subset and self-hosted; `font-display: swap`; preload helper.
- Components (each with default, loading, empty, error, RTL stories): `AppShell`, `Header`, `MarketSwitch`, `AnnouncementBar`, `Footer`, `QuietActions`, `Breadcrumb`, `Section`, `Grid`, `Button` (primary amber, secondary outline, quiet), `Input`, `Select`, `Chip`, `Badge`, `Card`, `Skeleton`, `EmptyState`, `ErrorState`, `PriceBlock`, `StockLine` (static variant), `Marker` (numbered amber dot).
- Storybook with the RTL toolbar addon and axe addon; Playwright screenshot job producing LTR and RTL snapshots per story.
- `packages/ui/i18n`: dictionary loader and `t()` helper with typed keys; missing key fails the build.

## Acceptance criteria

- [x] No hex value appears in any component file (lint rule `alpha/no-raw-color`). _Hex lives only in `src/tokens.css`; Tailwind's default palette is switched off._
- [x] Every component has all five stories; a CI check lists components missing one. _`src/components.conventions.test.tsx` (unit tests in CI), naming each component and missing state._
- [x] Storybook axe check passes with no violations on every story. _`pnpm test:a11y`: 220 cases (every story, LTR and RTL), WCAG 2.0–2.2 A/AA._
- [x] Snapshots exist for LTR and RTL and are stable across two runs. _`pnpm test:visual`: 204 screenshots + 18 markup pins, zero tolerance; CI runs it twice._
- [x] Amber is never used as small text on a light background; the `Button` primary uses amber fill with lacquer text. _`src/contrast.test.ts` measures it; the conventions test enforces it._

## Implementation notes

- Tokens are `--alpha-*` custom properties mapped into Tailwind 4 with `@theme inline` (`@alpha/config/tailwind/theme.css`); colour roles and a dark tone sit on top of the palette. See ADR 0003.
- Fonts: `src/fonts/faces.json` → generated `fonts.css` + `preloadFonts(locale)`; files synced by `alpha-sync-fonts`, not committed.
- Beyond the inventory: `Icon` (the icon set), `GridItem` (placement in `Grid`) and `SuggestedMarketBanner` (from task 0002) follow the same five-story rule.
- The i18n dictionary and typed `t()` landed in task 0002; this task added the shared UI copy (loading, retry, price, stock, form).
- Props are plain types; mapping from Payload's generated types happens in the app (packages never import apps).
