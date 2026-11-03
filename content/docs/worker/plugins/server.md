---
title: server
description: "Default. HTTP routing, guards and cron dispatch over one table of endpoints declared as data."
section: Plugins
order: 21
---

## What it does

**Default.** `server` turns a list of endpoints into a matcher. `app.server.handle` answers one HTTP
request. `app.server.scheduled` runs one cron trigger. The Worker default export is yours: you call
these two from it.

## How it works

`endpoint(path).get(handler)` is a pure builder, safe before `createApp`. `onInit` checks the table.
A path with a repeated param, or with the old `{name?}` form, makes `createApp` throw.

Paths split on `/` and empty segments drop, so `/users/` matches `/users`. A request takes the first
match in this order:

:::steps
1. **Specificity.** A literal segment scores 2, `{name}` scores 1, `{name:?}` scores 0. The highest sum wins.
2. **Method.** On equal scores, a specific verb beats `.all`.
3. **Declaration order.** A tie after that keeps the order of `endpoints`.
:::

Each match gets a fresh context:

| Field | Type | Description |
|---|---|---|
| `request` | `Request` | The request. For cron, a synthetic one for `https://cron/<cron>`. |
| `env` | `WorkerEnv` | The bindings of this invocation. |
| `exec` | `ExecutionContext` | `waitUntil` and `passThroughOnException`. |
| `params` | typed from the path | `{id}` is `string`, `{lang:?}` is `string \| undefined`. |
| `url` | `URL` | The parsed URL. |
| `require` | `(plugin) => api` | Another plugin's API. |
| `has` | `(name) => boolean` | Whether a plugin is composed. |

No match returns `404` with the body `Not Found`. A handler that throws is not caught: the error
reaches your default export.

## Guards

`endpoint.new(guard)` returns a new factory that runs `guard` before each handler it builds. Chain
`.new` to stack guards. The receiver never changes, so factories branch safely.

| The guard returns | Effect |
|---|---|
| a `Response` | Sends it. Later guards and the handler do not run. |
| an object | Merges it into the context of later guards and the handler, with its type. |
| nothing | Continues. |

## Cron

`scheduled` looks up `controller.cron` as a path with the method `ALL`. So a cron handler is
`endpoint("0 * * * *").all(handler)`, and only `.all` can match. Its return value is dropped. No
match resolves without running anything. The trigger itself goes in the wrangler config:
`deploy: { wrangler: { triggers: { crons: ["0 * * * *"] } } }`.

## Config

`pluginConfigs.server`.

| Option | Type | Default | Description |
|---|---|---|---|
| `endpoints` | `Endpoint[]` | `[]` | The table, built with `endpoint`. |

## API

Mounted at `app.server`.

| Method | Signature | Description |
|---|---|---|
| `handle` | `(request: Request, env: WorkerEnv, exec: ExecutionContext) => Promise<Response>` | Routes one request. |
| `scheduled` | `(controller: ScheduledController, env: WorkerEnv, exec: ExecutionContext) => Promise<void>` | Runs one cron trigger and waits for it. |

The builder, from the package root and as `serverPlugin.endpoint`:

| Method | Description |
|---|---|
| `endpoint(path)` | A verb builder: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `all`. Each returns an `Endpoint`. |
| `endpoint.new(guard)` | A new factory with `guard` in front. |

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `request:start` | `{ method: string; path: string; requestId: string }` | First thing in `handle`. Also on a 404. |
| `server:matched` | `{ path: string; method: string }` | After a match, before guards and the handler. |
| `request:end` | `{ method: string; path: string; status: number; ms: number }` | After a matched handler returns. Includes a guard's short-circuit. |

### Listens to

None.

## Depends on

- [bindings](/docs/worker/plugins/bindings/): ordering only. Handlers call it through `require`.

## Example

```ts file="src/app.ts" group="api" check
import { createApp, endpoint, kvPlugin } from "@moku-labs/worker";

const authed = endpoint.new(async ({ request }) => {
  const actor = request.headers.get("x-user");
  if (actor === null) return new Response("Unauthorized", { status: 401 }); // [!note] Gate.
  return { actor }; // [!note] Enrich. The handler reads `ctx.actor` as a `string`.
});

export const app = createApp({
  plugins: [kvPlugin],
  config: { name: "my-api", compatibilityDate: "2026-06-17" },
  pluginConfigs: {
    kv: { notes: { name: "my-notes", binding: "NOTES" } },
    server: {
      endpoints: [
        endpoint("/health").get(() => new Response("ok")),
        endpoint("/api/data/{lang:?}").get(({ params }) => Response.json({ lang: params.lang ?? "en" })),
        authed("/notes/{id}").put(async ({ actor, params, request, env, require }) => {
          await require(kvPlugin).put(env, `${actor}:${params.id}`, await request.text());
          return new Response(null, { status: 204 });
        }),
        endpoint("0 * * * *").all(async ({ env, require }) => {
          await require(kvPlugin).put(env, "last-run", new Date().toISOString());
          return new Response("done"); // [!note] The type asks for a Response. `scheduled` ignores it.
        })
      ]
    }
  }
});
```

```ts file="src/worker.ts" group="api" no-check="ExecutionContext and ExportedHandler come from @cloudflare/workers-types, which clash with the DOM types the other examples use"
import { app } from "./app";

export default {
  fetch: (request: Request, env: Record<string, unknown>, ctx: ExecutionContext) =>
    app.server.handle(request, env, ctx),
  scheduled: (controller: ScheduledController, env: Record<string, unknown>, ctx: ExecutionContext) =>
    app.server.scheduled(controller, env, ctx)
} satisfies ExportedHandler;
```

:::gotchas
- **A 404 emits `request:start` and no `request:end`.** A handler that throws emits no `request:end` either. Do not pair the two events to count requests.
- **No automatic `HEAD`.** A `HEAD` request to a `.get` endpoint is a 404. Add `.head` or use `.all`.
- **Method compare is exact.** No method fallback and no `405`: a wrong verb is a 404.
- **`scheduled` emits nothing.** No `request:*` and no `server:matched` for cron.
- **Catch errors in your entry.** There is no error page. Wrap `handle` if a throw should become a JSON response.
:::

## Related

- [How it works](/docs/worker/how-it-works/): the request path.
- [API reference](/docs/worker/api/): the `Server` types.
