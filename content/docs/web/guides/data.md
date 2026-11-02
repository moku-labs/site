---
title: Data
description: "Static HTML first, then JSON for client navigation: the build saves each page's load() result, the browser fetches it."
section: Guides
order: 15
---

## How data works

In `spa` and `hybrid` mode, with the `data` plugin composed, the build saves what each page's
`load` returned as a JSON file next to the HTML. On a link click, `spa` matches the route,
fetches that file with `data.at(path)` and runs the route's own `render` with it as `ctx.data`.

The payload follows `load`. A list page stores the slim cards its `load` returned. A detail page
stores one record. There is no second data shape to maintain, and no HTML in the JSON.

:::flow
- load(ctx)
- data.write
- _data/…/index.json
- data.at(path)
- render(ctx)
:::

`data` is not a default plugin. Compose it on both sides: in the Node app so the build writes the
files, and in the browser app so `spa` reads them. It has no dependencies and its Node writer is
loaded lazily, so the browser bundle stays free of `node:*`.

## Example

```tsx file="src/routes.tsx" group="data" check
import { contentPlugin, defineRoutes, route } from "@moku-labs/web/browser";

export const routes = defineRoutes({
  home: route("/")
    .load(async ctx => {
      const content = ctx.require(contentPlugin);
      const articles = (await content.loadAll()).get(ctx.locale) ?? [];
      return articles.map(article => content.articleToCard(article)); // [!note] Return only what `render` needs. This array is the whole sidecar.
    })
    .render(ctx => (
      <ul>
        {ctx.data.map(card => (
          <li key={card.contentId}>
            <a href={card.url}>{card.title}</a> · {card.readingTime} min
          </li>
        ))}
      </ul>
    ))
});
```

```ts file="src/app.ts" group="data" hl="5-6"
import { buildPlugin, contentPlugin, createApp, dataPlugin, fileSystemContent } from "@moku-labs/web";
import { routes } from "./routes";

export const app = createApp({
  plugins: [contentPlugin, dataPlugin, buildPlugin], // [!note] Node side: the build writes one sidecar per rendered page.
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    router: { routes },
    content: { providers: [fileSystemContent({ contentDir: "content" })] }
  }
});
```

```ts file="src/client.ts" group="data" hl="5-6"
import { createApp, dataPlugin } from "@moku-labs/web/browser";
import { routes } from "./routes";

const app = createApp({
  plugins: [dataPlugin], // [!note] Browser side: `spa` finds it with `ctx.has("data")` and fetches sidecars on navigation.
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    router: { routes }
  }
});

await app.start();
```

## At build

```sh terminal title="build"
$ bun run build
▟▙ moku web  build                                       v2.4.11
✓ pages · 5ms
✓ BUILD · 9 pages                                1252ms · ./dist/
$ find dist/_data -name index.json | sort
dist/_data/en/hello-world/index.json
dist/_data/en/index.json
dist/_data/en/second-post/index.json
dist/_data/hello-world/index.json
dist/_data/index.json
dist/_data/second-post/index.json
dist/_data/uk/hello-world/index.json
dist/_data/uk/index.json
dist/_data/uk/second-post/index.json
$ cat dist/_data/index.json
[{"contentId":"en:0000:second-post","status":"published","title":"Second post","date":"2026-02-01","description":"Another one.","tags":[],"readingTime":1,"url":"/second-post/"},…]
```

One sidecar per rendered page, including the `/en/…` copies. A page whose route has no `load`
gets `{}`.

## The URL convention

`urlFor` and `fileFor` come from one function, so the file the build writes is exactly the URL
the browser fetches.

| Page path | `fileFor(path)` | `urlFor(path)` |
|---|---|---|
| `/` | `_data/index.json` | `/_data/index.json` |
| `/en/hello/` | `_data/en/hello/index.json` | `/_data/en/hello/index.json` |
| `/en/hello` | `_data/en/hello/index.json` | `/_data/en/hello/index.json` |

`outputDir` (default `"_data"`) is the folder under the build `outDir`. `baseUrl` (default
`"/_data/"`) is the URL the browser fetches from. Keep them in step.

## Read data yourself

`app.data.at(path)` fetches and caches a sidecar. It returns `unknown`, or `null` when the fetch
or the JSON parse fails.

```tsx file="src/prefetch.tsx" check
import { createApp, dataPlugin, defineRoutes, route } from "@moku-labs/web/browser";

const routes = defineRoutes({ home: route("/").render(() => <h1>Home</h1>) });

const app = createApp({
  plugins: [dataPlugin],
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    router: { routes }
  }
});

const url = app.data.urlFor("/second-post/"); // "/_data/second-post/index.json"
const page = await app.data.at("/second-post/"); // [!note] Cached after the first fetch. A later navigation to the page reuses it.
console.log(url, page === null ? "no sidecar" : "ready");
```

:::gotchas
- **`ssg` mode writes no sidecars.** Set `config.mode` to `"spa"` or `"hybrid"` on both apps.
- **Compose `data` on both sides.** Node only: the files exist but are never read. Browser only: every fetch fails and navigation falls back to HTML.
- **`render` must be a function of `ctx.data`, `ctx.params` and `ctx.locale`.** On the client nothing else is there. A render that reads module state shows different output after navigation.
- **There is no validation step.** The fetched JSON is `ctx.data` as it is. A missing or broken file falls back to HTML-over-fetch, then to a full page load.
- **`baseUrl` must start with `/`.** Otherwise `createApp` throws `[web] data.baseUrl: must be a site-root-relative URL path starting with "/" (e.g. "/_data/").`
:::

## Related

- [data plugin](/docs/web/plugins/data/): config and the `app.data` API.
- [How it works](/docs/web/how-it-works/): where the data comes from.
- [SPA navigation](/docs/web/guides/spa/): what happens on a link click.
