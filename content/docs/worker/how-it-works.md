---
title: How it works
description: "One app per isolate, one env per invocation. Bindings live on the call stack, never in a plugin."
section: Get started
order: 3
---

## The picture

:::steps
1. **Isolate start.** Your `worker.ts` module loads. `createApp` runs once, synchronously: it resolves config, runs every `onInit`, compiles the endpoint table and returns a frozen app.
2. **Invocation.** Cloudflare calls `fetch`, `scheduled` or `queue` with a fresh `env`. Your default export passes it on.
3. **Dispatch.** `app.server` matches the route and builds a new request context on the stack.
4. **Binding.** A handler calls `require(kvPlugin).get(env, key)`. The plugin reads the binding off that `env`, makes the call and forgets it.
:::

```text file="fetch → Response"
your worker.ts            app.server.handle             your handler            kv / d1 / storage ...
fetch(request, env, ctx) ──► match method + path  ──► ({ params, env, ... }) ──► get(env, key)
                             new context per call                                 env.LINKS.get(key)
                                                  ◄── Response
```

## env is an argument

One Cloudflare isolate serves many requests at the same time. A binding kept in a plugin would be
visible to the other requests in flight. So no plugin stores `env`. Every runtime method takes it
first:

```ts file="src/reads.ts" check
import type { WorkerEnv } from "@moku-labs/worker";
import { createApp, d1Plugin, durableObjectsPlugin, kvPlugin } from "@moku-labs/worker";

const app = createApp({
  plugins: [kvPlugin, d1Plugin, durableObjectsPlugin],
  pluginConfigs: {
    kv: { flags: { name: "flags", binding: "FLAGS" } },
    d1: { main: { name: "main-db", binding: "DB" } },
    durableObjects: { board: { binding: "BOARD", className: "Board" } }
  }
});

export async function read(env: WorkerEnv) {
  const flags = await app.kv.get(env, "feature-flags");
  const row = await app.d1.first(env, "SELECT 1");
  const stub = app.durableObjects.get(env, "board", "room-42");
  return { flags, row, stub };
}
```

The only methods without `env` are the `deployManifest()` methods. They read config at build time.

## Runtime and Node

Everything ships from one entry, `@moku-labs/worker`.

| Plugin | Runs in | Default | List it in |
|---|---|---|---|
| `bindings`, `server` | Worker | yes | nowhere |
| `kv`, `d1`, `storage`, `queues`, `durableObjects` | Worker | no | the Worker app, and the deploy app |
| `turn` | Node, reads config only | no | the deploy app |
| `deploy`, `cli` | Node | no | the deploy app |

The entry is one file, and it imports `node:fs`, `node:path`, `node:child_process` and `node:readline`
at the top. wrangler's bundler keeps those imports even when you only use `createApp` and `kvPlugin`.
So a Worker on this package starts only with the `nodejs_compat` flag. Set it with
`deploy: { nodeCompat: true }`. Without it, the runtime stops at start:

```text
Uncaught Error: No such module "node:fs".
```

The Node code ships in the bundle and never runs at request time. The quick-start Worker uploads about 177 KiB, 42 KiB after gzip.

`deploy` reads the resource plugins' `deployManifest()`, so the same config drives the runtime and
the generated wrangler config. Plugins cannot read each other's config. The manifest is the contract.

## Keyed resources

`kv`, `d1`, `storage`, `queues`, `durableObjects` and `turn` all take a map of instances. The key is
your logical name. The `name` is the Cloudflare resource. The `binding` is the key on `env`.

```ts file="src/resources.ts" check
import { createApp, kvPlugin } from "@moku-labs/worker";

const app = createApp({
  plugins: [kvPlugin],
  pluginConfigs: {
    kv: {
      sessions: { name: "my-sessions", binding: "SESSIONS", default: true }, // [!note] With one entry this flag is not needed. With several, exactly one has it.
      cache: { name: "my-cache", binding: "CACHE" }
    }
  }
});

export const read = (env: Record<string, unknown>) => app.kv.get(env, "s:1"); // [!note] The default namespace.
export const cached = (env: Record<string, unknown>) => app.kv.use("cache").get(env, "page:home"); // [!note] A named one.
```

The lookup is lazy. A wrong key, or several instances with no default, throws only when a method
runs, not at `createApp`. `durableObjects` has no default: `get` always names the instance.

## Config and stage

`createApp({ config })` takes three flat fields. Every plugin reads them on `ctx.global`.

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `"worker"` | The Worker name. `deploy` writes it as wrangler `name`. |
| `stage` | `"production" \| "development" \| "test"` | `"production"` | The default stage of `deploy` and `dev`. |
| `compatibilityDate` | `string` | `""` | Written as wrangler `compatibility_date`. |

A stage other than `production` suffixes the Worker and every provisioned name: `shortener` becomes
`shortener-dev` on stage `dev`. `deploy.run({ stage })` accepts any string, so `"dev"` and `"staging"`
work even though `config.stage` lists three values.

## Events

Events are observability. Work flows through return values, because an emit cannot carry a response.

| Event | Emitted by | When |
|---|---|---|
| `request:start`, `request:end` | [server](/docs/worker/plugins/server/) | Around `handle`. |
| `server:matched` | [server](/docs/worker/plugins/server/) | After a match, before the handler. |
| `queue:message` | [queues](/docs/worker/plugins/queues/) | After each consumed message. |
| `deploy:phase`, `deploy:complete` | [deploy](/docs/worker/plugins/deploy/) | Each pipeline phase, then the URL. |
| `provision:plan`, `provision:resource`, `provision:skip` | [deploy](/docs/worker/plugins/deploy/) | The plan, then one per resource. |
| `auth:verified` | [deploy](/docs/worker/plugins/deploy/) | After the token resolves. |
| `dev:phase`, `dev:rebuilt`, `dev:error` | [deploy](/docs/worker/plugins/deploy/) | The local dev session. |

`server:matched` and `queue:message` are local events: a hook needs `depends` on the plugin that owns
them. The rest are global and visible to every plugin.

:::gotchas
- **Do not capture `env`.** A module variable or plugin state set from `env` leaks one request's bindings into the next.
- **`createApp` runs at module load.** Keep it free of network calls. Cloudflare gives bindings only to the invocation.
- **No `app.start()` here.** Workers are request-scoped. The built-in plugins have nothing to start, and the entry never calls it.
- **A Durable Object runs elsewhere.** Its class runs in its own isolate with no access to `app` and no event bus.
:::

## Related

- [Quick start](/docs/worker/quick-start/): the two apps in full.
- [bindings plugin](/docs/worker/plugins/bindings/): how a binding is resolved.
- [deploy plugin](/docs/worker/plugins/deploy/): the manifest and the pipeline.
