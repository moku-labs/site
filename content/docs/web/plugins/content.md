---
title: content
description: "Node build. Markdown articles to sanitized HTML, with frontmatter, reading time, locale fallback and drafts."
section: Plugins
order: 23
full: true
---

## What it does

**Node build.** `content` gives you a locale-keyed model of Markdown articles. Each
`content/<slug>/<locale>.md` becomes an `Article` with its frontmatter, computed fields and
rendered HTML. Routes read it in build-only loaders with `ctx.require(contentPlugin)`.

The plugin itself imports no Node code and is exported from both entries, so a route file can
`ctx.require(contentPlugin)` in either app. The reading and rendering happen in a **provider**.
`fileSystemContent`, the Node provider, is exported from `@moku-labs/web` only.

## How it works

The plugin is a shell around providers, the same way `env` works with env providers:

| The shell owns | The provider owns |
|---|---|
| Locale fallback | Finding slugs |
| Draft filtering by stage | Reading `<slug>/<locale>.md` |
| Date sort, newest first | Frontmatter parsing |
| `contentId` assignment | The Markdown pipeline and Shiki |
| The article cache | The rendered HTML |
| `content:ready` and `content:invalidated` | |

With several providers, `slugs()` are merged and the first provider that has a slug and locale
wins.

The `fileSystemContent` pipeline: frontmatter, then remark (GitHub-flavoured Markdown, the
directive syntax, your `extraRemarkPlugins`), then rehype (raw HTML, the framework transforms,
your `extraRehypePlugins`), then Shiki, then `rehype-sanitize` when `trustedContent` is `false`.
The processor is built on the first render and kept inside the provider.

Computed fields:

| Field | Value |
|---|---|
| `slug` | The folder name. |
| `readingTime` | Minutes, rounded up, at least 1. |
| `wordCount` | Words in the source body. |
| `status` | `"draft"` when the frontmatter has `draft: true`, else `"published"`. |
| `contentId` | The slug on a single `load`. After `loadAll` sorts: `<locale>:<index>:<slug>`, e.g. `uk:0000:second-post`. |

Frontmatter dates become ISO `YYYY-MM-DD` strings. Relative image paths such as
`./images/cover.png` become `/<slug>/images/cover.png`, so they work from every locale page.

## Config

`pluginConfigs.content`.

| Option | Type | Default | Description |
|---|---|---|---|
| `providers` | `ContentProvider[]` | `[]` | Content sources, in order. At least one is required: the empty default fails `createApp`. |

`fileSystemContent(options)`:

| Option | Type | Default | Description |
|---|---|---|---|
| `contentDir` | `string` | required | The article root, absolute or relative to the project. |
| `trustedContent` | `boolean` | `false` | `false` sanitizes the HTML last. `true` skips sanitize. Use it only for Markdown you write yourself. |
| `shikiTheme` | `BundledTheme \| ThemeRegistrationAny` | `"github-dark"` | Passed to `@shikijs/rehype`. |
| `defaultAuthor` | `string` | none | Author for articles without one. |
| `extraRemarkPlugins` | `readonly Pluggable[]` | `[]` | Added after the framework remark plugins. |
| `extraRehypePlugins` | `readonly Pluggable[]` | `[]` | Added after the framework transforms, before Shiki and sanitize. |
| `mermaid` | `boolean \| MermaidDiagramOptions` | off | `mermaid` fences to inline SVG at build. Needs `trustedContent` and `mermaid-isomorphic`. A diagram that fails fails the build. |
| `embed` | `boolean \| { facade? }` | off | `::embed{src title width? height?}` to a click-to-load facade. Needs `trustedContent` and the `lazyEmbed` island. |
| `gallery` | `boolean \| { component? }` | off | `::gallery{src caption?}` to an image set from a co-located folder. Needs `trustedContent`. |

The `extra*` options add to the framework plugins and never replace them. A full plugin array in
config would be replaced by the shallow config merge, which is why there is none.

## API

Mounted at `app.content`, reachable with `ctx.require(contentPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `loadAll` | `(options?: { reuse?: boolean }) => Promise<Map<string, Article[]>>` | Every article of every locale, newest first, with fallback. Cached: repeated calls return the same object. `{ reuse: false }` reloads everything. Emits `content:ready`. |
| `load` | `(slug: string, locale: string) => Promise<Article>` | One article with fallback. Throws `[web] content article "…" not found for locale "…".` |
| `renderMarkdown` | `(md: string) => Promise<string>` | Renders a Markdown string through the provider pipeline. |
| `invalidate` | `(paths: readonly string[]) => void` | Marks files stale for the next dev rebuild. Emits `content:invalidated`. |
| `articleToCard` | `(article: Article) => ArticleCard` | A light projection without HTML, for lists. |
| `contentDir` | `() => string` | The first provider's folder. The build copies co-located assets from it. |

`ArticleCard` is `{ contentId, status, title, date, description, tags, readingTime, url }`.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `content:ready` | `{ locales: readonly string[]; articleCount: number }` | At the end of every `loadAll()` that loaded. |
| `content:invalidated` | `{ paths: readonly string[] }` | On `invalidate(paths)`, with the accepted, non-empty paths. |

### Listens to

None.

## Depends on

Nothing in `depends`. [i18n](/docs/web/plugins/i18n/) is read when present: its locales decide
what `loadAll` iterates and its default locale is the fallback. Without it there is one locale,
`"en"`.

## Example

```ts file="scripts/stats.ts" check
import { contentPlugin, createApp, createPlugin, fileSystemContent } from "@moku-labs/web";

const statsPlugin = createPlugin("stats", {
  depends: [contentPlugin],
  hooks: ctx => ({
    "content:ready": ({ locales, articleCount }) => ctx.log.info("content:stats", { locales, articleCount })
  })
});

const app = createApp({
  plugins: [contentPlugin, statsPlugin],
  config: { stage: "development" }, // [!note] Drafts load in `development` and `test`. In `production`, the default, they are left out.
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    i18n: { locales: ["en", "uk"], defaultLocale: "en" },
    content: {
      providers: [fileSystemContent({ contentDir: "content", shikiTheme: "github-light", defaultAuthor: "Ada" })]
    }
  }
});

const byLocale = await app.content.loadAll(); // [!note] Emits `content:ready`, which the stats plugin logs.
console.log([...byLocale].map(([locale, articles]) => `${locale}: ${articles.length}`));

const article = await app.content.load("second-post", "uk");
console.log(article.isFallback, article.url); // true "/uk/second-post/"

const html = await app.content.renderMarkdown("Inline `code` and **bold**.");
console.log(html); // "<p>Inline <code>code</code> and <strong>bold</strong>.</p>"
```

```sh terminal title="run"
$ bun scripts/stats.ts
{ level: "info", event: "content:stats", data: { locales: [ "en", "uk" ], articleCount: 4 } }
[ "en: 2", "uk: 2" ]
true /uk/second-post/
<p>Inline <code>code</code> and <strong>bold</strong>.</p>
```

Two articles in two locales count as four: `second-post` has no `uk.md`, and its fallback copy
in the `uk` list counts too.

:::gotchas
- **No provider, no app.** `providers: []` fails `createApp` with `[web] content: no provider composed.`
- **`mermaid`, `embed` and `gallery` need `trustedContent: true`.** `fileSystemContent` throws at construction otherwise: their output is raw HTML the sanitizer would strip.
- **Five frontmatter fields are required.** `title`, `date`, `description`, `tags`, `language`. A missing one throws `[web] content frontmatter is missing required field "…".`
- **Drafts depend on the global stage.** `stage: "production"`, the default, hides them everywhere, and `load()` of a draft throws the not-found error.
- **The `loadAll()` result is shared.** It is the cached object. Copy before you sort or filter in place.
- **`fileSystemContent` is not in `@moku-labs/web/browser`.** The browser entry has the shell only, for typing and `ctx.require`.
:::

## Related

- [Content & collections](/docs/web/guides/content/): the guide with a full blog.
- [Routing](/docs/web/guides/routing/): `generate` and `load` with `ctx.require(contentPlugin)`.
- [build plugin](/docs/web/plugins/build/): the `content` and `content-images` phases.
