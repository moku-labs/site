---
title: kv
description: "A thin env-first wrapper over Cloudflare KV namespaces: get, put, delete, list."
section: Plugins
kind: optional
order: 22
---

## What it does

`kv` wraps one or more KV namespaces. The default namespace sits on `app.kv`, and `use(key)` selects
another one. Values are strings. Each call goes straight to the namespace, resolved from the `env`
you pass.

## How it works

The config is a map of instances. A single entry is the default. With several, exactly one needs
`default: true`. A problem with the map shows when a method runs, not at `createApp`.

`deploy` reads `deployManifest()`, creates the namespaces that are missing and writes their ids into
the wrangler config.

## Config

`pluginConfigs.kv`, keyed by your logical name. The default is `{}`.

| Option | Type | Default | Description |
|---|---|---|---|
| `[key].name` | `string` | required | The Cloudflare namespace. A stage other than `production` suffixes it at deploy. |
| `[key].binding` | `string` | required | The key on `env`. |
| `[key].default` | `boolean` | none | Marks the default when there are several. |

## API

Mounted at `app.kv`, reachable with `require(kvPlugin)` in a handler.

| Method | Signature | Description |
|---|---|---|
| `get` | `(env, key: string) => Promise<string \| null>` | The value, or `null`. |
| `put` | `(env, key: string, value: string, opts?: KVNamespacePutOptions) => Promise<void>` | Writes a string. `opts` carries `expirationTtl`, `expiration`, `metadata`. |
| `delete` | `(env, key: string) => Promise<void>` | Removes a key. Absent keys are fine. |
| `list` | `(env, opts?: KVNamespaceListOptions) => Promise<KVNamespaceListResult<unknown, string>>` | Lists keys, with `prefix`, `cursor`, `limit`. |
| `use` | `(key: string) => KvNamespaceApi` | The same four methods on another namespace. |
| `deployManifest` | `() => { kind: "kv"; name: string; binding: string }[]` | Build-time metadata. Takes no `env`. |

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [bindings](/docs/worker/plugins/bindings/): resolves the namespace on every call.

## Example

```ts file="src/app.ts" check
import { createApp, endpoint, kvPlugin } from "@moku-labs/worker";

export const app = createApp({
  plugins: [kvPlugin],
  pluginConfigs: {
    kv: {
      sessions: { name: "my-sessions", binding: "SESSIONS", default: true },
      cache: { name: "my-cache", binding: "CACHE" }
    },
    server: {
      endpoints: [
        endpoint("/session/{id}").put(async ({ params, request, env, require }) => {
          await require(kvPlugin).put(env, params.id, await request.text(), { expirationTtl: 3600 });
          return new Response(null, { status: 204 });
        }),
        endpoint("/page/{slug}").get(async ({ params, env, require }) => {
          const page = await require(kvPlugin).use("cache").get(env, params.slug);
          return page === null ? new Response("miss", { status: 404 }) : new Response(page);
        }),
        endpoint("/sessions").get(async ({ env, require }) => {
          const { keys } = await require(kvPlugin).list(env, { limit: 100 });
          return Response.json(keys.map((key: { name: string }) => key.name));
        })
      ]
    }
  }
});
```

:::gotchas
- **Text only.** `get` returns a string and `put` takes one. Use `JSON.stringify` for objects, or reach the raw namespace with `app.bindings.require` for binary and metadata reads.
- **KV is eventually consistent.** A write can take time to reach other locations. That comes from Cloudflare, not from this plugin.
- **Empty config fails late.** Listing `kvPlugin` with no instances throws `No kv instance is configured` at the first call.
:::

## Related

- [How it works](/docs/worker/how-it-works/): keyed resources.
- [deploy plugin](/docs/worker/plugins/deploy/): how a namespace gets created.
