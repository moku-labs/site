---
title: Quick start
description: "From an empty folder to a deployed URL shortener on KV."
section: Get started
order: 2
---

## A URL shortener in seven steps

:::steps
1. **Create the project and install.** `@moku-labs/core` and `@moku-labs/common` are peer dependencies. `wrangler` is an optional peer: `deploy` and `cli` run it as a subprocess. `@cloudflare/workers-types` gives the runtime types such as `ExecutionContext`.

   ```sh terminal title="install"
   $ mkdir shortener && cd shortener
   $ bun init -y
   $ bun add @moku-labs/worker @moku-labs/core @moku-labs/common
   $ bun add -d wrangler @cloudflare/workers-types
   ```

2. **Add the runtime types.** List the Cloudflare package in `types`. The types are ambient, so you never import them.

   ```json file="tsconfig.json"
   {
     "compilerOptions": {
       "module": "Preserve",
       "moduleResolution": "bundler",
       "strict": true,
       "types": ["@cloudflare/workers-types"]
     }
   }
   ```

3. **Write the shared config.** Both apps below read it, so the Worker and the deploy cannot disagree on a name or a binding.

4. **Compose the Worker app.** `bindings` and `server` are defaults. You add `kvPlugin` and declare the routes as data.

5. **Write the Worker entry.** No plugin produces the default export. You assemble it and hand each request to `app.server`.

6. **Write the deploy script.** This second app adds the Node-only plugins. Your Worker never calls it. `nodeCompat` is required for every Worker on this package. `deploy` depends on all five resource plugins, so all five are listed. The ones without config contribute nothing.

7. **Run it locally, then deploy.** The first deploy asks for a Cloudflare token and shows which one to create. See [Build & deploy](/docs/worker/guides/deploy/) for the token and for CI.
:::

The files of steps 3 to 6:

```ts file="src/config.ts" group="shortener" check
export const worker = { name: "shortener", compatibilityDate: "2026-06-17" };

export const kv = { links: { name: "shortener-links", binding: "LINKS" } }; // [!note] `name` is the Cloudflare namespace. `binding` is the key on `env`.
```

```ts file="src/app.ts" group="shortener" check
import { createApp, endpoint, kvPlugin } from "@moku-labs/worker";
import { kv, worker } from "./config";

export const app = createApp({
  plugins: [kvPlugin],
  config: worker,
  pluginConfigs: {
    kv,
    server: {
      endpoints: [
        endpoint("/links/{slug}").put(async ({ params, request, env, require }) => {
          await require(kvPlugin).put(env, params.slug, await request.text()); // [!note] `env` is the first argument of every call. Nothing stores it.
          return new Response(null, { status: 204 });
        }),
        endpoint("/{slug}").get(async ({ params, env, require }) => {
          const target = await require(kvPlugin).get(env, params.slug);
          return target === null ? new Response("Not Found", { status: 404 }) : Response.redirect(target, 302);
        })
      ]
    }
  }
});
```

```ts file="src/worker.ts" group="shortener" no-check="ExecutionContext and ExportedHandler come from @cloudflare/workers-types, which clash with the DOM types the other examples use"
import { app } from "./app";

export default {
  fetch: (request: Request, env: Record<string, unknown>, ctx: ExecutionContext) =>
    app.server.handle(request, env, ctx)
} satisfies ExportedHandler;
```

```ts file="scripts/cli.ts" group="shortener" check
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
import { kv, worker } from "../src/config";

const tools = createApp({
  plugins: [storagePlugin, kvPlugin, d1Plugin, queuesPlugin, durableObjectsPlugin, deployPlugin, cliPlugin],
  config: worker,
  pluginConfigs: {
    kv,
    deploy: {
      entry: "src/worker.ts", // [!note] Becomes `main` in the generated wrangler config.
      nodeCompat: true // [!note] Writes `compatibility_flags: ["nodejs_compat"]`. Without it the Worker fails at start.
    }
  }
});

if (process.argv[2] === "deploy") await tools.cli.deploy();
else await tools.cli.dev();
```

Add two scripts, so `wrangler` from `node_modules/.bin` is on the `PATH`:

```json file="package.json"
{
  "scripts": {
    "dev": "bun scripts/cli.ts dev",
    "deploy": "bun scripts/cli.ts deploy"
  }
}
```

```sh terminal title="run it"
$ bun run dev
$ curl -X PUT localhost:8787/links/moku -d https://moku-labs.com
$ curl -i localhost:8787/moku
HTTP/1.1 302 Found
Location: https://moku-labs.com/
```

`bun run dev` writes `wrangler.jsonc` and starts `wrangler dev` on port 8787. `bun run deploy` lists
what already exists in your account, asks before it creates the rest, and asks again before it ships:

```sh terminal title="deploy"
$ bun run deploy
```

It prints a summary with the URL of the Worker, for example `https://shortener.<your-subdomain>.workers.dev`.

:::gotchas
- **`nodeCompat` is not optional.** The package is one file with top-level `node:*` imports, and wrangler keeps them in the bundle. Without the flag the Worker stops at start with `No such module "node:fs"`.
- **Two apps on purpose.** `cli` replaces the log sinks of its app, and `deploy` needs five plugins your Worker may not use. The Worker app stays small.
- **List all five resource plugins for `deploy`.** With fewer, `createApp` throws `Plugin "deploy" depends on "storage", but "storage" is not registered`.
- **Run through `bun run`.** `deploy` spawns the bare command `wrangler`. It has to be on the `PATH`.
- **Do not list `bindingsPlugin` or `serverPlugin`.** They are defaults. A second copy throws `Duplicate plugin name`.
:::

## Related

- [How it works](/docs/worker/how-it-works/): why `env` is an argument.
- [server plugin](/docs/worker/plugins/server/): routes, guards and cron.
- [kv plugin](/docs/worker/plugins/kv/): namespaces and the full API.
