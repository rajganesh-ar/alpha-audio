# ADR 0003 — Design tokens, fonts and the component library

- Status: Accepted
- Date: 2026-10-14
- Task: `docs/tasks/0003-design-tokens-and-ui.md`

## Context

`packages/ui` is the one component library for the storefront, the dealer board and the warehouse PWA. It must run in both directions and both languages, keep amber for the next action, meet WCAG 2.2 AA, and prove all of that in CI rather than by review.

## Decision

### 1. Tokens are plain CSS; the Tailwind 4 theme maps them with `@theme inline`

`packages/ui/src/tokens.css` holds every value, as `--alpha-*` custom properties: palette, type scale, 4 px spacing base, grid, radii and motion. It is the only file with hex values. `@alpha/config/tailwind/theme.css` maps each token to a Tailwind key: `--color-lacquer: var(--alpha-color-lacquer)`.

- **`inline`:** a utility resolves the token on the element where it is used (`.bg-lacquer { background-color: var(--alpha-color-lacquer) }`). A token overridden on a subtree, such as a dark band or reduced motion, therefore applies there. Without `inline`, the value would be fixed at `:root`.
- **The `--alpha-` prefix:** keeps the tokens apart from Tailwind's own `--color-*` names. Re-declaring `--color-lacquer: var(--color-lacquer)` would be a self-referencing variable.
- **Defaults reset:** Tailwind's palette, fonts, type sizes, radii and shadows are set to `initial`. `bg-red-500` and `rounded-xl` do not exist, so the only colours a component can name are tokens.

The old JS preset (`tailwind.preset.js`) is removed; Tailwind 4 is configured in CSS.

### 2. Colour roles, a dark tone, and rules derived from measured contrast

Components use **roles** rather than raw palette entries for text and lines: `ink`, `ink-muted`, `line`, `line-strong`, `focus` and `critical`, derived with `color-mix()`, so still no new colours. A `[data-tone='dark']` subtree (lacquer bands, the footer) re-points the roles, so the same Button, Card or MarketSwitch is correct on lacquer with no per-component code.

`src/contrast.test.ts` computes WCAG ratios from `tokens.css` itself and pins every pair the components use, light and dark. The measurements set the rules:

| Colour       | On aluminium | Rule                                                                                                                                      |
| ------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| vu-amber     | 2.0:1        | Never text on light. Primary is an amber fill with lacquer text (7.8:1); amber text only on lacquer.                                      |
| signal-green | 3.8:1        | Icons and borders only; the words stay ink.                                                                                               |
| bronze       | 3.5:1        | Hairlines and icons only.                                                                                                                 |
| alert        | 5.6:1        | Text on light. On lacquer it is 2.8:1, hence the `critical` role (alert tinted to 5.9:1 inside dark bands). axe found this in the footer. |

`src/components.conventions.test.tsx` fails any component that uses amber, green or bronze as text. Icon colours and the primary hover pair are exempt.

### 3. Fonts: Fontsource files, one stack per role, preloads per locale

- **Source:** files come from pinned `@fontsource/*` packages (OFL), already subset by Unicode range. They are not committed. `alpha-sync-fonts <dir>` (bin of `@alpha/ui`) copies them to `public/fonts/<version>/` in the app and `.fonts/` for Storybook. The versioned path lets `next.config.mjs` serve them as `immutable` for a year.
- **`src/fonts/faces.json`:** the single manifest for family, file, axes, range and preload locales. `fonts.css` (the `@font-face` rules, `font-display: swap`) is generated from it and pinned by a Vitest file snapshot. A test checks every file, version and Unicode range against the installed packages, so a Fontsource upgrade cannot drift silently.
- **One stack per role** (`'Archivo', 'IBM Plex Sans Arabic', …` for body; `'Archivo', 'Noto Kufi Arabic', …` for display). The Arabic faces cover only the Arabic range, so Latin text and Western digits always render in Archivo, and Arabic files download only when a page has Arabic text. Nothing switches fonts by language.
- **`preloadFonts(locale)`** emits React 19 `preload()` hints. English needs one file; Arabic needs three, about 250 KB. A test enforces the spec's four-file budget.
- **Not `next/font`.** Its options must be literals in app code, so it could not share the manifest with Storybook or preload per locale. The cost is no automatic fallback-metric (`size-adjust`) tuning. That is a CLS follow-up for the performance task.

### 4. Icons

`Icon` wraps `lucide-react` (pinned) behind a closed name list; components never inline SVG. Directional icons (`chevron-forward`, `arrow-forward`) carry `rtl:-scale-x-100`; nothing else mirrors.

### 5. Storybook 10 and the direction toolbar

Storybook (`@storybook/react-vite`, Tailwind through `@tailwindcss/vite`) gets a **Direction** toolbar built on Storybook globals. It sets `dir` and `lang` on `<html>`, as the app does. A third-party RTL addon was not needed for that. Each component's `RTL` story fixes `parameters.direction = 'rtl'` and uses the Arabic dictionary. `@storybook/addon-a11y` shows axe results in the UI.

### 6. What CI proves, and how

| Check       | Where                                                  | What                                                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Five states | `components.conventions.test.tsx` (unit)               | Every `src/components/*` has Default, Loading, Empty, Error and RTL stories; the failure lists each component and missing state. Also checks the spacing scale (1, 2, 3, 4, 6, 8, 12, 16 steps), one component per file, and that every story renders on the server. |
| No hex      | `alpha/no-raw-color` (lint)                            | As before; tokens.css is the only colour file.                                                                                                                                                                                                                       |
| axe         | `pnpm test:a11y` (Playwright + `@axe-core/playwright`) | Every story, LTR and RTL (220 cases), WCAG 2.0–2.2 A/AA tags, zero violations. The addon's own run is set to manual in the URL, so only one axe instance runs.                                                                                                       |
| Snapshots   | `pnpm test:visual`                                     | One baseline per story and direction in `tests/stories/__screenshots__`, zero pixel tolerance; CI runs the suite twice. Stories that render nothing on purpose pin their markup as text instead.                                                                     |

Both suites read the stories from the built Storybook's `index.json`, so a new story is covered without being listed.

- **Pinned Playwright:** `@playwright/test` is pinned to **1.56.1** because it drives Chromium build 1194. That build is preinstalled in the cloud workspace, and CI's `playwright install chromium` fetches the same one. Baselines are therefore made and checked by the same browser binary, with self-hosted fonts.
- **Baselines are committed** (about 2.3 MB). They are test fixtures, not media.
- **Updating baselines:** `pnpm --filter @alpha/ui build-storybook && pnpm --filter @alpha/ui test:visual:update`, then review the image diff in the PR.

### 7. Component API conventions

- Every visible string is a prop; stories take theirs from the dictionaries.
- States are props (`loading`, `error`, empty input), not separate components.
- Optional props accept `undefined` explicitly, so callers can pass values straight through under `exactOptionalPropertyTypes`.
- `PriceBlock` formats with `formatMoney()` and never computes; amounts, VAT and instalments arrive from `packages/core`.
- Props are plain types rather than Payload's generated types. Packages never import apps; the app maps Payload documents to props.

## Consequences

- Any visual change to a component needs regenerated baselines in the same PR.
- If CI's Chromium and the workspace's ever stop matching (a Playwright bump), regenerate all baselines with the new version in one `chore(deps)` PR.
- The `test:a11y` and `test:visual` runs take about two minutes each against a static build; CI also installs the Playwright browser.
- The Payload admin is untouched: Tailwind and its preflight load only with the storefront's stylesheet.
- `StockLine` is the static variant. The live, ledger-backed fragment comes with the stock task.
- Font fallback metrics are left to the performance task.
