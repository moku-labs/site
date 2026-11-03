---
title: Plugins
description: "Every PluginSpec field, context tiers, core plugins."
section: Concepts
order: 2
---

## PluginSpec

Every field is optional. A plugin with only `api` works; a plugin with only `hooks` works.

```ts no-check="the shape of a plugin spec, not runnable code"
createPlugin("name", {
  config:      { /* defaults, type C */ },
  events:      register => ({ "name:event": register<Payload>("description") }),
  depends:     [otherPlugin],
  createState: ctx => ({ /* mutable state, type S */ }),
  api:         ctx => ({ /* public methods, mounted on app.name */ }),
  hooks:       ctx => ({ "event:name": payload => { /* handler */ } }),
  onInit:      ctx => { /* all plugins exist; sync only */ },
  onStart:     async ctx => { /* app is running */ },
  onStop:      async ctx => { /* teardown, reverse order */ },
  helpers:     { /* static pure functions, no ctx */ }
});
```

| Field | Rule |
| --- | --- |
| `config` | Defaults. Shallow-merged with framework and app overrides, then frozen. |
| `events` | Declared with the register callback. Compile-time only. |
| `depends` | Plugins that must appear earlier in the list. Validation and typing only, no sorting. |
| `createState` | Called once with `{ global, config }`. Returns the only mutable store. |
| `api` | Synchronous, no side effects. Mounted at `app.<name>`. |
| `hooks` | Event handlers with the full `ctx`. Payloads are typed from the merged event map. |
| `onInit`, `onStart`, `onStop` | Lifecycle. See [Lifecycle](/docs/concepts/lifecycle/). |
| `helpers` | Pure functions on the instance, usable before `createApp`. |

Types are inferred from the spec. `createPlugin` never takes explicit generics.

## A plugin with state and a dependency

```ts file="src/plugins/counter.ts" check
import { createApp, createPlugin } from "@moku-labs/web";

const clockPlugin = createPlugin("clock", {
  api: () => ({ now: () => Date.now() })
});

const counterPlugin = createPlugin("counter", {
  depends: [clockPlugin], // [!note] Must come earlier in the plugins list.
  config: { step: 1 },
  createState: () => ({ count: 0, lastAt: 0 }),
  api: ctx => ({
    increment: () => {
      ctx.state.count += ctx.config.step;
      ctx.state.lastAt = ctx.require(clockPlugin).now(); // [!note] require takes the instance, not a string.
    },
    value: () => ctx.state.count // [!note] A closure over state, never the state object itself.
  })
});

const app = createApp({
  plugins: [clockPlugin, counterPlugin],
  pluginConfigs: { site: { name: "Demo", url: "https://example.com" }, counter: { step: 2 } }
});

app.counter.increment();
console.log(app.counter.value()); // 2
```

## Context tiers

The kernel hands each factory a context sized to its phase.

| Phase | `ctx` has |
| --- | --- |
| `createState` | `{ global, config }` |
| `api`, `hooks`, `onInit`, `onStart` | `{ global, config, state, emit, require, has }` plus core APIs such as `ctx.log` |
| `onStop` | `{ global, config, state }`: own data only, peers may already be stopped |

The types enforce these restrictions. Calling `ctx.emit` in `createState` is a compile error.

## Talking to other plugins

`ctx.require(plugin)` takes an instance and returns its typed API, or throws. `ctx.has(name)` is a
string check that never throws. Use `require` for request and response: events do not return
values.

## Core plugins

Infrastructure such as `log` and `env`. Their context is `{ config, state }` only. They cannot have
`depends`, `events` or `hooks`, and their APIs land flat on every regular plugin's `ctx` and on
`app`. They init and start first, and stop last. In `@moku-labs/web` they are `log` and `env`, so
every plugin can call `ctx.log.info(...)`.

## Anti-patterns

:::gotchas
- **Leaking state.** Return `value: () => ctx.state.count`, never `{ state: ctx.state }`.
- **God plugins.** One plugin per domain concern. Keep `index.ts` near 30 lines; logic goes in
  `api.ts` and its siblings.
- **Inventing primitives.** No `class XService`, no `app.registerService()`. Write a plugin.
:::
