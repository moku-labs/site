---
title: site
description: "Default. The frozen site identity: name, URL, author, description, and canonical URLs."
section: Plugins
order: 29
---

## What it does

**Isomorphic default.** `site` holds four values that the rest of the framework reads: the site
name, the absolute base URL, the author and the description. It also joins paths into canonical
URLs. `router`, `head`, `build` and `deploy` depend on it.

## How it works

The four config fields are the whole model. The accessors read the frozen config and return
strings. There is no state and no event.

`createApp` validates the config right away: `name` must not be blank and `url` must be an
absolute `http` or `https` URL. The defaults are empty strings that only satisfy the type, so
every app passes real values, in the Node app and in the browser app.

`canonical(path)` joins a path to `url` without a double slash and keeps a trailing slash.
`canonical("/")` and `canonical("")` return the base URL.

## Config

`pluginConfigs.site`.

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `""` | The site name: the fallback page title, feeds, the Pages project slug. Required. |
| `url` | `string` | `""` | The absolute base URL, e.g. `"https://blog.dev"`. Required. |
| `author` | `string` | `""` | The default byline, for feeds and article meta. |
| `description` | `string` | `""` | The default meta description and feed description. |

## API

Mounted at `app.site`, reachable with `ctx.require(sitePlugin)`.

| Method | Signature | Description |
|---|---|---|
| `name` | `() => string` | The site name. |
| `url` | `() => string` | The base URL. |
| `author` | `() => string` | The author. |
| `description` | `() => string` | The description. |
| `canonical` | `(path: string) => string` | The absolute URL of a path. |

## Events

### Emits

None.

### Listens to

None.

## Depends on

Nothing.

## Example

```ts file="src/site.ts" check
import { createApp } from "@moku-labs/web";

export const site = {
  name: "My Blog",
  url: "https://blog.dev",
  author: "Ada Lovelace",
  description: "Notes on computing."
}; // [!note] Keep it in one module and pass it to the Node app and the browser app.

const app = createApp({ pluginConfigs: { site } });

console.log(app.site.name()); // "My Blog"
console.log(app.site.canonical("/posts/hello/")); // "https://blog.dev/posts/hello/"
console.log(app.site.canonical("/")); // "https://blog.dev"
```

```sh terminal title="createApp with a relative URL"
$ bun scripts/build.ts
error: [web] site.url must be a valid absolute URL (http/https), received "blog.dev".
  Provide an absolute URL in pluginConfigs.site.url, e.g. "https://blog.dev".
```

The error is thrown by `createApp`, before any build work starts. Bun prints the source line
above it; it is left out here.

:::gotchas
- **No usable defaults.** Without `pluginConfigs.site`, `createApp` throws `[web] site.name is required.` That includes the browser app.
- **`url` is the production origin.** Canonical links, `og:url`, absolute images, the sitemap and the feeds all start from it. A preview deploy still points them at production.
- **Errors have two lines.** The first says what is wrong, the indented second says how to fix it.
:::

## Related

- [Head & SEO](/docs/web/guides/head/): where the identity ends up.
- [deploy plugin](/docs/web/plugins/deploy/): the project slug from `name`.
