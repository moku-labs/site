---
title: hub
description: "Self-hosted signaling on Cloudflare: a worker plugin and one Durable Object per room. It never carries gameplay."
section: Plugins
kind: optional
order: 26
---

## What it does

**Optional, on the server.** `hub` runs the rendezvous yourself, instead of public relays. It is a
`@moku-labs/worker` plugin, imported from `@moku-labs/room/server`, and never composed in a browser
app. Its `Hub` Durable Object brokers the handshake. There is no code path that relays gameplay.

| You get | How |
|---|---|
| No public relay dependency | One WebSocket per device to your worker. |
| Reclaim on a stage reload | A token keeps the warm room alive. |
| An eviction notice | `room:network-warning` with `room-evicted`. |
| TURN credentials | `GET /api/ice`, when the secrets exist. |

## How it works

`handle(request, env, ctx)` is the worker's whole fetch handler:

| Request | Response |
|---|---|
| `Upgrade: websocket` with a code in the path or `?room=` | Rate-limited, then forwarded to that room's `Hub`. |
| `Upgrade: websocket` with no code | `400`. Over the limit: `429`. |
| `GET /api/ice` | `{ iceServers }`. With no secrets, an empty `200 {}`. |
| Other method on `/api/ice` | `405`. Over the limit `429`, a failed mint `502`. |
| Anything else | The `ASSETS` binding: your built client. |

The `Hub` object rejects a `join` later than `joinWindowMs` after the socket opened, sends `full` over the
cap, and deletes its storage on an alarm after `roomTtlMs`, once no socket is left.

## Config

`pluginConfigs.hub`.

| Option | Default | Description |
|---|---|---|
| `doBinding` | `"ROOM_HUB"` | The Durable Object binding. |
| `doClassName` | `"Hub"` | The exported class. |
| `assetsBinding` | `"ASSETS"` | The static assets binding. |
| `rateLimit` | `{ joins: 30, windowSec: 60, kvBinding: "RATE_LIMIT" }` | Joins per IP. |
| `ice` | `{ path: "/api/ice", keyIdBinding: "TURN_KEY_ID", apiTokenBinding: "TURN_KEY_API_TOKEN", rateLimit: { max: 30, windowSec: 60 } }` | The credential endpoint. |
| `joinWindowMs` | `10000` | The join window of a socket. |
| `roomTtlMs` | `1800000` | Idle time before a room is deleted. |

## API

Mounted at `app.hub`.

| Method | Signature | Description |
|---|---|---|
| `handle` | `(request: Request, env, ctx) => Promise<Response>` | The fetch handler. |

## Events

### Emits

None. `room-evicted` is emitted in the browser, by `transport`.

### Listens to

None.

## Depends on

No plugin. It reads the bindings from the Cloudflare `env`.

## Example

Compose it in your own worker app. Room ships no `wrangler.jsonc`: the worker's `deployPlugin` generates it.

```ts file="src/server.ts" group="hub" no-check="the server entry ships no type declarations"
import { hubPlugin } from "@moku-labs/room/server";
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

export const server = createApp({
  // [!note] `deployPlugin` depends on all five resource plugins, used or not. Omit one and `createApp` throws.
  plugins: [kvPlugin, d1Plugin, storagePlugin, queuesPlugin, durableObjectsPlugin, hubPlugin, deployPlugin, cliPlugin],
  pluginConfigs: {
    durableObjects: { hub: { binding: "ROOM_HUB", className: "Hub" } },
    kv: { rateLimit: { name: "ratelimit", binding: "RATE_LIMIT" } }
  }
});
```

```ts file="src/cloudflare/worker.ts" group="hub" no-check="the server entry ships no type declarations"
import { server } from "../server";

export { Hub } from "@moku-labs/room/server"; // [!note] Wrangler binds ROOM_HUB to this class.

export default {
  fetch: (request: Request, env: Record<string, unknown>, ctx: ExecutionContext) =>
    server.hub.handle(request, env, ctx)
} satisfies ExportedHandler;
```

The browser only selects the adapter.

```ts file="src/client.ts" check
import { createApp, serverSignaling, stagePlugin } from "@moku-labs/room";

export const app = createApp({
  plugins: [stagePlugin],
  pluginConfigs: {
    transport: { signaling: serverSignaling("wss://room.example.com") },
    session: { codeLength: 8 } // [!note] A public endpoint can be scanned. Eight characters resist guessing a code.
  }
});
```

For TURN, add the worker's `turnPlugin` to the app. It provisions the two secrets on deploy, and
`iceServers: "auto"` picks them up with no client code.

:::gotchas
- **`@moku-labs/room/server` has no types.** The package ships no `.d.ts` for this entry. Under strict TypeScript the import is an error until you add your own declaration, and `server.hub` is untyped.
- **`@moku-labs/worker` is an optional peer.** Install it yourself, in the worker app only.
- **Three bindings are required.** `ROOM_HUB`, `RATE_LIMIT` and `ASSETS`. Without the KV binding a WebSocket upgrade fails.
- **`full` from the hub does not reach `joinRoom`.** The adapter ignores that message.
:::

## Related

- [@moku-labs/worker](/docs/worker/): the framework this plugin runs on.
- [transport plugin](/docs/room/plugins/transport/): `serverSignaling` and `"auto"`.
