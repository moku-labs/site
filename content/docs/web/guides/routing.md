---
title: Routing
description: "route().load().render().head(): one typed builder is the contract for the build and the browser."
section: Guides
order: 10
full: true
---

## How routing works

A route is a URL pattern plus optional handlers. You write routes with `route()`, a plain function
that runs before `createApp`. You register them in one place, `pluginConfigs.router.routes`. The
router plugin compiles the table once, while `createApp` runs.

At build, the `build` plugin walks the table: it expands each route into concrete pages with
`generate`, loads their data, composes the head and renders the HTML. In the browser, `spa` matches
the URL against the same table and runs `render` again with the saved data.

:::flow
- pattern
- generate
- load
- head
- render
- index.html
:::

Types flow along the chain. `ctx.params` comes from the pattern, `ctx.data` from what `load`
returns. There is no codegen and no cast.

## Patterns

| Syntax | Meaning | Example |
|---|---|---|
| `{name}` | Required param | `/{slug}/` → `ctx.params.slug: string` |
| `{name:?}` | Optional param. `toUrl` drops the segment when it is missing. | `/archive/{page:?}/` → `ctx.params.page?: string` |
| `{lang:?}` | Locale slot. The default locale is served at bare paths. It does not count toward specificity. | `/{lang:?}/{slug}/` |

When two patterns match a URL, the one with fewer dynamic segments wins. On a tie the route
declared first wins. Matching uses a plain `RegExp`, so it works in every browser, including
those without `URLPattern`.

## Define routes

Three files: the route table, a component that builds links, and the app that registers the
table.

```tsx file="src/routes.tsx" group="routing" hl="27,34" check
import { contentPlugin, defineRoutes, route } from "@moku-labs/web/browser";
import type { Content } from "@moku-labs/web/browser";

function PostList(props: { cards: Content.ArticleCard[] }) {
  return (
    <ul>
      {props.cards.map(card => (
        <li key={card.contentId}>
          <a href={card.url}>{card.title}</a>
        </li>
      ))}
    </ul>
  );
}

export const routes = defineRoutes({ // [!note] `defineRoutes` keeps the literal type of each route for IntelliSense.
  home: route("/{lang:?}/")
    .generate(ctx => [{ lang: ctx.locale }])
    .load(async ctx => {
      const content = ctx.require(contentPlugin);
      const byLocale = await content.loadAll();
      return (byLocale.get(ctx.locale) ?? []).map(article => content.articleToCard(article));
    })
    .render(ctx => <PostList cards={ctx.data} />)
    .head(() => ({ title: "Home" })),
  post: route("/{lang:?}/{slug}/")
    .generate(async ctx => { // [!note] `generate` returns the param sets to pre-render, once per locale.
      const byLocale = await ctx.require(contentPlugin).loadAll();
      return (byLocale.get(ctx.locale) ?? []).map(article => ({
        lang: ctx.locale,
        slug: article.computed.slug
      }));
    })
    .load(ctx => ctx.require(contentPlugin).load(ctx.params.slug, ctx.locale)) // [!note] `load` gets `{ params, locale, require, has }`. Its return type is `ctx.data` below.
    .render(ctx => <article dangerouslySetInnerHTML={{ __html: ctx.data.html }} />)
    .head(ctx => ({ title: ctx.data.frontmatter.title }))
    .meta({ section: "blog" }) // [!note] `meta` is a JSON bag, shipped to the browser in `clientManifest()`.
});
```

```tsx file="src/components/post-link.tsx" group="routing" check
import type { Content } from "@moku-labs/web/browser";

type Url = (name: string, params?: Record<string, string>) => string;

export function PostLink(props: { card: Content.ArticleCard; slug: string; url: Url }) {
  return (
    <a href={props.url("post", { slug: props.slug })}> // [!note] Inside `render` and `head`, `ctx.url(name, params)` builds links. Pass it down.
      <h2>{props.card.title}</h2>
      <time>{props.card.date}</time>
    </a>
  );
}
```

```ts file="src/app.ts" group="routing" hl="9"
import { buildPlugin, contentPlugin, createApp, fileSystemContent } from "@moku-labs/web";
import { routes } from "./routes";

export const app = createApp({
  plugins: [contentPlugin, buildPlugin],
  config: { mode: "hybrid" }, // [!note] The render mode is global config, not router config.
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    router: { routes }, // [!note] The only way to register routes. An `import * as routes` namespace works too.
    i18n: { locales: ["en", "uk"], defaultLocale: "en" },
    content: { providers: [fileSystemContent({ contentDir: "content" })] }
  }
});
```

## Load data

A route without `load` is a static page: `ctx.data` is `unknown` and the build writes an empty
`{}` sidecar. Add `load` and `ctx.data` takes its return type, in `render` and in `head`.

```diff lang=tsx file="src/routes.tsx" check
 import { contentPlugin, defineRoutes, route } from "@moku-labs/web/browser";
 
 export const routes = defineRoutes({
   post: route("/{slug}/")
-    .render(ctx => <h1>{ctx.params.slug}</h1>)
-    .head(ctx => ({ title: ctx.params.slug }))
+    .load(ctx => ctx.require(contentPlugin).load(ctx.params.slug, ctx.locale))
+    .render(ctx => <h1>{ctx.data.frontmatter.title}</h1>)
+    .head(ctx => ({ title: ctx.data.frontmatter.title, description: ctx.data.frontmatter.description }))
 });
```

`load` may be async. It runs inside the build plugin, so `ctx.require` reaches any plugin in the
Node app, and `ctx.has(name)` tells you whether an optional one is there.

## Set the head

`.head(ctx)` returns the page's title, description and extra elements. The [head
plugin](/docs/web/plugins/head/) adds the title template, canonical, Open Graph, Twitter and
hreflang tags around it.

```tsx file="src/routes.tsx" check
import { defineRoutes, jsonLd, route } from "@moku-labs/web/browser";

export const routes = defineRoutes({
  about: route("/about/")
    .render(() => <h1>About</h1>)
    .head(ctx => ({
      title: "About", // [!note] Becomes `<title>` through `head.titleTemplate`.
      description: "Who writes this blog.",
      image: "/og/about.png", // [!note] Relative images are made absolute against `site.url`.
      elements: [jsonLd({ "@context": "https://schema.org", "@type": "AboutPage", url: ctx.url("about") })]
    }))
});
```

## Dynamic paths

A route with a dynamic segment renders one page per param set that `generate` returns. The build
calls `generate` once per locale, default locale first. Two param sets that resolve to the same
file are written once.

| Route | `generate` | Pages written |
|---|---|---|
| `/{slug}/` | `[{ slug: "a" }, { slug: "b" }]` | `a/index.html`, `b/index.html` |
| `/{lang:?}/` with `en`, `uk` | `[{ lang: ctx.locale }]` | `index.html`, `en/index.html`, `uk/index.html` |
| `/{lang:?}/` with `en`, `uk` | none | `index.html` and `en/index.html` only |
| `/b/{id}/` in `mode: "spa"` | none | none: a client-only route, rendered in the browser from the URL |

`.toFile(params => path)` overrides where a page is written. The URL stays the pattern's URL.

## At build

```sh terminal title="build"
$ bun run build
▟▙ moku web  build                                       v2.4.11
✓ bundle · 5ms
✓ content · 1239ms
✓ pages · 5ms
✓ sitemap · 1ms
✓ BUILD · 9 pages                                1252ms · ./dist/
$ find dist -name index.html | sort
dist/en/hello-world/index.html
dist/en/index.html
dist/en/second-post/index.html
dist/hello-world/index.html
dist/index.html
dist/second-post/index.html
dist/uk/hello-world/index.html
dist/uk/index.html
dist/uk/second-post/index.html
```

The English pages live at bare paths. The `/en/…` copies carry a canonical link to the bare URL,
so an explicit `/en/` link works without a redirect.

## Builder methods

| Method | Runs | What it does |
|---|---|---|
| `.generate(ctx => params[])` | build | Param sets to pre-render. `ctx = { locale, require, has }`. May be async. |
| `.load(ctx => D)` | build | Page data. `ctx = { params, locale, require, has }`. Widens `ctx.data` to `D`. May be async. |
| `.render(ctx => VNode)` | build and browser | The page. `ctx = { params, data, locale, meta, url }`. |
| `.head(ctx => HeadConfig)` | build and browser | `{ title?, description?, canonical?, image?, elements? }`. Same `ctx` as `render`. |
| `.layout((ctx, children) => VNode)` | build | Wraps the page in chrome. Not re-applied on client navigation. |
| `.meta(record)` | | A JSON-serializable bag, readable as `ctx.meta` in `render`, `head`, `layout` and islands. |
| `.transition(mode)` | browser | `"none"`, `"crossfade"`, `"slide"` or `"morph"` for navigations to this route. |
| `.scroll(mode)` | browser | `"top"` or `"preserve"` for navigations to this route. |
| `.toFile(params => path)` | build | Output file override. |
| `.toJson(ctx => unknown)` | | Stores a JSON serializer on the route. No built-in plugin reads it in 2.4.11. |

## Links

Inside `render` and `head`, `ctx.url(name, params)` builds a link. It gives the same result as
`app.router.toUrl`. Outside a route, in components and islands, use `createUrls`:

```ts file="src/urls.ts" check
import { createUrls, defineRoutes, route } from "@moku-labs/web/browser";

const routes = defineRoutes({
  post: route("/{lang:?}/{slug}/")
});

export const urls = createUrls(routes, "en"); // [!note] Pass the default locale. The helper is app-free and cannot read i18n.

urls.toUrl("post", { lang: "en", slug: "hello" }); // "/hello/"
urls.toUrl("post", { lang: "uk", slug: "hello" }); // "/uk/hello/"
```

Without the second argument every locale keeps its prefix: `"/en/hello/"`. `toUrl` only accepts
names from the map, and throws `[web] router: unknown route name "…".` on a name it does not know.

## RouterApi

Mounted at `app.router` and reachable with `ctx.require(routerPlugin)`.

| Method | Returns |
|---|---|
| `match(pathname)` | `{ params, route }` for the most specific match, or `null`. |
| `toUrl(routeName, params)` | The URL. Throws on an unknown name. |
| `entries()` | Every route as `{ pattern, name, meta, toUrl, toFile, match }`, most specific first. |
| `manifest()` | The full definitions with handlers, in declaration order. The build reads this. |
| `clientManifest()` | `{ pattern, name, meta }[]` with no functions, JSON-safe. |
| `mode()` | `"ssg"`, `"spa"` or `"hybrid"`, from the global config. |

:::gotchas
- **`load` and `generate` never run in the browser.** The route file still ships to the client. Keep heavy Node-only code behind `ctx.require` in the loader, not in top-level imports of the route file.
- **There is no runtime registration.** `pluginConfigs.router.routes` is the only path. Without it every router call throws `[web] router: routes not registered.`
- **The mode is global.** Set `createApp({ config: { mode } })`. Router config has only `routes`.
- **A `{lang:?}` route without `generate` gets one page.** The build expands it for the default locale only. Return `[{ lang: ctx.locale }]` to get a page per locale.
- **Only `{lang:?}` matches without its segment.** `/archive/{page:?}/` matches `/archive/2/`, not `/archive/`. Declare a second route for the bare path.
- **Patterns start with `/`.** `route("about/")` fails `createApp` with `[web] router: route "about" pattern must start with "/" (got "about/").`
:::

## Related

- [router plugin](/docs/web/plugins/router/): config, API, the matching model.
- [Head & SEO](/docs/web/guides/head/): what `.head()` turns into.
- [i18n](/docs/web/guides/i18n/): the `{lang:?}` slot and bare default-locale paths.
- [SPA navigation](/docs/web/guides/spa/): `.transition()` and `.scroll()` in action.
