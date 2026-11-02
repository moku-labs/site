---
title: router
description: "Default. The route table: the typed route() builder, a specificity-sorted matcher, URL and file paths, the render mode."
section: Plugins
order: 28
---

## What it does

**Isomorphic default.** `router` owns the route table. You write routes with the `route()`
builder, register them in `pluginConfigs.router.routes`, and the router compiles them while
`createApp` runs. `build`, `head` and `spa` read the compiled table through its API: matching,
URLs, output files and the render mode.

## How it works

Each route compiles to two matchers built on a plain `RegExp`: one with the locale slot filled
by the configured locales, and one with the `{lang:?}` segment removed. A pathname is tried
against the first, then the second, which injects the default locale. That is how `/hello/`
resolves to `{ slug: "hello", lang: "en" }` and `/uk/hello/` to `{ lang: "uk", slug: "hello" }`.

The table is sorted by the number of dynamic segments, fewest first, with declaration order as
the tie-break. `{lang:?}` does not count, so adding a locale prefix never changes priority. The
same matching code runs at build and in the browser, so the two cannot disagree.

`createApp` validates the table and stops on: an empty map, a pattern that does not start with
`/`, unbalanced braces, or more than one `{lang:?}` segment.

Types are a call-site matter. `route()` captures the pattern as a literal, so `ctx.params` is
inferred, and `.load()` widens `ctx.data`. The route map in config is erased to
`Record<string, RouteDefinition>`; the build gets the full definitions back from `manifest()`.

## Config

`pluginConfigs.router`.

| Option | Type | Default | Description |
|---|---|---|---|
| `routes` | `RouteMap` | none | Route name → `route(...)`. An `import * as routes` namespace works. The only way to register routes. |

The render mode is not router config. It is the global `createApp({ config: { mode } })`, which
the router exposes as `mode()`.

## API

Mounted at `app.router`, reachable with `ctx.require(routerPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `match` | `(pathname: string) => { params: Record<string, string>; route: RouteDefinition } \| null` | The most specific match, or `null`. |
| `toUrl` | `(routeName: string, params: Record<string, string>) => string` | Fills the pattern. Throws on an unknown name. |
| `entries` | `() => readonly TypedRoute[]` | Every route with `pattern`, `name`, `meta`, `toUrl`, `toFile`, `match`, most specific first. |
| `manifest` | `() => readonly RouteDefinition[]` | The full definitions with handlers, in declaration order. |
| `clientManifest` | `() => readonly ClientRoute[]` | `{ pattern, name, meta }` for each route, frozen and JSON-safe, most specific first. |
| `mode` | `() => "ssg" \| "spa" \| "hybrid"` | The global render mode. |

### Helpers

Plain functions with no `ctx`. They run before `createApp`. Exported from both entries, and
reachable as `routerPlugin.route`, `routerPlugin.defineRoutes`, `routerPlugin.createUrls`.

| Helper | Signature | Description |
|---|---|---|
| `route` | `<P extends string>(pattern: P) => RouteBuilder<RouteState<P>>` | The fluent builder. The returned object is itself a `RouteDefinition`. |
| `defineRoutes` | `<T extends RouteMap>(routes: T) => T` | Keeps the literal type of the map for IntelliSense. |
| `createUrls` | `<T extends RouteMap>(routes: T, defaultLocale?: string) => Urls<T>` | An app-free URL builder: `toUrl(name, params?)`, names typed to the map. Pass the default locale to get bare paths for it. |

The builder methods are listed in the [routing guide](/docs/web/guides/routing/#builder-methods).

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [site](/docs/web/plugins/site/): the base URL.
- [i18n](/docs/web/plugins/i18n/), optional: the locales and the default locale. Without it the
  router compiles for `"en"`.

## Example

```ts file="scripts/routes.ts" check
import { createApp, createUrls, defineRoutes, route } from "@moku-labs/web";
import { h } from "preact";

const routes = defineRoutes({
  home: route("/{lang:?}/").render(() => h("h1", null, "Home")),
  post: route("/{lang:?}/{slug}/")
    .render(ctx => h("h1", null, ctx.params.slug))
    .meta({ section: "blog" }),
  about: route("/about/").render(() => h("h1", null, "About"))
});

const app = createApp({
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    i18n: { locales: ["en", "uk"], defaultLocale: "en" },
    router: { routes }
  }
});

console.log(app.router.match("/uk/hello/")?.params); // { lang: "uk", slug: "hello" }
console.log(app.router.match("/hello/")?.params); // { slug: "hello", lang: "en" }
console.log(app.router.toUrl("post", { lang: "uk", slug: "hello" })); // "/uk/hello/"
console.log(app.router.mode()); // "hybrid"
console.log(createUrls(routes, "en").toUrl("post", { lang: "en", slug: "hello" })); // "/hello/" // [!note] The same output as `app.router.toUrl`, with no app.
```

```sh terminal title="run"
$ bun scripts/routes.ts
{ lang: "uk", slug: "hello" }
{ slug: "hello", lang: "en" }
/uk/hello/
hybrid
/hello/
```

:::gotchas
- **Routes are registered once.** There is no `router.set()`. An app that builds routes at run time composes the map before `createApp`.
- **No routes, no router.** Without `pluginConfigs.router.routes`, every call throws `[web] router: routes not registered.`
- **`toUrl` throws on a typo.** An unknown name is an error, not an empty link.
- **Only `{lang:?}` matches when absent.** Another optional segment, such as `{page:?}`, matches only when it is present.
- **`meta` must be JSON.** It ships to the browser in `clientManifest()`. No functions, symbols or class instances.
:::

## Related

- [Routing](/docs/web/guides/routing/): the guide, with every builder method.
- [i18n plugin](/docs/web/plugins/i18n/): where the locales come from.
- [spa plugin](/docs/web/plugins/spa/): matching in the browser.
