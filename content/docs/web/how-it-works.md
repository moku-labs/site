---
title: How it works
description: "One route, two places: the build renders HTML, the browser renders the saved data."
section: Get started
order: 3
---

## The picture

::diagram[Build to SPA]{name="pipeline"}

:::steps
1. **Build.** Node runs every route: `generate` lists the pages, `load` fetches the data, `head` and `render` turn it into HTML. The kernel checked the plugin list before anything ran.
2. **Static HTML.** Each URL is a finished `index.html`. It works with JavaScript off, and it is what search engines see.
3. **Hydration.** `app.start()` in the browser mounts the islands onto that HTML. Nothing else is re-rendered.
4. **Data navigation.** A link click matches the route, fetches the page JSON with `data.at(path)` and runs the same `render` with it.
:::

## The same render runs in both places

A route is one object. The build and the browser read different parts of it.

| Handler | Build (Node) | Browser |
|---|---|---|
| `.generate(ctx)` | lists the param sets to pre-render | never |
| `.load(ctx)` | fetches the page data | never |
| `.render(ctx)` | renders the HTML | renders the swap region on navigation |
| `.head(ctx)` | composes `<head>` | the head is copied from the fetched page or re-titled |

In `spa` and `hybrid` mode the build saves what `load` returned next to the HTML, as JSON. The
browser fetches that file and passes it to `render` as `ctx.data`. There is no second
projection of the data and no second render function.

## Where the data comes from

```text file="SSG → DATA → SPA"
BUILD (mode !== "ssg")                 ON DISK                               CLIENT NAVIGATION
for each page of each route:           dist/hello-world/index.html           click /second-post/
  data = route.load(ctx)       ──►     (static HTML: SEO + first paint)      1. router.match(path)
  html = render(ctx) to string ──►                                           2. data.at(path) → fetch
  data.write([{ path, data }]) ──►     dist/_data/hello-world/index.json        /_data/second-post/index.json
                                       (the load() result, never HTML)       3. ctx.data = the JSON
                                                                             4. route.render(ctx) → swap
```

The sidecar of a list page holds what its `load` returned, for example slim cards. A detail page
holds one article. A route without `load` still gets an empty `{}` sidecar, so client navigation
to it never falls back.

```sh terminal title="what the build wrote"
$ ls dist dist/_data
dist:
404.html  _data  _headers  assets  atom.xml  en  feed.json  feed.xml
hello-world  index.html  robots.txt  second-post  sitemap.xml  uk

dist/_data:
en  hello-world  index.json  second-post  uk
$ cat dist/_data/index.json
[{"contentId":"en:0000:second-post","status":"published","title":"Second post",...}]
```

## Rendering modes

One global switch, `createApp({ config: { mode } })`, read by every plugin through
`router.mode()`.

| Mode | The build writes | The browser does | Use it for |
|---|---|---|---|
| `ssg` | HTML only | full page loads, or HTML-over-fetch when the `spa` plugin intercepts | docs, marketing, content sites |
| `spa` | HTML and JSON sidecars | data navigation: fetch JSON, render in place | app-like sites |
| `hybrid` | HTML and JSON sidecars | data navigation where a sidecar exists, else HTML-over-fetch | the default |

Data navigation needs the `data` plugin on both sides: in the Node app so the build writes the
sidecars, in the browser app so `spa` can read them. Without it, every navigation fetches the
next page's HTML and swaps the `main > section` region.

## Two apps, one route table

```ts file="src/app.ts" group="two-apps" hl="2" check
import { buildPlugin, contentPlugin, createApp, dataPlugin, fileSystemContent } from "@moku-labs/web";
import { routes } from "./routes"; // [!note] The Node app imports the routes with their loaders.

export const app = createApp({
  plugins: [contentPlugin, dataPlugin, buildPlugin],
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    router: { routes },
    content: { providers: [fileSystemContent({ contentDir: "content" })] }
  }
});
```

```ts file="src/client.ts" group="two-apps" hl="1-2" check
import { createApp, dataPlugin } from "@moku-labs/web/browser"; // [!note] The browser entry cannot pull in `node:fs`.
import { routes } from "./routes"; // [!note] The same table. Its loaders ship but never run here.

const app = createApp({
  plugins: [dataPlugin],
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    router: { routes }
  }
});

await app.start();
```

A complete app on the browser entry, in one file. It compiles as it is:

```tsx file="src/client.tsx" check
import { createApp, createIsland, defineRoutes, route } from "@moku-labs/web/browser";

const routes = defineRoutes({
  home: route("/").render(() => <h1>Home</h1>),
  about: route("/about/").render(() => <h1>About</h1>)
});

const clock = createIsland("clock", {
  onMount(ctx) {
    const timer = setInterval(() => {
      ctx.el.textContent = new Date().toLocaleTimeString();
    }, 1000);
    ctx.cleanup(() => clearInterval(timer)); // [!note] Runs when the island is destroyed, for example on navigation.
  }
});

const app = createApp({
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: { name: "Demo", url: "https://demo.dev", author: "", description: "" },
    router: { routes },
    spa: { islands: [clock] }
  }
});

await app.start();
```

:::gotchas
- **`load` runs at build only.** Do not expect it on navigation. The browser reads the JSON the build wrote.
- **No HTML in the JSON.** The route owns rendering, `data` owns transport. A missing or broken sidecar falls back to fetching the HTML, then to a full page load.
- **Use `@moku-labs/web/browser` for the client.** Its import graph has no Node module. Tree-shaking the root entry is not the same guarantee: bundling entries together can merge Node code into a shared chunk.
- **The layout is not re-applied on the client.** `.layout()` frames the page at build. On navigation the chrome stays and only the swap region changes.
:::

## Related

- [Routing](/docs/web/guides/routing/): the route builder in full.
- [Data](/docs/web/guides/data/): the sidecars and the `data` plugin.
- [SPA navigation](/docs/web/guides/spa/): interception, transitions, scroll.
- [spa plugin](/docs/web/plugins/spa/): config, API, events.
