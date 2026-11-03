---
title: durableObjects
description: "Resolves Durable Object stubs off env and gives you a base class for your own exported class."
section: Plugins
kind: optional
order: 26
---

## What it does

`durableObjects` does two things. `get` returns a stub for one object, addressed by a stable name.
`defineDurableObject` returns a base class. The exported class is always yours, because a plugin
cannot produce a top-level export.

## How it works

`get(env, key, id)` finds the instance by `key`, resolves its binding from `env`, calls
`idFromName(id)` and returns the stub. It is synchronous. The same `id` always reaches the same object.

The base class stores what Cloudflare passes to the constructor as `this.ctx` and `this.env`, and the
name as the static `doName`. It adds nothing else: `fetch`, `alarm` and the rest are yours.

Durable Objects are not provisioned. `wrangler deploy` creates them from the binding and a migration.
`deploy` generates both, from `binding` and `className`.

## Config

`pluginConfigs.durableObjects`, keyed by your logical name. The default is `{}`.

| Option | Type | Default | Description |
|---|---|---|---|
| `[key].binding` | `string` | required | The key on `env`. |
| `[key].className` | `string` | required | The class your Worker exports. Written as wrangler `class_name`. |
| `[key].default` | `boolean` | none | Accepted for a uniform shape. `get` always names the instance, so nothing reads it. |

## API

Mounted at `app.durableObjects`, reachable with `require(durableObjectsPlugin)` in a handler.

| Method | Signature | Description |
|---|---|---|
| `get` | `(env, logicalName: string, idName: string) => DurableObjectStub` | The stub. Throws on an unknown key or a missing binding. |
| `deployManifest` | `() => { kind: "do"; binding: string; className: string }[]` | Build-time metadata. Takes no `env`. |

The helper, from the package root and as `durableObjectsPlugin.defineDurableObject`:

| Helper | Signature | Description |
|---|---|---|
| `defineDurableObject` | `(name: string) => DurableObjectBaseConstructor & { readonly doName: string }` | A base class to extend. Pure, safe before `createApp`. |

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [bindings](/docs/worker/plugins/bindings/): resolves the namespace.

## Example

```ts file="src/counter.ts" group="counter" check
import { defineDurableObject } from "@moku-labs/worker";

export class Counter extends defineDurableObject("Counter") {
  async fetch(): Promise<Response> {
    const count = ((await this.ctx.storage.get<number>("count")) ?? 0) + 1;
    await this.ctx.storage.put("count", count);
    return Response.json({ count });
  }
}
```

```ts file="src/app.ts" group="counter" check
import { createApp, durableObjectsPlugin, endpoint } from "@moku-labs/worker";

export const app = createApp({
  plugins: [durableObjectsPlugin],
  pluginConfigs: {
    durableObjects: { counter: { binding: "COUNTER", className: "Counter" } },
    server: {
      endpoints: [
        endpoint("/count/{room}").post(({ params, env, require }) =>
          require(durableObjectsPlugin).get(env, "counter", params.room).fetch("https://do/") // [!note] The object answers. The URL is yours to define.
        )
      ]
    }
  }
});
```

```ts file="src/worker.ts" group="counter" no-check="ExecutionContext and ExportedHandler come from @cloudflare/workers-types, which clash with the DOM types the other examples use"
import { app } from "./app";

export { Counter } from "./counter"; // [!note] Cloudflare finds the class on the entry module, by this name.

export default {
  fetch: (request: Request, env: Record<string, unknown>, ctx: ExecutionContext) =>
    app.server.handle(request, env, ctx)
} satisfies ExportedHandler;
```

:::gotchas
- **`className` is the export name.** It must match the identifier your entry exports. The string in `defineDurableObject("Counter")` is only the diagnostic `doName`.
- **A second class needs a migration by hand.** `deploy` writes one `v1` migration, and only when the config has no `migrations` key yet. A class added later is not registered. Add a new tag yourself in `wrangler.jsonc`.
- **The object has no `app`.** It runs in its own isolate. Use `this.env` directly. Nothing there reaches the Moku event bus.
- **The plan shows it as "ships with worker".** The deploy plan never checks the account for it. So it cannot notice a namespace deleted by hand.
:::

## Related

- [deploy plugin](/docs/worker/plugins/deploy/): the generated binding and migration.
- [How it works](/docs/worker/how-it-works/): where a Durable Object runs.
