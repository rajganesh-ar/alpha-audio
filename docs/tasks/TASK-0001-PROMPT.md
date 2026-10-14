# Paste this as the first Claude Code cloud session task

Set up the alpha-platform monorepo as specified in `docs/tasks/0001-monorepo-skeleton.md`, following every rule in `CLAUDE.md`.

Constraints:

- Use the official Payload 3 + Next.js template as the base for `apps/web`, pinned to the current Payload 3 minor and its supported Next.js 16 release; record the exact versions in `docs/adr/0001-monorepo-and-toolchain.md`.
- Postgres adapter with pgvector enabled by migration 0001; S3 storage adapter pointed at MinIO locally.
- Write the two custom ESLint rules (`alpha/no-physical-direction`, `alpha/no-raw-color`) as a local plugin in `packages/config/eslint-plugin-alpha` with unit tests.
- CI must run on GitHub Actions with a Postgres service for integration tests and fail on a generated-types diff.
- Do not add any dependency not named in `docs/tasks/0001-monorepo-skeleton.md` or `CLAUDE.md` without noting it in the ADR.

When finished: run `pnpm check`, confirm every acceptance criterion in the task file, tick them in the file, and open a PR titled `feat(repo): monorepo skeleton and CI` with the PR description template from `CLAUDE.md`.
