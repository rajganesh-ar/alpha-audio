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

- [ ] No hex value appears in any component file (lint rule `alpha/no-raw-color`).
- [ ] Every component has all five stories; a CI check lists components missing one.
- [ ] Storybook axe check passes with no violations on every story.
- [ ] Snapshots exist for LTR and RTL and are stable across two runs.
- [ ] Amber is never used as small text on a light background; the `Button` primary uses amber fill with lacquer text.
