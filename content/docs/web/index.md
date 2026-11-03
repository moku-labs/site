---
title: "@moku-labs/web"
description: "Content static-site generator and SPA framework. Same render at build and in the browser."
section: Get started
order: 1
---

## What it is

`@moku-labs/web` renders Preact pages to static HTML for search engines and first paint. Then it
hydrates islands and, if you want it, navigates on the client from JSON. The same `render`
function runs at build and in the browser, so both produce the same output.

It is a Moku framework: the `@moku-labs/core` kernel plus a list of plugins. You write one
`createApp` call. The browser-safe plugins are always there. You add the Node-only plugins for
the build.

### Five things it does

- **[SSG and SPA parity](/docs/web/how-it-works/).** The same route at build and in the browser. The build writes
  HTML, the browser re-runs the same `render` with the saved data.
- **[A typed route](/docs/web/guides/routing/).** `route("/{slug}/").load().render().head()`.
  Params come from the pattern, `ctx.data` from `load`.
- **[SEO tags](/docs/web/guides/head/).** Title template, canonical, Open Graph, Twitter,
  JSON-LD, hreflang, feeds, sitemap and OG images.
- **[A node-free browser entry](/docs/web/api/).** `@moku-labs/web/browser` has zero Node imports
  in its graph. About 50 kB gzip.
- **[Islands](/docs/web/guides/islands/).** Only the interactive parts run in the browser, each
  with its own state, render, events and API.

## Quick start

:::steps
1. **Install** the framework and its peers: `bun add @moku-labs/web @moku-labs/core @moku-labs/common preact preact-render-to-string`.
2. **Write the routes** with `route()`: a pattern, a `load`, a `render`, a `head`.
3. **Compose the app** with `createApp`, adding `contentPlugin` and `buildPlugin` for the build.
4. **Build** with `await app.build.run()`. The site is in `dist/`.
:::

A whole static blog fits in two files:

```tsx file="routes.tsx" check
import { defineRoutes, route } from "@moku-labs/web/browser";

export const routes = defineRoutes({
  home: route("/")
    .render(() => <h1>My Blog</h1>)
    .head(() => ({ title: "My Blog" })), // [!note] `.head()` feeds the title template, canonical and OG tags.
  about: route("/about/")
    .render(() => <p>Notes on the web.</p>)
    .head(() => ({ title: "About" }))
});
```

The [quick start](/docs/web/quick-start/) goes from an empty folder to a deployed site.

## Two entry points

| Entry | Format | Use it for |
|---|---|---|
| `@moku-labs/web` | ESM and CJS | The Node build. Everything, including `buildPlugin`, `deployPlugin`, `cliPlugin`, `fileSystemContent` and the Node env providers. |
| `@moku-labs/web/browser` | ESM only | The client bundle. The same `createApp` over the same defaults, plus `dataPlugin`, the route helpers, `createIsland` and the head helpers. `env` reads `browserEnv()` with no config. |

## The eleven plugins

The defaults are loaded by every `createApp`. You can only configure them. The others you add in
`plugins: [...]`.

| Plugin | Kind | What it does |
|---|---|---|
| [site](/docs/web/plugins/site/) | default | Site name, URL, author, description, canonical URLs. |
| [i18n](/docs/web/plugins/i18n/) | default | Locales, default locale, translations, `og:locale` map. |
| [router](/docs/web/plugins/router/) | default | The route table, the matcher, URL and file paths, the render mode. |
| [head](/docs/web/plugins/head/) | default | The `<head>` of every page. |
| [spa](/docs/web/plugins/spa/) | default | Islands, intercepted navigation, progress bar. Inert on Node. |
| [content](/docs/web/plugins/content/) | Node build | Markdown articles to HTML, with locale fallback. |
| [collection](/docs/web/plugins/collection/) | optional | `(collection, shard)` → JSON file, read on demand. |
| [data](/docs/web/plugins/data/) | optional | Page path → JSON file, for client navigation. |
| [build](/docs/web/plugins/build/) | Node-only | The static build into `dist/`. |
| [deploy](/docs/web/plugins/deploy/) | Node-only | Cloudflare Pages through wrangler. |
| [cli](/docs/web/plugins/cli/) | Node-only | `build`, `serve`, `preview`, `deploy` with the branded panel. |

Two core plugins come with every app: `log` and `env`, from `@moku-labs/common`.

## Start with the Claude plugin

Install the moku plugin in Claude Code and describe the site in plain words. It knows this
framework, writes the routes, the islands and the tests, and runs the build.

```sh terminal title="Claude Code"
$ /plugin marketplace add moku-labs/claude
$ /plugin install moku@moku-labs
```

```text prompt
Add an island that filters my article list in the browser
```

```text prompt
Translate my site into German, with hreflang tags on every page
```

```text prompt
Give every page Open Graph tags, a sitemap and an RSS feed
```

```text prompt
Deploy my @moku-labs/web site to Cloudflare Pages
```

## Where to next

- [Quick start](/docs/web/quick-start/): a static blog in two files, client navigation in a third.
- [How it works](/docs/web/how-it-works/): what the build writes and what the browser does.
- [Routing](/docs/web/guides/routing/): `route().load().render().head()`, the single contract.
- [Islands](/docs/web/guides/islands/): the parts that run in the browser.
- [API reference](/docs/web/api/): every export of both entries.
