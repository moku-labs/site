---
title: How it works
description: "What createApp does in order, how config merges, what require returns, and how events dispatch."
section: Get started
order: 3
---

## Inside createApp

The kernel is one synchronous pass. When `createApp` returns, every plugin is initialized.

:::steps
1. **Check the list.** Names and dependencies, before any plugin code runs. See [What the kernel checks](/docs/concepts/kernel-checks/).
2. **Freeze the global config.** Defaults, then the app's overrides.
3. **Build the core plugins.** For all of them `config`, then `createState`, then `api`, then `onInit`. Their APIs exist from here on.
4. **Resolve plugin configs.** One frozen object per plugin.
5. **Create state.** `createState` in list order, with `{ global, config }`.
6. **Register hooks.** The `hooks` factories run in list order. Handlers are stored, nothing fires yet.
7. **Build APIs.** The `api` factories in list order.
8. **Initialize.** `onInit` in list order, with the full `ctx`.
9. **Call `onReady`.** The framework's, then the app's.
10. **Return the frozen app.** Plugin APIs are mounted by name.
:::

`start()` and `stop()` add the rest:

```text file="the order of a run"
createApp()   core onInit → plugin onInit → framework onReady → app onReady
app.start()   core onStart → plugin onStart → app onStart
app.stop()    plugin onStop, reversed → core onStop, reversed → app onStop
```

The rules for each phase, the async model and failures are on [Lifecycle](/docs/concepts/lifecycle/).

## How config merges

Every merge is shallow, and the last one wins.

| Value | Merge order |
|---|---|
| Global config | `createCoreConfig({ config })` → `createApp({ config })` |
| Plugin config | spec `config` → `createCore({ pluginConfigs })` → `createApp({ pluginConfigs })` |
| Core plugin config | spec `config` → `createCoreConfig({ pluginConfigs })` → `createCore({ pluginConfigs })` → `createApp({ pluginConfigs })` |

```ts file="merge.ts" check
import { createCoreConfig } from "@moku-labs/core";

const coreConfig = createCoreConfig("demo", { config: {} });

const cachePlugin = coreConfig.createPlugin("cache", {
  config: { ttl: 60, size: 100, limits: { read: 1, write: 2 } },
  api: ctx => ({ config: () => ctx.config })
});

const { createApp } = coreConfig.createCore(coreConfig, {
  plugins: [cachePlugin],
  pluginConfigs: { cache: { ttl: 300, size: 500 } } // [!note] The framework's defaults for this plugin.
});

const app = createApp({
  pluginConfigs: { cache: { size: 900, limits: { read: 5, write: 5 } } } // [!note] A nested object is replaced whole: pass every field of it.
});

console.log(app.cache.config()); // { ttl: 300, size: 900, limits: { read: 5, write: 5 } }
```

The freeze is shallow too: `limits` above stays mutable. State is the only store a plugin is meant
to change.

## What require returns

`ctx.require(plugin)` reads the API map as it is at that moment. Inside a handler or a lifecycle
method every API exists. A factory body runs earlier, while the map is still being filled.

| `ctx.require(x)` called in | `x` is earlier in the list | `x` is later in the list |
|---|---|---|
| The body of a `hooks` factory | `{}` | `{}` |
| The body of an `api` factory | its API | `{}` |
| A hook handler, an API method, `onInit`, `onStart` | its API | its API |

A core plugin's API is always there. A plugin registered with no `api` gives `{}`. A plugin that
is not registered throws.

```ts file="require.ts" check
import { createCoreConfig } from "@moku-labs/core";

const coreConfig = createCoreConfig("demo", { config: {} });

const clockPlugin = coreConfig.createPlugin("clock", {
  api: () => ({ now: () => Date.now() })
});

coreConfig.createPlugin("stamp", {
  depends: [clockPlugin],
  events: register => ({ "stamp:touch": register<{ by: string }>() }),
  createState: () => ({ lastAt: 0 }),
  hooks: ctx => ({
    "stamp:touch": () => {
      ctx.state.lastAt = ctx.require(clockPlugin).now(); // [!note] Inside the handler: the API is there.
    }
  })
});
```

:::callout{tone="warn"}
The empty object is not an error. `const clock = ctx.require(clockPlugin)` at the top of a `hooks`
factory compiles and then fails at the first method call. Call `require` where you use it.
:::

## How an event dispatches

`emit` starts the dispatch and returns. It gives the caller no promise and no result.

:::flow
1. The kernel finds the handlers of that event name. No handlers: nothing happens.
2. It calls them in plugin order and awaits each one before the next.
3. A handler that throws or rejects goes to the error handlers. The next handler still runs.
:::

| Error handler | Called with | Order |
|---|---|---|
| `createCore({ onError })` | the error, the core plugin APIs | first |
| `createApp({ onError })` | the error, the app callback context | second |

With neither of them the error is dropped silently, so a framework should always set one. An
error thrown inside `onError` is ignored too. Errors from `start()` and `stop()` never come here:
they reject the call.

Who can emit and hear what is on [Events](/docs/concepts/events/).

## What exists only in the types

The run-time is small because most of the contract never runs.

| Part | At compile time | At run time |
|---|---|---|
| `events` | Adds the event names and payloads | Checked to be a function, never called |
| `depends` | Adds the dependency's events to `hooks` | The order check in `createApp` |
| `_phantom` on an instance | Carries config, state, API and events types | An empty object |
| First argument of `createCore` | Carries the `createPlugin` types | Ignored |

So the description in `register<T>("...")` is for readers. Nothing can list events at run time.

:::gotchas
- **The app is frozen, plugin APIs are not.** `Object.freeze` covers the app object only. An API method can still change state through its closure, which is the point.
- **A plugin with no `api` is not on `app`.** `app.has("name")` is still `true`.
- **`stop()` is not guarded against a second call.** It runs every `onStop` again. It throws only when `start()` never finished.
- **A failed `start()` leaves the app half-started.** Plugins already started stay started. Discard the app and create a new one.
:::

## Related

- [Three layers](/docs/concepts/three-layers/): the factory chain and who writes what.
- [Plugins](/docs/concepts/plugins/): every spec field and the context tiers.
- [Write a framework](/docs/core/guides/write-a-framework/): all of this in one project.
