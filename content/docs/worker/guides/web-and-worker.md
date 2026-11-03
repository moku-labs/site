---
title: A site with an API
description: "Serve a @moku-labs/web site and a Worker API from one deploy, with one dev command."
section: Guides
order: 11
---

## The shape

A [`@moku-labs/web`](/docs/web/) site is static files. A Worker can serve them as assets, next to its
API. Three parts:

:::steps
1. **`assets`.** The wrangler block that serves `dist/` and exposes it on a binding.
2. **A fall-through route.** Your API routes match first. Anything else goes to the assets.
3. **Build hooks.** `dev` and `deploy` build the site through hooks your script passes in.
:::

The site app is untouched. The worker package does not import it. Your script passes the two together.

## The Worker

The fall-through lives in your entry: try the API, and on a 404 ask the assets.

```ts file="src/app.ts" group="site" check
import { createApp, endpoint } from "@moku-labs/worker";

export const app = createApp({
  config: { name: "my-site", compatibilityDate: "2026-06-17" },
  pluginConfigs: {
    server: {
      endpoints: [endpoint("/api/hello").get(() => Response.json({ hello: "world" }))]
    }
  }
});
```

```ts file="src/worker.ts" group="site" no-check="ExecutionContext and ExportedHandler come from @cloudflare/workers-types, which clash with the DOM types the other examples use"
import { app } from "./app";

type Assets = { fetch(request: Request): Promise<Response> };

export default {
  fetch: async (request: Request, env: Record<string, unknown>, ctx: ExecutionContext) => {
    const response = await app.server.handle(request, env, ctx);
    if (response.status !== 404) return response;
    return app.bindings.require<Assets>(env, "ASSETS").fetch(request); // [!note] Not an API path: the static site answers.
  }
} satisfies ExportedHandler;
```

An API route that returns its own 404 falls through too. Mount the API under one prefix and check it
before you hand over, if that matters.

## The script

```ts file="scripts/cli.ts" group="site" no-check="`./web` is your own @moku-labs/web app, which this page does not define"
import {
  cliPlugin,
  createApp,
  d1Plugin,
  deployPlugin,
  durableObjectsPlugin,
  kvPlugin,
  queuesPlugin,
  storagePlugin
} from "@moku-labs/worker";
import { web } from "./web"; // [!note] The Node app of your site, with the web `cli` plugin.

const tools = createApp({
  plugins: [storagePlugin, kvPlugin, d1Plugin, queuesPlugin, durableObjectsPlugin, deployPlugin, cliPlugin],
  config: { name: "my-site", compatibilityDate: "2026-06-17" },
  pluginConfigs: {
    deploy: {
      entry: "src/worker.ts",
      nodeCompat: true,
      assets: { binding: "ASSETS", directory: "dist" }
    }
  }
});

const webBuild = () => web.cli.build();

if (process.argv[2] === "deploy") await tools.cli.deploy({ webBuild });
else await tools.cli.dev({ webBuild, onChange: changes => web.cli.update(changes) });
```

| Command | What runs |
|---|---|
| `dev` | One cold `webBuild`. Local migrations. `wrangler dev --live-reload` once. Then `onChange` per batch of changes. |
| `deploy` | Auth, then `webBuild`, then the rest of the pipeline. So the assets exist before wrangler ships them. |

A failed rebuild emits `dev:error` and keeps serving the last good build. wrangler is not restarted
for a site change, and its asset server reloads the browser.

For an app with client routes only, `assets: { binding: "ASSETS", directory: "dist", spa: true }` serves
`index.html` for unknown paths. A static-first site with real pages does not want it, because a missing
page would then answer `200`.

:::gotchas
- **`watch` covers `src` and `public`.** A site with content elsewhere adds it: `deploy: { watch: ["src/**/*", "public/**/*", "content/**/*"] }`. Only the top directory of each glob is used.
- **No hook means a fallback.** Without `webBuild`, `dev` runs `buildCommand`, then `scripts/build.ts` if it exists, and otherwise serves the Worker alone.
- **`deploy` has no such fallback.** It builds only through `webBuild`, from the call or from config.
- **Two `cli` plugins, two apps.** The web app has its own `cli` and the worker app has its own. They do not share a list.
:::

## Related

- [deploy plugin](/docs/worker/plugins/deploy/): `assets`, `watch` and the hooks.
- [web cli plugin](/docs/web/plugins/cli/): `build` and `update`.
- [server plugin](/docs/worker/plugins/server/): the endpoint table.
