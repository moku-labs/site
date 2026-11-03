---
title: API reference
description: "Every export of @moku-labs/worker, with signatures."
section: API reference
order: 40
---

## Entries

| Import | Format | For |
|---|---|---|
| `@moku-labs/worker` | ESM and CJS | Everything: the Worker runtime, the Node-only plugins and the types. A Worker needs the `nodejs_compat` flag, see [How it works](/docs/worker/how-it-works/#runtime-and-node). |

Signatures below are simplified for reading. The installed `dist/index.d.mts` is the source.

## createApp

```ts no-check="a simplified signature; the exports are checked against the package"
function createApp<const ExtraPlugins extends readonly AnyPluginInstance[] = readonly []>(options?: {
  plugins?: ExtraPlugins;
  config?: { name?: string; stage?: "production" | "development" | "test"; compatibilityDate?: string };
  pluginConfigs?: { [pluginName: string]: Partial<PluginConfig> };
  onReady?: (ctx: AppCallbackContext) => void;
  onError?: (error: Error, ctx: AppCallbackContext) => void;
  onStart?: (ctx: AppCallbackContext) => void | Promise<void>;
  onStop?: (ctx: AppCallbackContext) => void | Promise<void>;
}): App;
```

Creates and initializes an app. It is synchronous and the result is frozen. The plugin list is
`[log, env, bindings, server, ...plugins]`. A plugin comes after the plugins it depends on, and
listing a name twice throws.

| Option | Default | Description |
|---|---|---|
| `plugins` | `[]` | Extra plugins, merged into the app and into its type. |
| `config.name` | `"worker"` | The Worker name. |
| `config.stage` | `"production"` | The default deploy stage. |
| `config.compatibilityDate` | `""` | The Cloudflare compatibility date. |
| `pluginConfigs` | `{}` | Per-plugin overrides, keyed by plugin name. |

The returned app:

| Member | What it is |
|---|---|
| `log`, `env` | The core plugin APIs. |
| `bindings`, `server` | The default plugin APIs. |
| `<name>` | The API of every plugin in `plugins`, for example `app.kv`, `app.cli`. |
| `require(plugin)`, `has(name)` | Plugin lookup. |
| `emit(event, payload)` | Emits a typed event. |
| `start()`, `stop()` | Run `onStart` and `onStop`. A Worker never needs them. |

## createPlugin

```ts no-check="a simplified signature; the exports are checked against the package"
function createPlugin<Name extends string, Config, State, Api, Deps, Events, Hooks, Helpers>(
  name: Name,
  spec: {
    config?: Config;
    depends?: Deps;
    createState?: (ctx: { global; config }) => State;
    events?: (register) => Events;
    api?: (ctx: PluginContext) => Api;
    hooks?: (ctx: PluginContext) => Hooks;
    helpers?: Helpers;
    onInit?: (ctx: PluginContext) => void;
    onStart?: (ctx: PluginContext) => void | Promise<void>;
    onStop?: (ctx: { global; config; state }) => void | Promise<void>;
  }
): PluginInstance<Name, Config, State, Api, Events> & Helpers;
```

Writes a plugin bound to this framework's config, events and core plugins. `ctx` carries `global`,
`config`, `state`, `emit`, `require`, `has`, `log` and `env`. A plugin in `depends` makes its events
available to `hooks`. Keep the rule of the package: take `env` as an argument, and never store it.

```ts file="src/plugins/metrics.ts" check
import { createPlugin, queuesPlugin } from "@moku-labs/worker";

export const metricsPlugin = createPlugin("metrics", {
  depends: [queuesPlugin], // [!note] `queue:message` is local to `queues`, so the hook needs this.
  hooks: ctx => ({
    "queue:message": ({ queue, messageId }) => ctx.log.info(`${queue} ${messageId}`),
    "request:end": ({ path, status, ms }) => ctx.log.info(`${path} ${status} ${ms}ms`)
  })
});
```

## Plugins

| Export | `app.<name>` | Default | Page |
|---|---|---|---|
| `bindingsPlugin` | `bindings` | yes | [bindings](/docs/worker/plugins/bindings/) |
| `serverPlugin` | `server` | yes | [server](/docs/worker/plugins/server/) |
| `kvPlugin` | `kv` | no | [kv](/docs/worker/plugins/kv/) |
| `d1Plugin` | `d1` | no | [d1](/docs/worker/plugins/d1/) |
| `storagePlugin` | `storage` | no | [storage](/docs/worker/plugins/storage/) |
| `queuesPlugin` | `queues` | no | [queues](/docs/worker/plugins/queues/) |
| `durableObjectsPlugin` | `durableObjects` | no | [durableObjects](/docs/worker/plugins/durable-objects/) |
| `turnPlugin` | `turn` | no | [turn](/docs/worker/plugins/turn/) |
| `deployPlugin` | `deploy` | no, Node only | [deploy](/docs/worker/plugins/deploy/) |
| `cliPlugin` | `cli` | no, Node only | [cli](/docs/worker/plugins/cli/) |
| `logPlugin` | `log` | core | From `@moku-labs/common`. |
| `envPlugin` | `env` | core | From `@moku-labs/common`. Reads environment variables through `process.env`. |

## Helpers

```ts no-check="a simplified signature; the exports are checked against the package"
const endpoint: GuardedEndpointFactory;

type GuardedEndpointFactory<Extension = {}> = {
  <Path extends string>(path: Path): EndpointBuilder<Path, Extension>;
  new: <R>(guard: (ctx: RequestContext & Extension) => R) => GuardedEndpointFactory<Extension & GuardExtension<Awaited<R>>>;
};

type EndpointBuilder<Path extends string, Extension> = {
  get(handler: EndpointHandler<PathParams<Path>, Extension>): Endpoint;
  // post, put, patch, delete, head, options and all have the same shape.
};

const defineDurableObject: (name: string) => DurableObjectBaseConstructor & { readonly doName: string };
```

`endpoint` builds the [server](/docs/worker/plugins/server/) table. `defineDurableObject` returns the
base class of a [Durable Object](/docs/worker/plugins/durable-objects/). Both are pure, and safe to
call before `createApp`.

## Plugin APIs on app

| Plugin | Methods |
|---|---|
| `bindings` | `require`, `has` |
| `server` | `handle`, `scheduled` |
| `kv` | `get`, `put`, `delete`, `list`, `use`, `deployManifest` |
| `d1` | `query`, `first`, `run`, `batch`, `prepare`, `use`, `deployManifest` |
| `storage` | `get`, `put`, `delete`, `list`, `use`, `deployManifest` |
| `queues` | `send`, `sendBatch`, `consume`, `use`, `deployManifest` |
| `durableObjects` | `get`, `deployManifest` |
| `turn` | `deployManifest` |
| `deploy` | `run`, `destroy`, `dev`, `seed`, `init`, `checkInfra`, `provisionInfra`, `verifyAuth`, `requiredToken`, `ciToken`, `tokenInstructions`, `wrangler` |
| `cli` | `dev`, `deploy`, `seed`, `auth`, `doctor`, `whoami`, `wrangler` |

## Types

All type-only exports. Cloudflare types such as `KVNamespace` and `D1Database` are ambient, from
`@cloudflare/workers-types`.

| Type | What it is |
|---|---|
| `WorkerConfig` | `{ stage; name; compatibilityDate }`. |
| `WorkerEnv` | `Record<string, unknown>`, the per-invocation bindings. |
| `WorkerEvents` | The global event map. |
| `WorkerPluginCtx<Config, State, Events>` | A plugin context with `WorkerEvents` merged in. Use it to type a plugin's helper functions. |
| `PluginCtx` | The raw context from `@moku-labs/core`, re-exported. |
| `EndpointGuard<Extension>` | A guard: returns a `Response`, an extension object, or nothing. |
| `GuardedEndpointFactory<Extension>` | The type of `endpoint` and of each `.new()`. |
| `DeployReport` | What `deploy.run` and `cli.deploy` resolve to. |
| `ExternalManifest` | `{ name; compatibilityDate; resources }`, for `run({ manifest })`. |
| `ResourceManifest` | One resource: a union on `kind` (`r2`, `kv`, `d1`, `queue`, `do`, `turn`). |
| `SeedConfig` | `{ file; binding?; resetKv? }`. |

Six namespaces hold each plugin's own types:

| Namespace | Members |
|---|---|
| `Bindings` | `Config`, `BindingsApi`, `Context` |
| `Server` | `Endpoint`, `EndpointHandler`, `EndpointGuard`, `RequestContext`, `PathParams`, `Method`, `RequireFn`, `ServerConfig`, `ServerEvents`, `Api` and the matcher types |
| `D1` | `Config`, `D1Instance`, `D1DatabaseApi`, `Api`, `D1Ctx` |
| `Storage` | `StorageConfig`, `R2Instance`, `StorageBucketApi`, `StorageApi`, `StorageProvider`, `StorageCtx` |
| `Queues` | `Config`, `QueueInstance`, `QueueProducerApi`, `QueueEvents`, `Api`, `Ctx` |
| `DurableObjects` | `Config`, `DoInstance`, `Api`, `Ctx` |

```ts file="src/types.ts" check
import type { D1, DeployReport, Server, WorkerEnv } from "@moku-labs/worker";

export type Context = Server.RequestContext<{ id: string }>;
export type Database = D1.D1Instance;
export type Report = Pick<DeployReport, "status" | "url">;
export const readId = (ctx: Context, env: WorkerEnv) => [ctx.params.id, Object.keys(env).length] as const;
```

## Related

- [How it works](/docs/worker/how-it-works/): the model behind the API.
- [Quick start](/docs/worker/quick-start/): the exports in use.
