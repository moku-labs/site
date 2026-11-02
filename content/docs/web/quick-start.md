---
title: Quick start
description: "From an empty folder to a deployed static blog with client navigation."
section: Get started
order: 2
---

## A static blog in eight steps

:::steps
1. **Create the project and install.** `preact`, `preact-render-to-string`, `@moku-labs/core` and `@moku-labs/common` are peer dependencies. Declare them yourself: a second copy of Preact breaks hooks and island hydration.

   ```sh terminal title="install"
   $ mkdir my-blog && cd my-blog
   $ bun init -y
   $ bun add @moku-labs/web @moku-labs/core @moku-labs/common preact preact-render-to-string
   ```

2. **Point JSX at Preact.** Routes and islands are `.tsx`. Without these two lines Bun looks for React and the build fails.

   ```json file="tsconfig.json"
   {
     "compilerOptions": {
       "jsx": "react-jsx",
       "jsxImportSource": "preact",
       "module": "Preserve",
       "moduleResolution": "bundler",
       "strict": true
     }
   }
   ```

3. **Add content.** One folder per article, one file per locale. The frontmatter fields `title`, `date`, `description`, `tags` and `language` are required.

   ```md file="content/hello-world/en.md"
   ---
   title: Hello world
   date: 2026-01-15
   description: The first post.
   tags: [intro]
   language: en
   ---

   Some text.
   ```

4. **Write the routes.** A route is a pattern plus `generate`, `load`, `render` and `head`. `generate` and `load` run at build only. `render` and `head` run at build and in the browser.

5. **Compose the app.** The defaults (`site`, `i18n`, `router`, `head`, `spa`) are always there. Add the Node-only plugins the build needs.

6. **Add one script per command.** The `cli` plugin has no argument parser. Each script calls one method.

7. **Build.** `bun run build` writes static HTML, feeds, a sitemap and the JSON sidecars into `dist/`.

8. **Deploy.** `bun run deploy` runs a guided wizard: it checks the Cloudflare credentials, offers to scaffold `wrangler.jsonc`, test-builds and ships `dist/` to Cloudflare Pages.
:::

## The code

The routes import from `@moku-labs/web/browser`, because the client bundle imports this file
too. The app imports from `@moku-labs/web`, the Node entry.

```tsx file="src/routes.tsx" group="quick-start" check
import { contentPlugin, defineRoutes, route } from "@moku-labs/web/browser";

export const routes = defineRoutes({
  home: route("/{lang:?}/")
    .generate(ctx => [{ lang: ctx.locale }]) // [!note] One home page per locale. Without `generate` only the default locale gets one.
    .load(async ctx => {
      const content = ctx.require(contentPlugin); // [!note] Sibling plugins come through `ctx.require`. The return type becomes `ctx.data`.
      const byLocale = await content.loadAll();
      return (byLocale.get(ctx.locale) ?? []).map(article => content.articleToCard(article));
    })
    .render(ctx => (
      <ul>
        {ctx.data.map(card => (
          <li key={card.contentId}>
            <a href={card.url}>{card.title}</a>
          </li>
        ))}
      </ul>
    ))
    .head(() => ({ title: "Home" })),
  post: route("/{lang:?}/{slug}/")
    .generate(async ctx => {
      const byLocale = await ctx.require(contentPlugin).loadAll();
      return (byLocale.get(ctx.locale) ?? []).map(article => ({
        lang: ctx.locale,
        slug: article.computed.slug
      }));
    })
    .load(ctx => ctx.require(contentPlugin).load(ctx.params.slug, ctx.locale))
    .render(ctx => <article dangerouslySetInnerHTML={{ __html: ctx.data.html }} />)
    .head(ctx => ({
      title: ctx.data.frontmatter.title,
      description: ctx.data.frontmatter.description
    }))
});
```

```ts file="src/app.ts" group="quick-start" hl="15-16"
import {
  buildPlugin,
  cliPlugin,
  contentPlugin,
  createApp,
  dataPlugin,
  deployPlugin,
  dotenv,
  fileSystemContent,
  processEnv
} from "@moku-labs/web";
import { routes } from "./routes";

export const app = createApp({
  plugins: [contentPlugin, dataPlugin, buildPlugin, deployPlugin, cliPlugin], // [!note] Node-only plugins are opt-in. `dataPlugin` makes the build write the JSON sidecars.
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    i18n: { locales: ["en", "uk"], defaultLocale: "en" },
    router: { routes },
    head: { titleTemplate: "%s · My Blog" },
    content: { providers: [fileSystemContent({ contentDir: "content" })] },
    build: { clientEntry: "src/client.tsx", notFound: true }, // [!note] `notFound: true` writes `dist/404.html`. `cli.build()` fails without it.
    env: { providers: [processEnv(), dotenv(".env")] }
  }
});
```

```ts file="scripts/build.ts" group="quick-start"
import { app } from "../src/app";

await app.cli.build();
```

```json file="package.json" group="quick-start"
{
  "scripts": {
    "build": "bun scripts/build.ts",
    "dev": "bun scripts/serve.ts",
    "preview": "bun scripts/preview.ts",
    "deploy": "bun scripts/deploy.ts"
  }
}
```

`scripts/serve.ts` and `scripts/preview.ts` are the same two lines with `app.cli.serve()` and
`app.cli.preview()`. `scripts/deploy.ts` turns on the guided wizard unless `--cli` is passed:

```ts file="scripts/deploy.ts"
import { app } from "../src/app";

await app.cli.deploy({ guided: !process.argv.includes("--cli") });
```

## Build

```sh terminal title="build"
$ bun run build
▟▙ moku web  build                                       v2.4.11
✓ bundle · 5ms
✓ images · 0ms
✓ content · 1239ms
✓ pages · 5ms
✓ content-images · 0ms
✓ not-found · 1ms
✓ feeds · 2ms
✓ sitemap · 1ms
✓ cache-headers · 0ms
✓ root-index · 0ms
✓ BUILD · 9 pages                                1252ms · ./dist/
```

Nine pages from two articles, `hello-world` in English and Ukrainian and `second-post` in English only: the English pages at bare paths, a copy of each under `/en/`
with a canonical link to the bare URL, and the Ukrainian pages under `/uk/`. The second article
has no `uk.md`, so `/uk/second-post/` shows the English text.

## Add client navigation

The browser entry has the same `createApp` over the same defaults, with every Node-only module
left out. Name it in `build.clientEntry` and the build bundles it into `dist/assets/`.

```tsx file="src/client.tsx" check
import { createApp, dataPlugin, defineRoutes, route } from "@moku-labs/web/browser";

const routes = defineRoutes({ home: route("/").render(() => <h1>My Blog</h1>) }); // [!note] In your app, import the shared `./routes` here instead.

const app = createApp({
  plugins: [dataPlugin], // [!note] With `data` composed, a link click fetches the page JSON and runs the route's `render`.
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    router: { routes }
  }
});

await app.start(); // [!note] Mounts islands on the static HTML and starts intercepting links.
```

The browser app needs the same `site`, `i18n` and `router` config as the Node app. Put the
shared values in one module and import it in both.

## Deploy

Put the Cloudflare credentials in `.env` (keep it out of git) and in the repository secrets for
CI. Then deploy.

```sh file=".env"
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

```sh terminal title="deploy"
$ bun run deploy
▟▙ moku web  deploy                                      v2.4.11
✓ DEPLOYED · main                                             9.4s
→ https://my-blog.pages.dev · 3f2a9c1e
```

The project name is the site name as a slug: `My Blog` deploys to the Pages project `my-blog`.
See [Build & deploy](/docs/web/guides/deploy/) for the guided wizard and CI.

:::gotchas
- **`load` and `generate` run at build only.** The browser never calls them. On client navigation it reads the JSON the build saved.
- **Import routes from `@moku-labs/web/browser`.** The client bundle imports the route file. A route file that imports `@moku-labs/web` drags Node code into the bundle and the build fails on a Node-only dependency.
- **`site.name` and `site.url` are required.** `createApp` throws `[web] site.name is required.` when they are missing, in the Node app and in the browser app.
- **`cli.build()` checks for `dist/404.html`.** Set `build.notFound`, or Cloudflare Pages treats the project as an SPA.
:::

## Next

- [How it works](/docs/web/how-it-works/): what the build writes and what the browser does with it.
- [Routing](/docs/web/guides/routing/): patterns, builder methods, links.
- [Islands](/docs/web/guides/islands/): make parts of a page interactive.
- [Build & deploy](/docs/web/guides/deploy/): scripts, the dev server, Cloudflare Pages.
