# site

The moku-labs.com website, a Moku Layer 3 consumer app built on the `@moku-labs/web` framework and
deployed to Cloudflare Pages.

## Package Manager

Use `bun` exclusively — never npm, yarn, or pnpm.

## Scripts

- `bun run build` — Static build to `dist/` (`app.cli.build()`)
- `bun run dev` — Build, serve, watch, live reload
- `bun run preview` — Serve the built `dist/`
- `bun run deploy` — Cloudflare Pages deploy (guided in a terminal, direct with `--cli` or in CI)
- `bun run lint` — Biome check + oxlint
- `bun run lint:fix` — Auto-fix lint issues
- `bun run format` — Format with Biome
- `bun run typecheck` — `tsc --noEmit`
- `bun run test` — Run all tests (vitest)
- `bun run test:unit` — Unit tests only
- `bun run test:integration` — Integration tests only
- `bun run test:coverage` — Tests with coverage

## Code Style

- **Formatter:** Biome (2-space indent, double quotes, semicolons, no trailing commas)
- **Linter:** Biome + oxlint (`.oxlintrc.json`: unicorn, jsdoc and abbreviation rules)
- **TypeScript:** 7, strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
- **Imports:** Use `import type`, enforced by Biome `useImportType`
- **JSDoc:** Required on all source exports with descriptions, params, returns, and examples

## Architecture

This is a **Layer 3 consumer app** in the three-layer Moku model. It imports `createApp` from
`@moku-labs/web` and supplies plugin config overrides. It never depends on `@moku-labs/core`.

- `src/app.ts` — Node SSG composition (`createApp` + node-only plugins), driven by the thin
  `scripts/{build,serve,preview,deploy}.ts` entries via `app.cli.*`.
- `src/spa.tsx` — browser bundle entry (imports from `@moku-labs/web/browser`).
- `src/routes.tsx` — the single route table, shared by both entries.
- `src/config.ts` — site identity constants (`SITE`).
- `src/index.html` / `src/404.html` — the app-owned document shell and the Cloudflare 404 page.
- `src/styles/main.css` — the CSS bundle entry (`@layer` order).
- `src/pages/`, `src/components/`, `src/islands/` — UI, per the `moku-web` skill.
- `src/plugins/` — optional Layer-3 plugins via the framework's `createPlugin`.

Source stays FLAT under `src/` (no client/server split).

## Deploy

Cloudflare Pages project `moku-labs` (`wrangler.jsonc`), output `dist/`. `.github/workflows/ci.yml`
is the thin caller of `moku-labs/ci` `app-deploy`: typecheck, lint, `test:coverage`, build on every
PR; `bun run deploy` on a push to `main`. Secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
live in the GitHub repository; locally in `.env` (gitignored).

## Testing

- Vitest with unit + integration projects
- `tests/unit/` and `tests/integration/`
- Coverage is measured on the pure-logic dirs (`src/lib/`, `src/i18n/`, `src/plugins/`), 90% threshold
- UI and islands are covered by the Playwright e2e station, not by unit tests

## Moku Development Toolkit

This project uses the **moku** Claude Code plugin. Talk to it in plain words — the `moku` conductor
skill works out where the project stands and drives the lifecycle (intake, brainstorm, design, plan,
build, verify, e2e, release, close). You never need to remember a command.

Underneath the conversation, `moku-rails` enforces the order: a source file cannot be written before
the station that is allowed to write it. When a write is refused, the reason names the missing step.

Useful directly:

- `/moku:status` — where the project stands.
- `/moku:check` — diagnostics on the installation and the project.
- `/moku:verify` — the validator fan-out with the auto-fix loop.
- `/moku:upgrade` — move the toolchain to the current target stack.

Knowledge skills load themselves when the topic comes up: **moku-core** (architecture, factory
chain, lifecycle, events), **moku-plugin** (plugin structure and tiers), **moku-common-conventions** (`ctx.log`,
`ctx.env`, the branded CLI rules MC1–MC3), **moku-testing**, **moku-readable-code**, plus the
**moku-web** pack for this framework.

## Specification

For questions about how things should be implemented, refer to the [Moku Core specification](https://github.com/moku-labs/core/tree/main/specification).
