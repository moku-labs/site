---
title: queues
description: "Cloudflare Queues from one plugin: send from a request, consume with a handler declared in config."
section: Plugins
kind: optional
order: 25
---

## What it does

`queues` gives a Worker both sides of a queue. `send` and `sendBatch` produce messages. `consume` is
what your `queue` export calls to deliver a batch to the instance's `onMessage`.

## How it works

The consumer is config: each instance can declare `onMessage`. `consume` picks the instance in this
order:

:::steps
1. **One instance.** It always matches.
2. **By name.** Its `name` equals `batch.queue`, or `batch.queue` starts with `name-`. That is the stage suffix: `orders-dev` finds `orders`.
3. **The default.** With no match, the default instance gets the batch. With no default, `consume` throws.
:::

Then it walks the messages one at a time: it awaits `onMessage(message, env)`, then emits
`queue:message`. An instance with no `onMessage` takes the batch and does nothing.

## Config

`pluginConfigs.queues`, keyed by your logical name. The default is `{}`.

| Option | Type | Default | Description |
|---|---|---|---|
| `[key].name` | `string` | required | The Cloudflare queue. A stage other than `production` suffixes it at deploy. |
| `[key].binding` | `string` | required | The producer key on `env`. |
| `[key].onMessage` | `(message: Message, env: WorkerEnv) => Promise<void>` | none | The consumer. With it, `deploy` registers this Worker as a consumer of the queue. |
| `[key].maxBatchTimeout` | `number` | Cloudflare's | Seconds to wait to fill a batch, 0 to 60. Written as `max_batch_timeout`, so it needs `onMessage`. |
| `[key].default` | `boolean` | none | Marks the default when there are several. |

## API

Mounted at `app.queues`, reachable with `require(queuesPlugin)` in a handler.

| Method | Signature | Description |
|---|---|---|
| `send` | `(env, body: unknown) => Promise<void>` | One message. |
| `sendBatch` | `(env, bodies: unknown[]) => Promise<void>` | One message per element. |
| `use` | `(key: string) => QueueProducerApi` | `send` and `sendBatch` on another queue. |
| `consume` | `(batch: MessageBatch, env, ctx: ExecutionContext) => Promise<void>` | The delivery. Resolves after every message settled. |
| `deployManifest` | `() => { kind: "queue"; name: string; binding: string; consumer?: boolean; maxBatchTimeout?: number }[]` | Build-time metadata. `consumer` is `true` with `onMessage`. |

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `queue:message` | `{ queue: string; messageId: string }` | After `onMessage` settled for a message. |

A hook on it needs `depends: [queuesPlugin]`.

### Listens to

None.

## Depends on

- [bindings](/docs/worker/plugins/bindings/): resolves the producer on every send.

## Example

```ts file="src/app.ts" group="orders" check
import type { WorkerEnv } from "@moku-labs/worker";
import { createApp, endpoint, kvPlugin, queuesPlugin } from "@moku-labs/worker";

type Order = { id: string };

export const app = createApp({
  plugins: [queuesPlugin, kvPlugin],
  pluginConfigs: {
    kv: { orders: { name: "orders-state", binding: "ORDERS_STATE" } },
    queues: {
      orders: {
        name: "orders",
        binding: "ORDERS",
        maxBatchTimeout: 5,
        onMessage: async (message: { body: unknown }, env: WorkerEnv) => {
          const order = message.body as Order;
          await app.kv.put(env, order.id, "received"); // [!note] A throw here rejects `consume`.
        }
      }
    },
    server: {
      endpoints: [
        endpoint("/orders").post(async ({ request, env, require }) => {
          await require(queuesPlugin).send(env, await request.json());
          return new Response(null, { status: 202 });
        })
      ]
    }
  }
});
```

```ts file="src/worker.ts" group="orders" no-check="ExecutionContext and ExportedHandler come from @cloudflare/workers-types, which clash with the DOM types the other examples use"
import { app } from "./app";

export default {
  fetch: (request: Request, env: Record<string, unknown>, ctx: ExecutionContext) =>
    app.server.handle(request, env, ctx),
  queue: (batch: MessageBatch, env: Record<string, unknown>, ctx: ExecutionContext) =>
    app.queues.consume(batch, env, ctx)
} satisfies ExportedHandler;
```

:::gotchas
- **Wire the `queue` export.** `onMessage` runs only through `consume`. The `deploy` plugin registers the consumer, your entry has to deliver.
- **A throw stops the batch.** `consume` rejects at the first failing message, and the rest of the loop does not run. Cloudflare then applies its retry policy to what was not acknowledged. Call `message.ack()` for finished work if a partial retry matters.
- **Messages run one by one.** A slow `onMessage` holds the batch.
- **`send` takes the body only.** There is no `delaySeconds` or `contentType`. Take the raw queue with `app.bindings.require` for those.
- **A name that prefixes another.** With `orders` and `orders-eu` configured, the first declared match wins for `orders-eu`. Use names where neither is a prefix of the other.
:::

## Related

- [deploy plugin](/docs/worker/plugins/deploy/): producers and consumers in the wrangler config.
- [server plugin](/docs/worker/plugins/server/): the `fetch` half of the entry.
