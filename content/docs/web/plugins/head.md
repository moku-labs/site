---
title: head
description: "Default. Composes the <head> of every page: title template, description, Open Graph, Twitter, canonical, hreflang, extras."
section: Plugins
order: 26
---

## What it does

**Isomorphic default.** `head` owns everything inside `<head>`. The build calls it for every
page; `spa` uses it to set the title on client navigation. It emits no events and listens to
none. Its only state is the normalized defaults, frozen while `createApp` runs.

It also carries the head helpers, `meta`, `og`, `twitter`, `jsonLd`, `canonical`, `hreflang`,
`feedLink` and `buildArticleHead`, exported from both entries for use in `.head()`.

## How it works

`render(route, data)` composes a list of head elements, then serializes it:

:::steps
1. **Title.** `titleTemplate` applied to the route title, or to `site.name()`.
2. **Description.** The route description, or `site.description()`.
3. **Open Graph and Twitter.** `og:title`, `og:description`, `og:url`, the image from the route or `defaultOgImage` made absolute, `twitter:card`, `twitter:site` when `twitterHandle` is set, `og:locale` when `i18n.ogLocale(locale)` has a value.
4. **Canonical.** The route `canonical`, or `site.canonical(router.toUrl(name, params))`.
5. **hreflang.** One alternate per `i18n.locales()`, plus `x-default`.
6. **Route elements.** The `elements` from `.head()`, last.
:::

Then elements with the same `key` are de-duplicated, last one wins. Generated tags carry keys
such as `meta:description`, `link:canonical` and `link:alternate:uk`, so a route element with
the same key replaces the default. Elements without a key, such as JSON-LD, are always kept.
Attribute values and the title are HTML-escaped when serialized; `jsonLd` escapes `<`, `>` and
`&` when it is built.

A head element is a plain `{ tag, attrs?, children?, key? }` object, not a Preact node, so the
plugin needs no renderer.

## Config

`pluginConfigs.head`. Every field is optional.

| Option | Type | Default | Description |
|---|---|---|---|
| `titleTemplate` | `string` | none | `%s` is replaced by the route title. Without `%s`, `createApp` throws. |
| `defaultOgImage` | `string` | none | `og:image` and `twitter:image` for pages without their own. Relative paths resolve against `site.url`. |
| `twitterCard` | `"summary" \| "summary_large_image"` | `"summary_large_image"` | The `twitter:card` value. Anything else throws. |
| `twitterHandle` | `string` | none | `twitter:site`, e.g. `"@moku_labs"`. |

## API

Mounted at `app.head`, reachable with `ctx.require(headPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `render` | `(route: ResolvedRoute, data: unknown) => string` | The inner HTML of `<head>` for a page, without the `<head>` tags. The build calls it for every page. |
| `siteHead` | `(input: { url: string; locale?: string }) => string` | A site-level Open Graph block for a page with no route, such as a bare redirect. `""` unless `defaultOgImage` is set. |
| `composeTitle` | `(head: HeadConfig \| undefined) => string` | The final title for a route's head config, the same text `render` puts in `<title>`. |

`ResolvedRoute` is `{ path, name, params, locale?, head? }`, where `head` is the route's
`HeadConfig`: `{ title?, description?, canonical?, image?, elements? }`.

### Helpers

| Helper | Signature | Key |
|---|---|---|
| `meta` | `(name: string, content: string) => HeadElement` | `meta:<name>` |
| `og` | `(property: string, content: string) => HeadElement` | `meta:<property>` |
| `twitter` | `(name: string, content: string) => HeadElement` | `meta:<name>` |
| `jsonLd` | `(data: unknown) => HeadElement` | none |
| `canonical` | `(url: string) => HeadElement` | `link:canonical` |
| `hreflang` | `(locale: string, url: string) => HeadElement` | `link:alternate:<locale>` |
| `feedLink` | `(title: string, url: string, type?: string) => HeadElement` | `link:feed:<url>`; `type` defaults to `"application/rss+xml"` |
| `buildArticleHead` | `(meta: ArticleMeta, canonicalUrl: string) => HeadElement[]` | canonical, `og:type`, `article:*`, JSON-LD |

`ArticleMeta`: `title`, and optional `description`, `author`, `published`, `modified`, `section`,
`tags`, `image`. The helpers are also reachable as `headPlugin.meta`, `headPlugin.og` and so on.

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [site](/docs/web/plugins/site/): name, description, URL and `canonical()`.
- [router](/docs/web/plugins/router/): `toUrl()`, for canonical and alternate links.
- [i18n](/docs/web/plugins/i18n/), optional: `locales()` for hreflang and `ogLocale()`. Without
  it there is one locale and no `og:locale`.

## Example

```ts file="scripts/head.ts" check
import { createApp, defineRoutes, jsonLd, og, route } from "@moku-labs/web";
import { h } from "preact";

const routes = defineRoutes({ about: route("/about/").render(() => h("h1", null, "About")) });

const app = createApp({
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    head: { titleTemplate: "%s · My Blog", twitterHandle: "@moku_labs" },
    router: { routes }
  }
});

const html = app.head.render(
  {
    path: "/about/",
    name: "about",
    params: {},
    head: {
      title: "About",
      elements: [
        og("og:title", "About the blog"), // [!note] Same key as the generated `og:title`, so it replaces it.
        jsonLd({ "@context": "https://schema.org", "@type": "AboutPage" })
      ]
    }
  },
  {}
);

console.log(app.head.composeTitle({ title: "About" })); // "About · My Blog"
console.log(html.includes('<meta property="og:title" content="About the blog">')); // true
```

```sh terminal title="run"
$ bun scripts/head.ts
About · My Blog
true
```

:::gotchas
- **`titleTemplate` must contain `%s`.** `createApp` throws `[web] head: titleTemplate must contain the "%s" token (replaced by the route title), received "…".`
- **`buildArticleHead` keeps `image` as given.** It does not resolve relative URLs. The route-level `image` does.
- **Use the helpers, not raw strings.** Elements are data. A string in `elements` is not a head tag.
- **On client navigation the head is not re-composed.** `spa` copies it from the fetched page, or only sets the title on the data path.
:::

## Related

- [Head & SEO](/docs/web/guides/head/): the guide, with the build output.
- [build plugin](/docs/web/plugins/build/): feeds, sitemap and OG images.
