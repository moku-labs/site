---
title: collection
description: "Optional provider. (collection, shard) → JSON file: written at build, fetched on demand in the browser."
section: Plugins
order: 22
---

## What it does

**Optional provider.** `collection` owns one contract: a `(collection, shard)` key maps to one
JSON file. On Node, `write(entries)` persists the shards your build script authored. In the
browser, `at(collection, shard)` fetches and caches one of them.

It knows nothing about what the data is. A search index, a question bank, a dictionary: you pick
the shape. It is the collection-keyed sibling of the page-keyed [data](/docs/web/plugins/data/)
plugin.

## How it works

`urlFor` and `fileFor` both come from one function, so the file `write` creates is exactly the
URL `at` fetches. The shard key may contain `/`, which becomes nested folders. Outer slashes are
trimmed.

| `(collection, shard)` | `fileFor` | `urlFor` with `baseUrl: "/"` |
|---|---|---|
| `("bank", "ru")` | `bank/ru.json` | `/bank/ru.json` |
| `("bank", "en/animals")` | `bank/en/animals.json` | `/bank/en/animals.json` |
| `("/bank/", "/en/")` | `bank/en.json` | `/bank/en.json` |

`write` serializes each shard's `data` with `JSON.stringify`, at most 8 files at a time. Its
`node:fs` writer is loaded lazily, so composing the plugin in a browser bundle pulls no `node:*`
module. `at` returns `null` when the fetch or the parse fails, so the caller can fall back.

## Config

`pluginConfigs.collection`.

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | `"/"` | The URL prefix the browser fetches shards from. Must end with `/`. |

## API

Mounted at `app.collection`, reachable with `ctx.require(collectionPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `write` | `(entries: readonly CollectionShard[], options?: { outDir?: string }) => Promise<CollectionWriteSummary>` | Node. One file per entry. `outDir` defaults to `./dist`. Resolves to `{ fileCount, bytes, files }`. |
| `at` | `(collection: string, shard: string) => Promise<unknown \| null>` | Browser. Fetches and caches one shard. `null` on failure. |
| `urlFor` | `(collection: string, shard: string) => string` | The fetch URL. |
| `fileFor` | `(collection: string, shard: string) => string` | The `outDir`-relative file path. |

`CollectionShard` is `{ collection: string; shard: string; data: unknown }`.

## Events

### Emits

None.

### Listens to

None.

## Depends on

Nothing. The relationship to the build is a call you make: write the shards after
`app.build.run()`, which deletes `outDir` first.

## Example

```ts file="scripts/build.ts" check
import { buildPlugin, collectionPlugin, createApp, defineRoutes, route } from "@moku-labs/web";
import { h } from "preact";

const words = { en: ["cat", "dog"], uk: ["кіт", "пес"] };

const routes = defineRoutes({ home: route("/").render(() => h("h1", null, "Words")) });

const app = createApp({
  plugins: [collectionPlugin, buildPlugin],
  pluginConfigs: {
    site: { name: "Words", url: "https://words.dev", author: "Ada", description: "A word game." },
    router: { routes },
    build: { outDir: "dist", feeds: false }
  }
});

await app.build.run();
const summary = await app.collection.write( // [!note] After the build: `build.run()` empties `outDir` first.
  Object.entries(words).map(([locale, list]) => ({ collection: "bank", shard: `${locale}/animals`, data: list })),
  { outDir: "dist" }
);
console.log(summary.files); // ["bank/en/animals.json", "bank/uk/animals.json"]
```

```ts file="src/words.ts" check
import { collectionUrl, loadCollectionShard } from "@moku-labs/web/browser";

export async function loadWords(locale: string): Promise<string[]> {
  return loadCollectionShard<string[]>("/", "bank", `${locale}/animals`); // [!note] Throws on a non-OK response. Wrap it when a miss is expected.
}

export const englishUrl = collectionUrl("/", "bank", "en/animals"); // "/bank/en/animals.json"
```

:::gotchas
- **`collectionPlugin` is not exported from `@moku-labs/web/browser` in 2.4.11.** In the client bundle use `loadCollectionShard` and `collectionUrl`, which are.
- **`at` returns `unknown`.** There is no validation step. Check the shape before you trust it.
- **`loadCollectionShard` throws; `at` returns `null`.** Pick the one whose failure mode fits the caller.
- **`baseUrl` must end with `/`.** Otherwise `createApp` throws `[web] collection.baseUrl: must be a URL prefix ending with "/" (e.g. "/" or "/cdn/").`
:::

## Related

- [Content & collections](/docs/web/guides/content/): a search index built from the articles.
- [data plugin](/docs/web/plugins/data/): the same idea keyed by page path.
