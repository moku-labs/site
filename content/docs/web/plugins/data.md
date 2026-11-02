---
title: data
description: "Optional provider. Page path → JSON file: the build writes each page's load() result, spa fetches it on navigation."
section: Plugins
kind: optional
order: 24
---

## What it does

**Optional provider.** `data` is the transport of the SSG → DATA → SPA pattern. It owns one
contract: a page path maps to one JSON file. On Node, the build calls `write(entries)` with the
`load` result of every rendered page. In the browser, `spa` calls `at(path)` on navigation and
passes the JSON to the route's `render` as `ctx.data`.

It is exported from both entries. Compose it on both sides for data navigation.

## How it works

`data` declares no dependencies. The link to the other plugins is a call they make:

- `build` checks `ctx.has("data")` in its pages phase. When `data` is there and
  `router.mode()` is not `"ssg"`, it writes one sidecar per page that has a `render`.
- `spa` checks `ctx.has("data")` while the browser app is created. When `data` is there and the
  mode is not `"ssg"`, navigation tries the data path before HTML-over-fetch.

`urlFor` and `fileFor` come from one function, so the written file is the fetched URL:

| Page path | `fileFor` | `urlFor` |
|---|---|---|
| `/` | `_data/index.json` | `/_data/index.json` |
| `/en/hello/` | `_data/en/hello/index.json` | `/_data/en/hello/index.json` |
| `/en/hello` | `_data/en/hello/index.json` | `/_data/en/hello/index.json` |

`write` stores each entry's `data` with `JSON.stringify`, at most 8 files at a time, through a
lazily loaded `node:fs` writer. The browser bundle gets no Node code from it.

## Config

`pluginConfigs.data`.

| Option | Type | Default | Description |
|---|---|---|---|
| `outputDir` | `string` | `"_data"` | Write side: the folder under the build `outDir`. |
| `baseUrl` | `string` | `"/_data/"` | Read side: the URL the browser fetches from. Must start with `/`. Keep it equal to `"/" + outputDir + "/"`. |

## API

Mounted at `app.data`, reachable with `ctx.require(dataPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `write` | `(entries: readonly DataEntry[], options?: { outDir?: string }) => Promise<DataWriteSummary>` | Node. One file per entry. `outDir` defaults to `./dist`. Resolves to `{ fileCount, bytes, files }`. |
| `at` | `(path: string) => Promise<unknown \| null>` | Browser. Fetches and caches a page's JSON. `null` when the fetch or the parse fails. |
| `urlFor` | `(path: string) => string` | The fetch URL of a page. |
| `fileFor` | `(path: string) => string` | The `outDir`-relative file of a page. |

`DataEntry` is `{ path: string; data: unknown }`.

## Events

### Emits

None.

### Listens to

None.

## Depends on

Nothing. `build` and `spa` find it by name when it is composed.

## Example

```ts file="scripts/sidecars.ts" check
import { createApp, dataPlugin } from "@moku-labs/web";

const app = createApp({
  plugins: [dataPlugin],
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    data: { outputDir: "_page", baseUrl: "/_page/" } // [!note] Change both together: one is a folder, the other its URL.
  }
});

const summary = await app.data.write(
  [
    { path: "/", data: { title: "Home" } },
    { path: "/about/", data: { title: "About" } }
  ],
  { outDir: "dist" }
);

console.log(summary.files); // ["_page/index.json", "_page/about/index.json"]
console.log(app.data.urlFor("/about/")); // "/_page/about/index.json"
```

You rarely call `write` yourself: the build does it for every page. Call it for pages the build
does not render, for example a JSON payload made by another script.

:::gotchas
- **Both sides or neither.** Node only: the files are written but never read. Browser only: every fetch misses and navigation falls back to HTML.
- **`ssg` mode turns it off.** The build writes no sidecars and `spa` skips the data path.
- **`at` returns the JSON as it is.** No validation. The route's `render` gets it directly as `ctx.data`.
- **`baseUrl` must start with `/`.** Otherwise `createApp` throws `[web] data.baseUrl: must be a site-root-relative URL path starting with "/" (e.g. "/_data/").`
:::

## Related

- [Data](/docs/web/guides/data/): the guide.
- [How it works](/docs/web/how-it-works/): the build-to-SPA picture.
- [collection plugin](/docs/web/plugins/collection/): the same idea keyed by collection and shard.
