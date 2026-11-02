---
title: build
description: "Node-only. The static build: every route to HTML, plus bundles, feeds, sitemap, OG images and cache headers."
section: Plugins
kind: node
order: 20
---

## What it does

**Node-only.** `build` renders every route of the route table to static HTML in `outDir`. Around
the pages it bundles your CSS and client JS, copies images and `public/`, and writes feeds, a
sitemap, OG images, a `404.html` and Cloudflare `_headers`.

Add it to the Node app: `createApp({ plugins: [buildPlugin] })`. Run it with
`await app.build.run()`, or through the [cli plugin](/docs/web/plugins/cli/).

## How it works

`build` orchestrates. It reads everything from other plugins through `ctx.require`: the routes
from `router`, the head from `head`, the articles from `content`, the locales from `i18n`. It
does no Markdown, head or URL work of its own. A run goes through fixed phases, in this order:

| Phase | What it does | Runs when |
|---|---|---|
| clean | Deletes and recreates `outDir`. | always, unless `run({ skipClean: true })` |
| `bundle` | `Bun.build` for CSS and JS, separately, with a content hash in every file name. | always |
| `content` | `content.loadAll()`, cached for the later phases. | always; empty without `content` |
| `images` | Copies static image folders. | `images` |
| `pages` | `generate` → `load` → `head.render` → `render` for every page, then the JSON sidecars. | always |
| `content-images` | Copies each article's co-located folders to `<slug>/…`. | `images` |
| `feeds` | `feed.xml`, `atom.xml`, `feed.json`. | `feeds` |
| `sitemap` | `sitemap.xml`, `robots.txt`. | `sitemap` |
| `og-images` | One PNG per article with Satori, plus `og-default.png`. | `ogImage` |
| `public` | Copies `publicDir` as it is. | the folder exists |
| `not-found` | `404.html`. | `notFound` |
| `locale-redirects` | Redirect pages for bare locale paths. | `localeRedirects` |
| `cache-headers` | `_headers` with cache rules, then your `public/_headers`. | `cacheHeaders` |
| `root-index` | Writes the `/` page to `index.html`. | a `/` page was rendered |

The phases from `feeds` to `locale-redirects` run together. When one fails, the error is logged
and the others still finish. A disabled phase emits no `build:phase` event.

The JS entry is `clientEntry`, or the first file found of `src/client/main.ts`,
`src/client/main.tsx` and `src/main.ts`. The CSS entry is `src/client/styles.css` or
`src/styles/main.css`. Every page also gets a `<meta name="build-id">` with the run id.

## Config

`pluginConfigs.build`. Every field has a default.

| Option | Type | Default | Description |
|---|---|---|---|
| `outDir` | `string` | `"./dist"` | Output folder. Must be inside the project or the OS temp folder: it is deleted on every run. |
| `minify` | `boolean` | `true` | Minify the CSS and JS bundles. |
| `feeds` | `boolean` | `true` | RSS, Atom and JSON feeds from the content articles. |
| `sitemap` | `boolean` | `true` | `sitemap.xml` and `robots.txt`. |
| `images` | `boolean` | `true` | Copy static images and co-located article folders. |
| `ogImage` | `OgImageConfig \| false` | `false` | OG image generation. An object turns it on. |
| `injectAssets` | `boolean` | `true` | Add the bundle `<link>` and `<script>` tags to every page. |
| `publicDir` | `string` | `"public"` | Copied into `outDir` as it is. Skipped when missing. |
| `notFound` | `boolean \| { body?, path? }` | `false` | `true`: a built-in page. `{ body }`: your HTML in a minimal shell. `{ path }`: your complete HTML file. |
| `localeRedirects` | `boolean` | `false` | Redirect pages for bare locale paths. |
| `clientEntry` | `string` | the scan above | The client bundle entry. |
| `env` | `readonly string[]` | none | Variable names written into the client bundle as constants. |
| `template` | `string` | built-in shell | Path to your HTML shell with `<!--moku:lang-->`, `<!--moku:head-->`, `<!--moku:assets-->`, `<!--moku:assets:css-->`, `<!--moku:assets:js-->` and `<!--moku:body-->`. |
| `cacheHeaders` | `boolean \| { assets?, pages? }` | `true` | `_headers` rules. Hashed bundles: `public, max-age=31536000, immutable`. Everything else: `public, max-age=0, must-revalidate`. |

`OgImageConfig`: `fontDir` (required, a folder with a `.ttf`, `.otf` or `.woff` file), `template?`,
`size?` (default 1200 × 630), `render?(input) => VNode`, `fonts?: OgFont[]` and
`defaultCard?: boolean | ((input) => VNode)`. The config is shallow-merged, so an `ogImage`
override replaces the whole object.

`env: ["IS_DEVELOPMENT"]` makes `process.env.IS_DEVELOPMENT` and `import.meta.env.IS_DEVELOPMENT`
constants in the bundle, set to the build machine's value or `""`. With `minify`, a branch on an
unset flag is removed together with the dynamic `import()` it guards.

## API

Mounted at `app.build`, reachable with `ctx.require(buildPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `run` | `(options?: RunOptions) => Promise<BuildResult>` | Runs the build. Resolves to `{ outDir, pageCount, durationMs }`. |
| `phases` | `() => PhaseName[]` | The phase names in order. |

`RunOptions`: `outDir?` (this run only), `skipClean?`, `overrides?` (any of `minify`, `feeds`,
`sitemap`, `ogImage`, `images`, `localeRedirects`, `notFound`, `cacheHeaders` for this run) and
`changed?` (paths changed since the last run, for a fast incremental rebuild).

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `build:phase` | `{ phase: PhaseName; status: "start" \| "done"; durationMs?: number }` | At each phase boundary. `durationMs` only on `"done"`. |
| `build:complete` | `{ outDir: string; pageCount: number; durationMs: number }` | Once, after a successful run. |

### Listens to

None.

## Depends on

- [site](/docs/web/plugins/site/), [router](/docs/web/plugins/router/) and
  [head](/docs/web/plugins/head/): required, in `depends`.
- [content](/docs/web/plugins/content/) and [i18n](/docs/web/plugins/i18n/): optional. A site
  without content builds zero articles; without i18n it builds the `"en"` locale.
- [data](/docs/web/plugins/data/): optional. When composed and the mode is not `"ssg"`, the pages
  phase writes the JSON sidecars.

## Example

```ts file="scripts/build.ts" check
import { buildPlugin, createApp, createPlugin, defineRoutes, route } from "@moku-labs/web";
import { h } from "preact";

const routes = defineRoutes({
  home: route("/").render(() => h("h1", null, "My Blog")),
  about: route("/about/").render(() => h("p", null, "About"))
});

const timingPlugin = createPlugin("timing", {
  depends: [buildPlugin], // [!note] Makes the build events visible to `hooks`, with typed payloads.
  hooks: ctx => ({
    "build:phase": ({ phase, status, durationMs }) => {
      if (status === "done") ctx.log.info("build:timing", { phase, durationMs });
    }
  })
});

const app = createApp({
  plugins: [buildPlugin, timingPlugin],
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    router: { routes },
    build: { outDir: "dist", feeds: false, notFound: true } // [!note] No content plugin here, so there is nothing to put in a feed.
  }
});

const result = await app.build.run();
console.log(`${result.pageCount} pages in ${result.durationMs}ms → ${result.outDir}`);
```

```sh terminal title="build"
$ bun scripts/build.ts
{ level: "warn", event: "build:bundle", data: { clientEntry: "none", scanned: [ "src/client/main.ts", "src/client/main.tsx", "src/main.ts" ] } }
{ level: "info", event: "build:timing", data: { phase: "bundle", durationMs: 1 } }
{ level: "info", event: "build:timing", data: { phase: "pages", durationMs: 1 } }
{ level: "info", event: "build:timing", data: { phase: "root-index", durationMs: 0 } }
2 pages in 3ms → dist
$ ls dist
404.html  _headers  about  index.html  robots.txt  sitemap.xml
```

The log lines are shortened here: each one is a structured record from `ctx.log`. The warning
says there is no client bundle, which is expected for a site without islands.

:::gotchas
- **`build:complete` handlers are not awaited.** Hooks are notifications. Work that must finish before the process exits goes after `await app.build.run()`.
- **`outDir` is deleted on every run.** `"./"`, your home folder or the project root fail with `[web] build.outDir: … is not a safe clean target.`
- **`ogImage.fontDir` is checked at `createApp`.** A missing folder or a folder without a font fails before the build starts.
- **No client entry is a warning, not an error.** Without `clientEntry` and without one of the scanned files, the build logs `build:bundle` with `clientEntry: "none"` and ships no JS.
- **Hard-coded bundle URLs break.** Bundle names carry a hash. In a `notFound` page or a `template`, use the `<!--moku:assets-->` placeholders.
- **`build` writes; it does not serve or deploy.** Use [cli](/docs/web/plugins/cli/) for a dev server and [deploy](/docs/web/plugins/deploy/) to ship.
:::

## Related

- [Build & deploy](/docs/web/guides/deploy/): the scripts and the first deploy.
- [Head & SEO](/docs/web/guides/head/): feeds, sitemap and OG images.
- [Data](/docs/web/guides/data/): the JSON sidecars.
