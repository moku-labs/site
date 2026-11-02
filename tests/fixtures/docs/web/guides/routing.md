---
title: Routing
description: "route().load().render().head(): the route is the single contract."
section: Guides
order: 10
---

## How routing works

A route is a URL pattern plus optional handlers. The router plugin compiles the table once, at `createApp`. The build expands each route into concrete pages; in the browser, spa matches the URL and runs `render`.

:::flow
- pattern
- **generate**
- **load**
- **head**
- **render**
- index.html
:::

## Patterns

| Syntax | Meaning | Example |
|---|---|---|
| `{name}` | Required param | `/{slug}/` |
| `{name:?}` | Optional param | `/archive/{page:?}/` |
| `{lang:?}` | Locale slot. The default locale is served at bare paths; it does not count toward specificity. | `/{lang:?}/{slug}/` |

## Define routes

```tsx file="src/routes.tsx" group="define" hl="4,9"
import { createUrls, defineRoutes, route } from "@moku-labs/web/browser";
import { contentPlugin } from "@moku-labs/web/browser";

export const routes = defineRoutes({ // [!note] defineRoutes keeps the literal types for IntelliSense.
  home: route("/").render(() => <Home />),
  post: route("/{slug}/")
    .generate(async ctx => slugs(ctx)) // [!note] generate returns the param sets to pre-render.
    .load(ctx => ctx.require(contentPlugin).load(ctx.params.slug))
    .render(ctx => <Post post={ctx.data} url={ctx.url} />)
    .head(ctx => ({ title: ctx.data.title }))
    .meta({ section: "blog" }) // [!note] meta is a JSON bag shipped in clientManifest().
});
```

```ts file="src/app.ts" group="define"
import { createApp } from "@moku-labs/web";
import { routes } from "./routes";

export const app = createApp({ pluginConfigs: { router: { routes } } });
```

### Load data

```diff lang=ts file="src/routes.tsx"
 post: route("/{slug}/")
-  .render(() => <Post />)
+  .load(ctx => loadPost(ctx.params.slug))
+  .render(ctx => <Post post={ctx.data} />)
```

## At build

```sh terminal title="build"
$ bun run build
moku web 2.4.11
✓ pages   2 routes → 31 pages
✕ one route has no render
BUILD  31 pages in 1.21s → dist/
```

## Ask Claude

```text prompt
Build a blog with tags and an RSS feed on @moku-labs/web
```

:::callout[One route table.]
The build, the SPA and every link read the same table.
:::

:::callout{tone="warn"}
`load` and `generate` never run in the browser.
:::

:::callout{tone="good"}
Routes are typed end to end.
:::

## Steps

:::steps
1. **Install** — add the framework and its peers.
2. **Write routes** — one table in `src/routes.tsx`.
3. **Build** — `bun run build` writes `dist/`.
:::

## The picture

::diagram[Build, SSG HTML, hydration, SPA navigation.]{name="pipeline"}

## Gotchas

:::gotchas
- **No runtime registration.** `pluginConfigs.router.routes` is the only path.
- **The mode is global.** Set `createApp({ config: { mode } })`.
:::

> A blockquote for good measure.
