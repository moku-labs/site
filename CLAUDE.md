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

This is a **Layer 3 consumer app** in the three-layer Moku model. It imports `createApp` and
`createPlugin` from `@moku-labs/web` and supplies plugin config overrides. It never depends on
`@moku-labs/core` at run time (the kernel errors are triggered through `@moku-labs/web`).

Entries:

- `src/app.ts` — Node SSG composition: web's browser-safe defaults plus the Node-only framework
  plugins (content, collection, data, build, deploy, cli) and the site's three plugins. Driven by the
  thin `scripts/{build,serve,preview,deploy}.ts` entries via `app.cli.*`. `scripts/build.ts` also
  awaits `app.search.write()` and `app.llms.write()` after `app.cli.build()`: the writes the
  `build:complete` hooks started, not a second write.
- `src/spa.tsx` — browser bundle entry (`@moku-labs/web/browser`). It omits every Node plugin.
- `src/routes.tsx` — the single route table, shared by both entries and by `urls`. Docs routes
  have fixed depth: `/docs/`, `/docs/{pkg}/`, `/docs/{pkg}/{page}/`, `/docs/{pkg}/{section}/{page}/`.
- `src/config.ts` — `SITE`, `LINKS`, `SEARCH_INDEX`, `OUT_DIRECTORY` constants (browser-safe).
- `src/index.html` / `src/404.html` — the document shell and the Cloudflare 404 page.

Site plugins (`src/plugins/`, Node only, composed in `src/app.ts`):

- `docs` — walks `content/docs/**`, parses frontmatter, enforces the depth rule, renders through
  `contentPlugin.renderMarkdown`. API: `all`, `get`, `byPackage`, `nav`, `neighbours`, `params`.
  Pages load once per build run: the `build:phase` that starts a run empties the cache.
- `search` — builds the ⌘K index (pages, packages, docs headings, demos) and writes
  `dist/search/en.json` through `collectionPlugin`.
- `llms` — writes `llms.txt`, `llms-full.txt` and one `.md` twin per page.

One browser plugin (`src/plugins/prefetch/`, composed only in `src/spa.tsx`):

- `prefetch` — warms `app.data.at(path)` for links on hover, touch, focus and a few in view, so
  the SPA finds the next page's data in the data plugin's cache. Logic in `src/lib/link-prefetch.ts`.

The name-reference trick: `routes.tsx` ships to the browser, but its loaders need the Node
plugins. `src/lib/docs-reference.ts` and `content-reference.ts` export
`{ name: "docs" } as typeof docsPlugin` (type-only import). `ctx.require(docsReference)` finds the
plugin by name at build and is fully typed, and the plugin code never enters the client bundle.
Loaders also import their Node helpers lazily (`import("./lib/docs-data")`). Keep both rules when
adding a route: never import a plugin or a Node module into `routes.tsx` directly.

`src/lib/` — stateless modules, unit tested:

- Build data: `docs-data` (page views, sidebar, prev/next), `docs-params` (route params),
  `home-data`, `packages` (versions from `node_modules`), `kernel-errors` (real kernel messages),
  `snippets` (compiles `check` blocks), `diagrams` (fills `::diagram` figures), `code-theme`
  (CSS-variable Shiki theme).
- Markdown pipeline (`lib/markdown/`): `directives` (remark: callout, steps, flow, gotchas,
  diagram, terminal, prompt), `code-blocks` (rehype: file, group, hl, notes, diff), `heading-ids`,
  `tables`, and `agent-markdown` (docs Markdown to plain Markdown for the llms files).
- Browser logic: `link-prefetch` (which links the `prefetch` plugin warms), `landing-prompts`
  (which four landing prompts the `code-block` island swaps in).
- Island logic: the hero's assembly in `assembly` (the rules: add, wait, settle, the code card),
  `hero-world` (platforms, cubes, sockets, label placement, needs arcs), `hero-view` (the world
  drawing as SVG nodes and the panel, shared by the SSR hero and the island), `hero-state` (which
  goal shows and what a drop shows), `kernel-flight`, `hero-props`; then `glyphs` (lid glyph paths),
  `iso`, `pyramid`, `demos`, `search-results`, `search-palette`.
- `url-builder`, and the two `*-reference` modules above.

UI:

- `src/pages/` — home, docs hub, doc page, demos, about.
- `src/components/` — layout, header, footer, docs sidebar/TOC/meta, hero, kernel world, pyramid,
  layers stack, search palette and the rest; each with its own CSS file.
- `src/islands/` — `code-block`, `copy-page`, `demo-filter`, `kernel-world`, `layers-stack`,
  `pyramid`, `search-palette`, `site-nav`, `theme-toggle`, `toc-spy` (registered in
  `islands/index.ts`; `kernel-world.ts` only wires its parts in `kernel-world/`); `clipboard`,
  `dataset`, `world-tip` are shared helpers, not islands. Inputs
  arrive as a JSON `data-props` attribute rendered by the host component.
- `src/styles/main.css` — the CSS bundle entry (`@layer` order, tokens, code theme variables).

Data and content:

- `content/docs/<pkg>/[<section>/]<page>.md` — the docs. `<pkg>` is an id from
  `src/data/packages.ts` or `concepts`. Syntax: see README "Writing docs".
- `src/data/` — `packages`, `demos`, `about`, `prompts`, `assembly` (the hero's goals, pieces and
  every word it shows). No version or kernel error string is ever typed here or in content
  (decision D1).
- `public/` — art and fonts, copied to `dist/`.

Source stays FLAT under `src/` (no client/server split).

## Deploy

Cloudflare Pages project `moku-labs` (`wrangler.jsonc`), output `dist/`. `.github/workflows/ci.yml`
is the thin caller of `moku-labs/ci` `app-deploy`: typecheck, lint, `test:coverage`, build on every
PR; `bun run deploy` on a push to `main`. Secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
live in the GitHub repository; locally in `.env` (gitignored).

## Testing

- Vitest with unit + integration projects
- `tests/unit/` and `tests/integration/`; plugin tests in `src/plugins/<name>/__tests__/`
- `tests/integration/docs-snippets.test.ts` compiles every `check` block of `content/docs` (stubs of
  the reader's project in `content/snippet-stubs/<package>/`) and fails a ts block with no `check`
  or `no-check="reason"`; `tests/integration/api-reference.test.ts` compares `api.md` with the real exports;
  `tests/integration/assembly-code.test.ts` compiles the hero's three finished snippets the same way
  (stubs in `content/snippet-stubs/assembly-<goal>/`)
- `tests/integration/build.test.ts` runs `bun scripts/build.ts` in a temp copy of the project
  (never touches `dist/`) and checks every docs page has HTML, a `.md` twin, an `llms.txt` line and
  a search row
- `tests/support/shiki-languages.ts` trims Shiki to the languages the docs write, in the vitest workers
  and in the build test's build. A new docs language goes on its list. The commit hook and CI build
  with every language
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
