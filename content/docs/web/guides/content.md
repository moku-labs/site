---
title: Content & collections
description: "Markdown articles with locale fallback, and sharded JSON collections read on demand."
section: Guides
order: 12
---

## How content works

The `content` plugin turns Markdown files into `Article` objects. It does not read files itself:
a **provider** does. On Node you compose `fileSystemContent`, which reads
`content/<slug>/<locale>.md`, parses the frontmatter and renders the body to HTML with Shiki
highlighting. The plugin adds locale fallback, draft filtering, date sorting and a cache on top.

Routes reach it in build-only loaders with `ctx.require(contentPlugin)`. Nothing of the Markdown
pipeline ships to the browser.

| `Article` field | Holds |
|---|---|
| `frontmatter` | `title`, `date`, `description`, `tags`, `language`, `draft?`, `author?` |
| `computed` | `slug`, `readingTime` (minutes, at least 1), `contentId`, `status`, `wordCount` |
| `html` | The rendered body |
| `locale`, `isFallback` | The requested locale, and whether the default-locale file was used |
| `url` | The article URL in this locale, e.g. `/uk/second-post/` |

For data that is not an article and that the browser loads on demand, such as a search index,
the `collection` plugin writes JSON shards at build and reads them in the browser.

## Example

```text file="content/"
content/
  hello-world/
    en.md          # frontmatter: title, date, description, tags, language
    uk.md          # same slug, another locale
    images/
      cover.png    # co-located, copied to dist/hello-world/images/
  second-post/
    en.md          # no uk.md: /uk/second-post/ falls back to English
```

```ts file="src/app.ts" group="content" hl="8-16" no-check="imports ./routes from the reader's project"
import { buildPlugin, contentPlugin, createApp, fileSystemContent } from "@moku-labs/web";
import { routes } from "./routes";

export const app = createApp({
  plugins: [contentPlugin, buildPlugin],
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    content: {
      providers: [
        fileSystemContent({
          contentDir: "content",
          shikiTheme: "github-dark", // [!note] A bundled Shiki theme name, or your own theme object.
          defaultAuthor: "Ada" // [!note] Used when an article's frontmatter has no `author`.
        })
      ]
    },
    i18n: { locales: ["en", "uk"], defaultLocale: "en" },
    router: { routes }
  }
});
```

```tsx file="src/routes.tsx" group="content" check
import { contentPlugin, defineRoutes, route } from "@moku-labs/web/browser";

export const routes = defineRoutes({
  post: route("/{lang:?}/{slug}/")
    .generate(async ctx => {
      const byLocale = await ctx.require(contentPlugin).loadAll(); // [!note] Cached: every page of every route can call it, the files are read once.
      return (byLocale.get(ctx.locale) ?? []).map(article => ({
        lang: ctx.locale,
        slug: article.computed.slug
      }));
    })
    .load(ctx => ctx.require(contentPlugin).load(ctx.params.slug, ctx.locale))
    .render(ctx => (
      <article>
        {ctx.data.isFallback ? <p>This post is not translated yet.</p> : null}
        <h1>{ctx.data.frontmatter.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: ctx.data.html }} />
      </article>
    ))
    .head(ctx => ({ title: ctx.data.frontmatter.title, description: ctx.data.frontmatter.description }))
});
```

## Locale fallback and drafts

`load(slug, locale)` reads `<slug>/<locale>.md`. When that file is missing it reads the default
locale's file and sets `isFallback: true`. `locale` and `url` stay the requested locale, so the
page is written at `/uk/second-post/`. `loadAll()` does the same for every slug and every
locale, then sorts each locale's list by date, newest first.

An article with `draft: true` is left out when the global `stage` is `"production"`, the
default. In `"development"` and `"test"` it loads normally. In production a draft passed to
`load()` throws the same not-found error as a missing file, so drafts cannot be probed.

## The Markdown pipeline

The framework pipeline already includes GitHub-flavoured Markdown, the generic directive syntax,
Shiki and, last, `rehype-sanitize`.

| Option of `fileSystemContent` | Default | What it does |
|---|---|---|
| `contentDir` | required | The article root. |
| `trustedContent` | `false` | `false` runs `rehype-sanitize` as the last step. Set `true` only when you write every file yourself. |
| `shikiTheme` | `"github-dark"` | A bundled theme name or a `ThemeRegistration` object. |
| `defaultAuthor` | none | Author for articles without one. |
| `extraRemarkPlugins` | `[]` | Added after the framework's remark plugins. They never replace them. |
| `extraRehypePlugins` | `[]` | Added after the framework transforms, before Shiki and sanitize. |
| `mermaid` | off | Renders `mermaid` fences to inline SVG at build. Needs `trustedContent` and the optional peer `mermaid-isomorphic`. |
| `embed` | off | `::embed{src="…" title="…"}` becomes a click-to-load iframe facade. Needs `trustedContent`. |
| `gallery` | off | `::gallery{src="./images/dir/" caption="…"}` becomes an image set from a co-located folder. Needs `trustedContent`. |

`::embed` needs the `lazyEmbed` island in the browser to swap the facade for the real iframe:

```tsx file="src/client.tsx" check
import { createApp, defineRoutes, lazyEmbed, route } from "@moku-labs/web/browser";

const routes = defineRoutes({ home: route("/").render(() => <h1>My Blog</h1>) });

const app = createApp({
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    router: { routes },
    spa: { islands: [lazyEmbed] } // [!note] Activates every `[data-island="lazy-embed"]` facade on click.
  }
});

await app.start();
```

## Collections

A collection is a set of JSON files the build writes and the browser reads on demand. You name
the collection and the shard; the plugin owns the file layout:
`<outDir>/<collection>/<shard>.json`, fetched from `<baseUrl><collection>/<shard>.json`.

```ts file="scripts/write-index.ts" check
import { collectionPlugin, contentPlugin, createApp, fileSystemContent } from "@moku-labs/web";

const app = createApp({
  plugins: [contentPlugin, collectionPlugin],
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    i18n: { locales: ["en", "uk"], defaultLocale: "en" },
    content: { providers: [fileSystemContent({ contentDir: "content" })] }
  }
});

const byLocale = await app.content.loadAll();
const shards = [...byLocale].map(([locale, articles]) => ({
  collection: "search",
  shard: locale, // [!note] A shard key may contain `/`, e.g. `"en/animals"`, which becomes a folder.
  data: articles.map(article => app.content.articleToCard(article))
}));

const summary = await app.collection.write(shards, { outDir: "dist" });
console.log(summary.files);
```

```ts file="src/search.ts" check
import { loadCollectionShard } from "@moku-labs/web/browser";
import type { Content } from "@moku-labs/web/browser";

export async function searchTitles(query: string): Promise<Content.ArticleCard[]> {
  const cards = await loadCollectionShard<Content.ArticleCard[]>("/", "search", "en"); // [!note] Fetches `/search/en.json` and throws on a non-OK response.
  const needle = query.toLowerCase();
  return cards.filter(card => card.title.toLowerCase().includes(needle));
}
```

```sh terminal title="write the index"
$ bun scripts/write-index.ts
[ "search/en.json", "search/uk.json" ]
$ head -c 120 dist/search/uk.json
[{"contentId":"uk:0000:second-post","status":"published","title":"Second post","date":"2026-02-01",
```

`collectionPlugin` is exported from `@moku-labs/web` only. In the browser bundle, read shards
with `loadCollectionShard` or build the URL with `collectionUrl` from `@moku-labs/web/browser`.

:::gotchas
- **`content` needs a provider.** The default `providers: []` fails `createApp` with `[web] content: no provider composed.`
- **Five frontmatter fields are required.** `title`, `date`, `description`, `tags` and `language`. A missing one fails the build with the field name.
- **`load()` throws on a missing article.** `[web] content article "nope" not found for locale "en".` Build page lists from `loadAll()`, not from guessed slugs.
- **`loadAll()` returns a cached object.** Copy before you sort or change it.
- **`trustedContent: false` strips more than scripts.** Inline `style` and Shiki's per-token colours go too. Use `true` only for Markdown you write yourself.
- **Write collections after the build.** `build.run()` cleans `outDir` first, so a shard written before it is deleted.
:::

## Related

- [content plugin](/docs/web/plugins/content/): the full API and every option.
- [collection plugin](/docs/web/plugins/collection/): `write`, `at`, `urlFor`, `fileFor`.
- [Routing](/docs/web/guides/routing/): `generate` and `load` with `ctx.require`.
- [i18n](/docs/web/guides/i18n/): locales and the fallback chain.
