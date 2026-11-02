---
title: Build & deploy
description: "From app.build.run() to a Cloudflare Pages URL, with one script per command."
section: Guides
order: 17
---

## How it fits together

Three Node-only plugins share the job:

- **build** renders every route into `dist/` and writes the site-wide files.
- **deploy** ships `dist/` to Cloudflare Pages through `wrangler`, and scaffolds `wrangler.jsonc`.
- **cli** wraps both in four commands with the branded terminal panel: `build`, `serve`,
  `preview`, `deploy`.

The `cli` plugin has no argument parser and no binary. Each command is a two-line script that
imports your app and calls one method.

:::flow
- bun run build
- app.cli.build()
- build.run()
- dist/
- app.cli.deploy()
- pages.dev
:::

## Example

```ts file="src/app.ts" group="deploy" hl="19-22"
import {
  buildPlugin,
  cliPlugin,
  contentPlugin,
  createApp,
  deployPlugin,
  dotenv,
  fileSystemContent,
  processEnv
} from "@moku-labs/web";
import { routes } from "./routes";

export const app = createApp({
  plugins: [contentPlugin, buildPlugin, deployPlugin, cliPlugin], // [!note] `cli` depends on `build` and `deploy`, so all three are listed, in this order.
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." }, // [!note] The site name becomes the Pages project name: `my-blog`.
    router: { routes },
    content: { providers: [fileSystemContent({ contentDir: "content" })] },
    build: { outDir: "dist", notFound: true, clientEntry: "src/client.tsx" },
    deploy: { outDir: "dist", productionBranch: "main" },
    cli: { outDir: "dist", port: 4173 },
    env: { providers: [processEnv(), dotenv(".env")] } // [!note] The deploy reads `CLOUDFLARE_API_TOKEN` through `env`. Without providers it sees nothing.
  }
});
```

```ts file="scripts/build.ts" group="deploy"
import { app } from "../src/app";

await app.cli.build();
```

```ts file="scripts/serve.ts" group="deploy"
import { app } from "../src/app";

await app.cli.serve();
```

```ts file="scripts/preview.ts" group="deploy"
import { app } from "../src/app";

await app.cli.preview();
```

```ts file="scripts/deploy.ts" group="deploy"
import { app } from "../src/app";

await app.cli.deploy({ guided: !process.argv.includes("--cli") }); // [!note] `bun run deploy` runs the wizard. `bun run deploy --cli` and CI take the direct path.
```

| Script | Method | What it does |
|---|---|---|
| `bun run build` | `cli.build()` | Runs the build, then checks that `dist/404.html` exists. |
| `bun run dev` | `cli.serve()` | Builds once, serves `dist/` with live reload, watches `content` and `src`, rebuilds on change. |
| `bun run preview` | `cli.preview()` | Serves the built `dist/` with Cloudflare Pages clean URLs and the nearest `404.html`. No reload. |
| `bun run deploy` | `cli.deploy()` | Guided: checks credentials and `wrangler.jsonc`, test-builds, deploys, offers a GitHub workflow. Direct: scaffolds, then deploys. |

## First deploy

:::steps
1. **Get the credentials.** Create a Cloudflare API token with the "Cloudflare Pages: Edit" permission and note your account ID. Put both in `.env` (keep it out of git) and in the repository secrets for CI.
2. **Run the wizard.** `bun run deploy` checks the prerequisites, offers to scaffold `wrangler.jsonc` and a placeholder `.env`, runs a local build and deploys when everything is green.
3. **Automate.** The wizard offers to write `.github/workflows/deploy.yml`. Or call `app.deploy.init({ ci: true, workflowTrigger: "auto" })` yourself. The triggers are `"auto"` (push to `main`), `"versioned-tag"` (a `v*` tag) and `"dispatch"` (manual).
:::

```sh terminal title="deploy"
$ bun run deploy
▟▙ moku web  deploy                                      v2.4.11
Checking prerequisites
✓ wrangler.jsonc (Cloudflare project config)
✓ CLOUDFLARE_API_TOKEN is set
✓ CLOUDFLARE_ACCOUNT_ID is set
Local test
✓ built 9 pages → dist/
✓ 404.html present
✓ DEPLOYED · main                                             9.4s
→ https://my-blog.pages.dev · 3f2a9c1e
```

## Without the cli plugin

The two plugins also work alone. This script builds and deploys in one go:

```ts file="scripts/release.ts" check
import { buildPlugin, createApp, defineRoutes, deployPlugin, processEnv, route } from "@moku-labs/web";
import { h } from "preact";

const routes = defineRoutes({ home: route("/").render(() => h("h1", null, "My Blog")) });

const app = createApp({
  plugins: [buildPlugin, deployPlugin],
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    router: { routes },
    build: { outDir: "dist", notFound: true },
    deploy: { outDir: "dist" },
    env: { providers: [processEnv()] }
  }
});

await app.deploy.init(); // [!note] Writes `wrangler.jsonc` once. An existing file is never overwritten.
const built = await app.build.run();
const deployed = await app.deploy.run({ branch: "main" }); // [!note] A branch other than the production branch makes a preview deployment.
console.log(`${built.pageCount} pages → ${deployed.url}`);
```

## What the build writes

| Path | When |
|---|---|
| `<path>/index.html` | every page. In `spa` mode a dynamic route without `generate` is skipped and rendered in the browser |
| `index.html` | when a `/` page was rendered |
| `assets/<name>-<hash>.{css,js}` | always; `minify` is on by default |
| `_data/**/index.json` | `mode` is not `"ssg"` and `data` is composed |
| `feed.xml`, `atom.xml`, `feed.json` | `feeds` (on by default) |
| `sitemap.xml`, `robots.txt` | `sitemap` (on by default) |
| `<slug>/images/…` | `images` (on by default), from co-located article folders |
| `og/<slug>.png`, `og-default.png` | `ogImage` |
| everything in `public/` | `publicDir` exists |
| `_headers` | `cacheHeaders` (on by default) |
| `404.html` | `notFound` |

`build.run()` deletes and recreates `outDir` first. The folder must sit inside the project, or in
the OS temp folder.

:::gotchas
- **`deploy` does not build.** It ships whatever is in `outDir`. Build first.
- **`cli.build()` fails without `dist/404.html`.** Set `build.notFound`. Without a top-level `404.html` Cloudflare Pages switches the project to SPA mode.
- **The direct `cli.deploy()` scaffolds a workflow.** It calls `deploy.init({ ci: true })`, which writes `.github/workflows/deploy.yml` when the file is missing, whatever `deploy.ci` says.
- **Wire the env providers.** The deploy reads the token through `ctx.env`, not the raw environment. The wizard says so: "Found in your shell/.env but the app's env plugin did not resolve it".
- **The Pages project must exist.** `deploy.init()` only writes local config. The wizard creates the project after a project-not-found failure, or call `app.deploy.createProject()`.
- **Cloudflare limits.** Preflight stops at 20,000 files and at any file over 25 MiB. Raise the file cap with the `MOKU_DEPLOY_MAX_FILES` environment variable on a paid plan.
:::

## Related

- [build plugin](/docs/web/plugins/build/): every option and the phases.
- [deploy plugin](/docs/web/plugins/deploy/): `run`, `init`, the error codes.
- [cli plugin](/docs/web/plugins/cli/): the five methods and the panel.
- [Head & SEO](/docs/web/guides/head/): feeds, sitemap and OG images.
