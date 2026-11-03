---
title: API reference
description: "Every export of @moku-labs/core, with signatures, options and the exported types."
section: API reference
order: 40
---

## Entries

| Import | Format | For |
|---|---|---|
| `@moku-labs/core` | ESM and CJS | A framework. Two run-time exports and the types below. |

Signatures below are simplified for reading. The installed `dist/index.d.mts` is the source.

## createCoreConfig

```ts no-check="a simplified signature; the exports are checked against the package"
function createCoreConfig<Config, Events = {}, const CorePlugins extends readonly AnyCorePluginInstance[] = readonly []>(
  id: string,
  options: {
    config: Config;
    plugins?: [...CorePlugins];
    pluginConfigs?: { [corePluginName: string]: Partial<CorePluginConfig> };
  }
): CoreConfigResult<Config, Events, CorePlugins>;
```

Step 1 of the chain. Captures the framework's types and returns `{ createPlugin, createCore }`.
Checks the names of the core plugins.

| Argument | Description |
|---|---|
| `id` | The framework name. It starts every kernel error, in brackets. |
| `options.config` | Global config defaults. Required, `{}` is fine. Every plugin reads it as `ctx.global`. |
| `options.plugins` | Core plugins from `createCorePlugin`. Order is their init order. |
| `options.pluginConfigs` | Overrides for the core plugins, keyed by name. |

Pass the type parameters together or not at all. A framework with core plugins passes the tuple
as the third one: `createCoreConfig<Config, Events, [typeof logPlugin]>`.

## createPlugin

```ts no-check="a simplified signature; the bound function comes from createCoreConfig and createCore"
createPlugin<Name, Config, State, Api, Deps, Events, Hooks, Helpers>(
  name: Name,
  spec: {
    config?: Config;
    depends?: Deps;
    events?: (register: RegisterFunction) => Events;
    createState?: (ctx: { global; config }) => State;
    api?: (ctx: PluginContext) => Api;
    hooks?: (ctx: PluginContext) => Hooks;
    helpers?: Helpers;
    onInit?: (ctx: PluginContext) => void;
    onStart?: (ctx: PluginContext) => void | Promise<void>;
    onStop?: (ctx: { global; config; state }) => void | Promise<void>;
  }
): PluginInstance<Name, Config, State, Api, Events> & Helpers;
```

Returned by `createCoreConfig` and again by `createCore`, bound to the framework's types. Never
pass the type parameters: they are inferred from the spec. It checks the spec's shape and throws
on a wrong field. Every field is on [Plugins](/docs/concepts/plugins/).

`PluginContext` is `{ global, config, state, emit, require, has }` plus one property per core
plugin.

| Member | Signature | Description |
|---|---|---|
| `emit` | `(name, payload) => void` | Starts a typed event. Returns before the handlers finish. |
| `require` | `(plugin) => Api` | A plugin's API, by instance. Throws when it is not registered. See [What require returns](/docs/core/how-it-works/). |
| `has` | `(name: string) => boolean` | Whether a plugin of that name is registered. |

`helpers` are spread onto the returned instance, so they work before `createApp`. A helper cannot
be called `name`, `spec` or `_phantom`.

## createCore

```ts no-check="a simplified signature; the bound function comes from createCoreConfig"
createCore<const Plugins extends readonly AnyPluginInstance[]>(
  coreConfig: { createPlugin },
  options: {
    plugins: Plugins;
    pluginConfigs?: { [pluginName: string]: unknown };
    onReady?: (ctx: { config }) => void;
    onError?: (error: Error, core: CoreApis) => void;
  }
): { createApp; createPlugin };
```

Step 2. Fixes the default plugins.

| Option | Description |
|---|---|
| `plugins` | The defaults, in order. Required, `[]` is fine. An app cannot remove or reorder them. |
| `pluginConfigs` | Framework overrides for regular and core plugins. Not typed by plugin at this step. |
| `onReady` | Runs after every `onInit`, before the app's `onReady`. |
| `onError` | Receives hook dispatch failures, with the core plugin APIs. |

## createApp

```ts no-check="a simplified signature; the bound function comes from createCore"
createApp<const ExtraPlugins extends readonly AnyPluginInstance[] = readonly []>(options?: {
  plugins?: ExtraPlugins;
  config?: Partial<Config>;
  pluginConfigs?: { [pluginName: string]: Partial<PluginConfig> };
  onReady?: (ctx: AppCallbackContext) => void;
  onError?: (error: Error, ctx: AppCallbackContext) => void;
  onStart?: (ctx: AppCallbackContext) => void | Promise<void>;
  onStop?: (ctx: AppCallbackContext) => void | Promise<void>;
}): App;
```

Step 3. Checks the plugin list, runs init and returns the frozen app. It is synchronous.

| Option | Description |
|---|---|
| `plugins` | Extra plugins, after the defaults. They join the app's type. |
| `config` | Overrides for the global config, shallow. |
| `pluginConfigs` | Overrides by plugin name, for regular and core plugins, shallow. Typed from the plugin's `config`. |
| `onReady` | Runs last in `createApp`. |
| `onError` | Receives hook dispatch failures, after the framework's `onError`. |
| `onStart` | Runs after every plugin's `onStart`. |
| `onStop` | Runs after every plugin and core plugin stopped. |

`AppCallbackContext` is `{ config, emit, require, has }`, plus every plugin API and core plugin API
by name.

The returned app:

| Member | Description |
|---|---|
| `start()` | Runs `onStart` in order, core plugins first. Throws when called a second time. |
| `stop()` | Runs `onStop` in reverse order, core plugins last. Throws before `start()`. |
| `emit(name, payload)` | Starts a typed event from outside the plugins. |
| `require(plugin)` | A plugin's API by instance. Throws when it is not registered. |
| `has(name)` | Whether a plugin of that name is registered. |
| `<name>` | The API of every plugin and core plugin that has one. |

## createCorePlugin

```ts no-check="a simplified signature; the exports are checked against the package"
function createCorePlugin<const Name extends string, Config, State, Api>(
  name: Name,
  spec: {
    config?: Config;
    createState?: (ctx: { config }) => State;
    api?: (ctx: { config; state }) => Api;
    onInit?: (ctx: { config; state }) => void;
    onStart?: (ctx: { config; state }) => void | Promise<void>;
    onStop?: (ctx: { config; state }) => void | Promise<void>;
  }
): CorePluginInstance<Name, Config, State, Api>;
```

Writes an infrastructure plugin. It is a plain import, not bound to a framework, so one core plugin
works in every framework. Its API lands on every plugin's `ctx` under its name.

A core plugin cannot have `depends`, `events` or `hooks`: `createCorePlugin` throws on those fields.
Its context has no `global`, `emit`, `require` or `has`. Register it in
`createCoreConfig({ plugins })`, never in `createCore({ plugins })`.

```ts file="src/metrics.ts" check
import { createCoreConfig, createCorePlugin } from "@moku-labs/core";

const metricsPlugin = createCorePlugin("metrics", {
  config: { prefix: "app" },
  createState: () => ({ counts: new Map<string, number>() }),
  api: ctx => ({
    count: (name: string) => {
      const key = `${ctx.config.prefix}.${name}`;
      ctx.state.counts.set(key, (ctx.state.counts.get(key) ?? 0) + 1);
    },
    read: (name: string) => ctx.state.counts.get(`${ctx.config.prefix}.${name}`) ?? 0
  })
});

type Config = { stage: string };
type Events = {};

const coreConfig = createCoreConfig<Config, Events, [typeof metricsPlugin]>("demo", {
  config: { stage: "dev" },
  plugins: [metricsPlugin]
});

const jobsPlugin = coreConfig.createPlugin("jobs", {
  api: ctx => ({
    run: () => ctx.metrics.count("jobs") // [!note] On every plugin's `ctx`, fully typed.
  })
});

const { createApp } = coreConfig.createCore(coreConfig, { plugins: [jobsPlugin] });
const app = createApp({ pluginConfigs: { metrics: { prefix: "site" } } });

app.jobs.run();
console.log(app.metrics.read("jobs")); // [!note] Also on `app`. Prints 1.
```

## Types

All type-only. Most exist so a framework's own `.d.ts` can name what its `createApp` returns.

| Type | What it is |
|---|---|
| `App` | The object `createApp` returns. |
| `CreateAppOptions` | The options of `createApp`. |
| `CreateCoreOptions`, `CreateCoreResult` | The options and the result of `createCore`. |
| `CoreConfigResult` | The result of `createCoreConfig`. |
| `BoundCreateCoreFunction`, `BoundCreatePluginFunction` | The bound `createCore` and `createPlugin`. |
| `PluginInstance`, `AnyPluginInstance` | A plugin from `createPlugin`, and its widened form for lists. |
| `CorePluginInstance`, `AnyCorePluginInstance` | The same for `createCorePlugin`. |
| `CorePluginContext` | `{ config, state }`, the context of a core plugin. |
| `CoreApisFromTuple` | Maps a core plugin tuple to `{ name: Api }`. |
| `RegisterFunction` | The `register` callback of `events`, with `register.map`. |
| `PluginCtx` | `{ config, state, emit }`, for a factory in its own file. See below. |
| `EmitFn` | The `emit` type for an event map, as overloads. |

`PluginCtx<Config, State, Events>` types a plugin part that lives outside the spec. Without events,
`emit` cannot be called.

```ts file="src/plugins/cms/api.ts" group="plugin-ctx" check
import type { PluginCtx } from "@moku-labs/core";

export type CmsConfig = { draftsVisible: boolean };
export type CmsState = { published: Set<string> };
export type CmsEvents = { "cms:publish": { id: string } };

export const createCmsApi = (ctx: PluginCtx<CmsConfig, CmsState, CmsEvents>) => ({
  publish: (id: string) => {
    ctx.state.published.add(id);
    ctx.emit("cms:publish", { id });
  },
  isVisible: (id: string) => ctx.config.draftsVisible || ctx.state.published.has(id)
});
```

```ts file="src/plugins/cms/index.ts" group="plugin-ctx" check
import { createCoreConfig } from "@moku-labs/core";
import { type CmsEvents, type CmsState, createCmsApi } from "./api";

const { createPlugin } = createCoreConfig("demo", { config: {} });

export const cmsPlugin = createPlugin("cms", {
  config: { draftsVisible: false },
  events: register => register.map<CmsEvents>({ "cms:publish": "A page went live" }),
  createState: (): CmsState => ({ published: new Set() }),
  api: ctx => createCmsApi(ctx) // [!note] Wrap it in an arrow, so `events` is inferred first.
});
```
