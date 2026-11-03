# moku-labs.com

**The Moku Labs site: docs for every Moku package, checked against the releases they describe.**

A static site built on [`@moku-labs/web`](https://github.com/moku-labs/web) and deployed to
Cloudflare Pages: the landing page with the isometric kernel world, the docs for twelve packages,
demos and about. It is a Moku Layer 3 app: one `createApp` call plus four plugins of its own. It is
not a docs generator: the Markdown lives here, and the checks below make sure it still matches npm.

<br/>

[![CI](https://github.com/moku-labs/site/actions/workflows/ci.yml/badge.svg)](https://github.com/moku-labs/site/actions/workflows/ci.yml)
[![built on @moku-labs/web](https://img.shields.io/badge/built%20on-%40moku--labs%2Fweb-1864ab)](https://github.com/moku-labs/web)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-f38020?logo=cloudflare&logoColor=white)](#deployment)
[![node](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](#requirements)
[![bun](https://img.shields.io/badge/bun-%3E%3D1.4.3-000000?logo=bun&logoColor=white)](#requirements)

<br/>

[Quick start](#quick-start) · [Writing docs](#writing-docs) · [How drift is prevented](#how-drift-is-prevented) · [Agent files](#agent-files) · [Deployment](#deployment) · [Scripts](#scripts)

---

## What it is

- **Docs that cannot lie about versions.** Every version on the site is read from
  `node_modules/@moku-labs/*/package.json` at build. None is typed by hand.
- **Kernel errors from the kernel.** The concepts page shows the exact messages the real kernel
  throws, captured at build.
- **Examples that compile.** A code block tagged `check` is compiled against the installed
  packages on every test run. A breaking release turns CI red, not the docs wrong.
- **Readable by agents.** Every page has a Markdown twin, plus `/llms.txt` and `/llms-full.txt`.
- **No client framework of its own.** Pages render at build; small islands add search, the theme
  toggle, copy buttons and the kernel world.

## Quick start

```sh
bun install
bun run dev        # build, serve on http://localhost:4173, watch, live reload
```

| Command | What it does |
|---|---|
| `bun run dev` | Build, serve, watch `src/` and `content/`, reload the browser. |
| `bun run build` | Static build into `dist/`, then the search shard and the agent files. |
| `bun run preview` | Serve the built `dist/` as it will be deployed. |
| `bun run deploy` | Deploy `dist/` to Cloudflare Pages: guided in a terminal, direct with `--cli` or in CI. |

> [!NOTE]
> Use `bun` only. The build reads versions from the installed packages, so run `bun install`
> after every pin change before you build.

## Writing docs

Docs are Markdown under `content/docs/`. The folder is the URL.

```text
content/docs/
  concepts/three-layers.md      → /docs/concepts/three-layers/
  web/index.md                  → /docs/web/
  web/quick-start.md            → /docs/web/quick-start/
  web/guides/routing.md         → /docs/web/guides/routing/
```

**The depth rule.** At most `<pkg>/<section>/<page>.md`. A deeper file, or a package folder that is
not in `src/data/packages.ts` (or `concepts`), fails the build with the file name.

### Frontmatter

```md
---
title: Routing
description: "route().load().render().head(): one typed builder is the contract."
section: Guides
order: 10
full: true
---
```

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | Page title, sidebar label and `<title>`. |
| `description` | yes | Meta description, search subtitle and the `llms.txt` line. |
| `section` | no | Sidebar group label. Default: `Concepts` for concepts, `Get started` for a package. |
| `order` | no | Sort key inside the group. |
| `kind` | no | `node` or `optional`: the runtime tag a plugin page shows in the sidebar. |
| `drift` | no | A manual drift note, shown instead of the in-sync badge. |
| `full` | no | `true` marks a full reference page. |

### Directives

```md
:::callout{tone="warn"}
`tone` is `neutral` (the default), `warn` or `good`.
:::

:::steps[Deploy in three steps]
1. Build.
2. Preview.
3. Deploy.
:::

::diagram[The build pipeline]{name="pipeline"}
```

`:::flow` and `:::gotchas` wrap a list the same way as `:::steps`. Any container takes an optional
`[Title]`. `::diagram` draws the inline SVG with that name, the `[…]` label is its caption; an unknown name fails the build.
`<!-- kernel-errors -->` expands to the list of real kernel errors. A paragraph that starts with
`:::` but is not a directive fails the build instead of showing the colons.

### Code fences

````md
```ts file="src/app.ts" group="setup" hl="3,5-7" check
import { route } from "@moku-labs/web/browser";
// [!note] Notes leave the code and become a numbered list under the block.
export const home = route("/");
```

```diff lang=ts check
-const old = 1;
+const value = 2;
```

```sh terminal title="build"
bun run build
```
````

| Meta | Effect |
|---|---|
| `file="…"` | The file tab label. |
| `group="…"` | Consecutive fences with the same group become one tabbed block. |
| `hl="3,5-7"` | Highlighted lines, counted as displayed. |
| `// [!note] text` | A numbered note; `# [!note]` in shell. It is removed from the code and from Copy. |
| `diff` | Language `diff` with `lang=ts`, or the flag `diff`: `+` / `-` / space rows. |
| `terminal` | A terminal frame, `title="…"` optional. |
| `prompt` | A prompt block, for text a reader pastes into Claude Code. |
| `check` | Compile the block on every test run (see below). |
| `no-check="reason"` | The block is not compiled, and says why. Every ts or tsx block has `check` or this. |

> [!IMPORTANT]
> A `check` block is compiled as a full module, imports included. There is no fragment mode.
> `check` works on `ts`, `tsx` and the result of a `diff`; on any other language it fails.
>
> Blocks with the same `group` on a page form one project, at their `file` paths. The page's other
> blocks with a `file` form the page's project. A relative import a project lacks resolves to
> `content/snippet-stubs/<package>/`: a small reader project with `src/routes.tsx`, `src/site.ts`,
> `src/app.ts`. So `import { routes } from "./routes"` compiles.

## How drift is prevented

| Guard | Where | Fails when |
|---|---|---|
| Versions from `node_modules` | `src/lib/packages.ts` | A package with docs is not installed. A typed version cannot exist. |
| Kernel errors from the real kernel | `src/lib/kernel-errors.ts`, `src/plugins/docs/` | A check stops throwing after a core release. |
| Hero code compiled | `tests/integration/assembly-code.test.ts`, `content/snippet-stubs/assembly-*/` | The finished Site, App or Game code of the hero uses an export the installed `web`, `worker` or `game` no longer has. |
| `check` blocks compiled | `src/lib/snippets.ts`, `tests/integration/docs-snippets.test.ts` | An example uses an API the installed packages no longer have, or a ts block has no `check` and no `no-check` reason. |
| API reference vs exports | `tests/integration/api-reference.test.ts` | A package export is missing from `api.md`, or `api.md` shows a signature the package no longer exports. |
| A full build in the tests | `tests/integration/build.test.ts` | A docs page has no HTML, no `.md` twin, no `llms.txt` line or no search row. |
| Pinned packages | `package.json`, Dependabot | A bump PR re-runs all of the above in CI before it can merge. |

All of it runs in `bun run test`, so locally, in the pre-commit hook and in CI.

## Agent files

| File | What it holds |
|---|---|
| [`/llms.txt`](https://moku-labs.com/llms.txt) | Every page by group, each linked to its `.md` twin with its description. |
| [`/llms-full.txt`](https://moku-labs.com/llms-full.txt) | Every docs page as one Markdown file. |
| `/<path>.md` | The Markdown twin of a page, e.g. [`/docs/web/guides/routing.md`](https://moku-labs.com/docs/web/guides/routing.md). Copy as Markdown on a docs page fetches it. |

The `llms` plugin writes them after the build, from the same pages the HTML comes from.

## Deployment

Cloudflare Pages project `moku-labs` (`wrangler.jsonc`), output `dist/`.

`.github/workflows/ci.yml` is the thin caller of the `moku-labs/ci` `app-deploy` workflow:
typecheck, lint, `test:coverage` and build on every PR, and `bun run deploy` on a push to `main`.

| Secret | Where |
|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub repository secrets; locally in `.env` (gitignored). |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub repository secrets; locally in `.env` (gitignored). |

## Scripts

```sh
bun run dev                # build, serve, watch, live reload
bun run build              # static build into dist/
bun run preview            # serve dist/
bun run deploy             # Cloudflare Pages deploy
bun run lint               # biome check + oxlint
bun run lint:fix           # auto-fix lint issues
bun run format             # format with biome
bun run typecheck          # tsc --noEmit
bun run test               # unit + integration, incl. the docs check and a full build
bun run test:unit          # unit tests only
bun run test:integration   # integration tests only
bun run test:coverage      # tests with coverage (90% on src/lib and src/plugins)
```

## Requirements

- **Node `>= 24`** and **Bun `>= 1.4.3`**. Use `bun` only, never npm, yarn or pnpm.
- **TypeScript 7** in strict mode, with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- **[`@moku-labs/web`](https://github.com/moku-labs/web)**: the framework. The other
  `@moku-labs/*` packages are dev dependencies so their versions and types can be checked.

## License

[MIT](./LICENSE) © [moku-labs](https://github.com/moku-labs)
