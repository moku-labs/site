---
title: Head & SEO
description: "Title, canonical, Open Graph, Twitter, JSON-LD, hreflang, feeds, sitemap and OG images."
section: Guides
order: 13
---

## How the head works

Each route's `.head(ctx)` returns a small object: `title`, `description`, `canonical`, `image`
and extra `elements`. The `head` plugin composes the full `<head>` from it, in this order:

:::steps
1. **Title.** `head.titleTemplate` with `%s` replaced by the route title, or the site name.
2. **Description.** The route description, or `site.description`.
3. **Open Graph and Twitter.** Title, description, URL, and `og:image` / `twitter:image` from the route `image` or `head.defaultOgImage`, made absolute against `site.url`. `og:locale` when `i18n.ogLocaleMap` has the page locale.
4. **Canonical.** The route `canonical`, or `site.url` joined with the page URL.
5. **hreflang.** One alternate link per locale, plus `x-default`.
6. **Your elements.** The route `elements`, last. An element with the same key as a generated one replaces it.
:::

The build writes this into every page. On client navigation `spa` copies the head from the
fetched page, or sets the title through `head.composeTitle` on the data path. A head element is
a plain object, not a Preact node, so the same descriptors serialize at build and apply in the
browser.

The `build` plugin adds the site-wide files: feeds, `sitemap.xml`, `robots.txt` and OG images.

## Example

```ts file="src/app.ts" group="head" hl="8-13" check
import { buildPlugin, contentPlugin, createApp, fileSystemContent } from "@moku-labs/web";
import { routes } from "./routes";

export const app = createApp({
  plugins: [contentPlugin, buildPlugin],
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    head: {
      titleTemplate: "%s · My Blog", // [!note] Must contain `%s`, or `createApp` throws.
      defaultOgImage: "/og-default.png",
      twitterCard: "summary_large_image",
      twitterHandle: "@moku_labs"
    },
    i18n: { locales: ["en", "uk"], defaultLocale: "en", ogLocaleMap: { en: "en_US", uk: "uk_UA" } },
    router: { routes },
    content: { providers: [fileSystemContent({ contentDir: "content" })] }
  }
});
```

```tsx file="src/routes.tsx" group="head" check
import { buildArticleHead, contentPlugin, defineRoutes, feedLink, route } from "@moku-labs/web/browser";

export const routes = defineRoutes({
  post: route("/{slug}/")
    .load(ctx => ctx.require(contentPlugin).load(ctx.params.slug, ctx.locale))
    .render(ctx => <article dangerouslySetInnerHTML={{ __html: ctx.data.html }} />)
    .head(ctx => ({
      title: ctx.data.frontmatter.title,
      description: ctx.data.frontmatter.description,
      image: `/og/${ctx.data.computed.slug}.png`, // [!note] Relative is fine here: the head plugin makes it absolute.
      elements: [
        ...buildArticleHead( // [!note] Canonical, `og:type=article`, published time, author, tags and an Article JSON-LD block.
          {
            title: ctx.data.frontmatter.title,
            author: ctx.data.frontmatter.author ?? "Ada",
            published: ctx.data.frontmatter.date,
            tags: ctx.data.frontmatter.tags
          },
          `https://blog.dev${ctx.data.url}`
        ),
        feedLink("My Blog", "/feed.xml")
      ]
    }))
});
```

## What the build writes

```sh terminal title="build"
$ bun run build
▟▙ moku web  build                                       v2.4.11
✓ pages · 5ms
✓ feeds · 2ms
✓ sitemap · 1ms
✓ BUILD · 9 pages                                1252ms · ./dist/
$ cat dist/robots.txt
User-agent: *
Allow: /
Sitemap: https://blog.dev/sitemap.xml
```

The head of `/uk/hello-world/`, as the build wrote it (one tag per line here):

```html file="dist/uk/hello-world/index.html"
<title>Привіт, світ · My Blog</title>
<meta name="description" content="Перший допис.">
<meta property="og:title" content="Привіт, світ">
<meta property="og:description" content="Перший допис.">
<meta property="og:url" content="https://blog.dev/uk/hello-world/">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://blog.dev/uk/hello-world/">
<link rel="alternate" hreflang="en" href="https://blog.dev/hello-world/">
<link rel="alternate" hreflang="uk" href="https://blog.dev/uk/hello-world/">
<link rel="alternate" hreflang="x-default" href="https://blog.dev/hello-world/">
<meta name="build-id" content="1793577742510-06dbe81d-2692-4613-a480-605d41931010">
<link rel="stylesheet" href="/assets/main-gzka1ns2.css">
<script type="module" src="/assets/client-7wyejjw7.js"></script>
```

The `build-id` meta and the asset tags are added by the build, after the head plugin. The sitemap lists the canonical URLs
only, so the `/en/…` copies of default-locale pages are not in it.

## Head helpers

Plain functions that return head elements. Use them in `elements`. Each one is exported from
both entries.

| Helper | Signature | Emits |
|---|---|---|
| `meta` | `meta(name, content)` | `<meta name content>`, key `meta:<name>` |
| `og` | `og(property, content)` | `<meta property content>`, key `meta:<property>` |
| `twitter` | `twitter(name, content)` | `<meta name content>`, key `meta:<name>` |
| `jsonLd` | `jsonLd(data)` | `<script type="application/ld+json">`, with `<`, `>` and `&` escaped |
| `canonical` | `canonical(url)` | `<link rel="canonical">`, key `link:canonical` |
| `hreflang` | `hreflang(locale, url)` | `<link rel="alternate" hreflang>`, key `link:alternate:<locale>` |
| `feedLink` | `feedLink(title, url, type?)` | `<link rel="alternate">`, RSS by default |
| `buildArticleHead` | `buildArticleHead(meta, canonicalUrl)` | The article set: canonical, `og:type`, `article:*` tags, JSON-LD |

To override a generated tag, return an element with the same key. `og("og:title", "Shorter")`
replaces the generated `og:title`.

## Site-wide outputs

```ts file="src/app.ts" no-check="a fragment of the createApp options"
pluginConfigs: {
  head: { defaultOgImage: "/og-default.png" }, // [!note] Points every page without its own image at the card the build renders.
  build: {
    feeds: true, // [!note] `feed.xml`, `atom.xml` and `feed.json` from the content articles.
    sitemap: true, // [!note] `sitemap.xml` and `robots.txt`.
    ogImage: { fontDir: "fonts", defaultCard: true } // [!note] One card per article in `og/<slug>.png`, plus `og-default.png`.
  }
}
```

`ogImage` renders with Satori and needs a folder with at least one `.ttf`, `.otf` or `.woff`
font. `defaultCard` also takes a function `(input) => VNode` to draw your own site card. A card
is rendered again only when its article's title, the template or the size changed.

:::gotchas
- **`titleTemplate` needs `%s`.** Without it `createApp` throws `[web] head: titleTemplate must contain the "%s" token (replaced by the route title), received "My Blog".`
- **`site.url` must be the production origin.** Canonical, `og:url`, relative images, the sitemap and the feeds are all built from it.
- **`buildArticleHead` does not resolve relative images.** Its `image` goes to `og:image` as you pass it. Pass an absolute URL.
- **`og:locale` needs `ogLocaleMap`.** Without a mapping for the page locale the tag is left out.
- **`ogImage.fontDir` is checked at `createApp`.** A missing folder, or one with no font file, fails before the build starts.
:::

## Related

- [head plugin](/docs/web/plugins/head/): config, `render`, `siteHead`, `composeTitle`.
- [build plugin](/docs/web/plugins/build/): `feeds`, `sitemap`, `ogImage` and the other outputs.
- [i18n](/docs/web/guides/i18n/): hreflang and `og:locale`.
