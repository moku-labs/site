---
title: cli
description: "Node-only. build, serve, preview and deploy as app methods, with the branded terminal panel."
section: Plugins
kind: node
order: 21
---

## What it does

**Node-only.** `cli` turns the build and the deploy into five methods at `app.cli`. Four of them
back one script each: `build`, `serve`, `preview`, `deploy`. The fifth, `update`, is a headless
incremental rebuild for an external dev loop, such as a `@moku-labs/worker` dev session that
serves this site.

There is no argument parser, no `run()` dispatcher and no binary. A script names its command by
calling it.

## How it works

`cli` depends on `build` and `deploy` and calls them at run time. It renders live progress by
hooking their events: every `build:phase` becomes a row, `build:complete` becomes the BUILD box,
`deploy:complete` the DEPLOYED box.

On a terminal the panel is animated: the `▟▙ moku web` lockup with the version and runtime, a
live phase tree, boxed results and a breathing "live" line while the dev server waits. In CI and
pipes, or with `NO_COLOR`, it prints plain lines: one per finished phase, no animation.

The dev server, the preview server and the file watcher live inside `serve()` and `preview()`
and close on Ctrl+C. The plugin itself holds no resource, so it has no `onStart` or `onStop`.

## Config

`pluginConfigs.cli`. Every field has a default.

| Option | Type | Default | Description |
|---|---|---|---|
| `outDir` | `string` | `"dist"` | The build output: served by `preview`, checked by `build`, rebuilt by `serve`. |
| `port` | `number` | `4173` | Port for `serve()` and `preview()`. Overridable per call. |
| `watchDirs` | `string[]` | `["content", "src"]` | Folders `serve()` watches, recursively. |
| `debounceMs` | `number` | `150` | Window that merges a burst of file events into one rebuild. |
| `notFoundFile` | `string` | `"404.html"` | The file `build()` requires at the root of `outDir`. |
| `liveReload` | `boolean` | `true` | Inject the live-reload client into pages during `serve()`. Never during `preview()`. |

`createApp` fails with code `ERR_CLI_CONFIG` when `port` is not an integer from 1 to 65535,
`outDir` or `notFoundFile` is empty, `watchDirs` is empty or `debounceMs` is negative.

## API

Mounted at `app.cli`, reachable with `ctx.require(cliPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `build` | `(options?: { assertNotFound?: boolean }) => Promise<BuildSummary>` | Runs `build.run()`, then checks `<outDir>/<notFoundFile>`. Throws `ERR_CLI_NOT_FOUND` when it is missing. |
| `update` | `(changes: readonly string[], options?: { og?, sitemap?, feeds? }) => Promise<BuildSummary>` | Incremental rebuild for the changed paths. No header, no 404 check. OG images, sitemap and feeds stay off unless turned on. |
| `serve` | `(options?: { port?, open?, og?, sitemap?, feeds? }) => Promise<void>` | Builds once, serves `outDir` with live reload, watches `watchDirs`, rebuilds and reloads. Resolves on Ctrl+C. `open` is reserved. |
| `preview` | `(options?: { port? }) => Promise<void>` | Serves the built `outDir` like Cloudflare Pages: `/a/` → `a/index.html`, a miss → the nearest `404.html` with status 404. |
| `deploy` | `(options?: { branch?, yes?, guided? }) => Promise<DeployOutcome>` | `guided: true` runs the setup wizard. Otherwise: `deploy.init({ ci: true })`, a y/N prompt on an interactive terminal only, then `deploy.run()`. |

`BuildSummary` is `{ outDir, pageCount, durationMs }`. `DeployOutcome` is
`{ deployed: true, url, deploymentId, branch, durationMs }` or
`{ deployed: false, reason: "declined" | "blocked" | "failed" }`.

## Events

### Emits

None.

### Listens to

| Event | Source | What it renders |
|---|---|---|
| `build:phase` | build | A phase row: spinner while running, `✓` and the time when done. |
| `build:complete` | build | The BUILD box with the page count, time and output folder. |
| `deploy:complete` | deploy | The DEPLOYED box with the branch, time and URL. |

## Depends on

- [build](/docs/web/plugins/build/): `run()` for `build`, `update` and `serve`.
- [deploy](/docs/web/plugins/deploy/): `init()` and `run()` for `deploy`.

Both are Node-only, so `cli` is too. List them before it: `plugins: [buildPlugin, deployPlugin, cliPlugin]`.

## Example

```ts file="src/app.ts" check
import { buildPlugin, cliPlugin, createApp, defineRoutes, deployPlugin, processEnv, route } from "@moku-labs/web";
import { h } from "preact";

const routes = defineRoutes({ home: route("/").render(() => h("h1", null, "My Blog")) });

export const app = createApp({
  plugins: [buildPlugin, deployPlugin, cliPlugin],
  pluginConfigs: {
    site: { name: "My Blog", url: "https://blog.dev", author: "Ada", description: "Notes." },
    router: { routes },
    build: { outDir: "dist", notFound: true },
    cli: { outDir: "dist", port: 3000, watchDirs: ["content", "src", "public"] }, // [!note] Watch `public/` too, so a changed image triggers a rebuild.
    env: { providers: [processEnv()] }
  }
});

const summary = await app.cli.build(); // [!note] In a real project this line is the whole of `scripts/build.ts`.
console.log(summary.pageCount);
```

```sh terminal title="build"
$ bun run build
▟▙ moku web  build                                       v2.4.11
✓ bundle · 5ms
✓ content · 1239ms
✓ pages · 5ms
✓ not-found · 1ms
✓ sitemap · 1ms
✓ cache-headers · 0ms
✓ root-index · 0ms
✓ BUILD · 9 pages                                1252ms · ./dist/
```

:::gotchas
- **`build()` needs the 404 page.** Set `build.notFound`, or pass `{ assertNotFound: false }`. Cloudflare Pages switches a project without a top-level `404.html` to SPA mode.
- **The direct `deploy()` writes a workflow.** It calls `deploy.init({ ci: true })`, so `.github/workflows/deploy.yml` appears when it is missing.
- **The prompt never blocks CI.** The y/N confirm shows only on an interactive terminal with `CI` unset. `{ yes: true }` skips it anywhere.
- **A failed direct deploy is re-thrown.** The panel prints the cause and a hint, then the error propagates, so CI exits non-zero.
- **`serve()` skips expensive outputs.** OG images, sitemap and feeds are off in the dev loop unless you pass `og`, `sitemap` or `feeds`.
:::

## Related

- [Build & deploy](/docs/web/guides/deploy/): the scripts and the first deploy.
- [build plugin](/docs/web/plugins/build/) and [deploy plugin](/docs/web/plugins/deploy/).
