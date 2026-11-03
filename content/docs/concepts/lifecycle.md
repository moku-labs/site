---
title: Lifecycle
description: "init, start, stop. Order, async model, failures."
section: Concepts
order: 3
---

## Three phases

| Phase | Method | Direction | When | Context |
| --- | --- | --- | --- | --- |
| init | `onInit` | forward | inside `createApp()`, synchronous | full `ctx` |
| start | `onStart` | forward | `await app.start()` | full `ctx` |
| stop | `onStop` | **reverse** | `await app.stop()` | own `global`, `config`, `state` |

Before the lifecycle, each plugin's factories run in this order:

:::flow
1. `createState`
2. `hooks`
3. `api`
4. `onInit`
5. `onStart`
6. `onStop`
:::

## Async model

One plugin at a time, fully awaited. There is no parallelism inside or across phases: plugin A
resolves before plugin B begins. `createApp()` is synchronous; `start()` and `stop()` return
promises.

```ts file="src/server.ts" check
import { createApp, createPlugin } from "@moku-labs/web";

const timerPlugin = createPlugin("timer", {
  createState: (): { handle?: ReturnType<typeof setInterval> } => ({}),
  onStart: ctx => {
    ctx.state.handle = setInterval(() => ctx.log.info("timer:tick"), 1000); // [!note] Open a resource when the app starts.
  },
  onStop: ctx => {
    clearInterval(ctx.state.handle); // [!note] onStop gets its own state back, nothing else.
  }
});

const app = createApp({
  plugins: [timerPlugin],
  pluginConfigs: { site: { name: "Demo", url: "https://example.com" } }
});

await app.start(); // onStart, forward, one plugin at a time
await app.stop(); // onStop, reverse: infrastructure outlives the plugins that use it
```

`onStart` and `onStop` are optional. Add them only when a plugin opens something it must close: a
socket, a listener, a timer.

## Failures

Lifecycle is not transactional. Errors propagate to the caller. The kernel does not roll back,
retry or compensate. After a failure, discard the app and create a new one.

`start()` throws when called twice, and `stop()` throws when `start()` never ran. The exact
messages are on [What the kernel checks](/docs/concepts/kernel-checks/).

## Core plugins

Core plugins have their own timeline: they init and start before regular plugins, and stop after
them. The `onStop` context has no core APIs, so a plugin that logs during teardown keeps `ctx.log`
in its state from `onStart`. That reference still works, because the logger stops last.

## In @moku-labs/web

Most web plugins only use `onInit`: `router` compiles its table, `site` and `i18n` validate their
config. `spa` is the one default with `onStart` and `onStop`, because it owns browser listeners.
