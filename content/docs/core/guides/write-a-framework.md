---
title: Write a framework
description: "A framework people install: config, core plugins, default plugins, exports, error handling and tests."
section: Guides
order: 10
---

## What you ship

A framework is a package with one job: give its users `createApp` and `createPlugin`, with the right
plugins already in. This guide builds a small one, `notifier`, that queues and sends messages. Each
file below is real and compiled on every test run of this site.

```text file="the package"
notifier/
  src/
    config.ts           createCoreConfig: the contract and the core plugins
    plugins/
      transport.ts      a plugin that talks to the outside
      outbox.ts         a plugin with state, events and a dependency
    index.ts            createCore: the defaults and the public exports
  tests/
    outbox.test.ts      one app per test
```

:::steps[The build order]
1. Write the contract: global config, global events, core plugins.
2. Write one plugin per concern.
3. Fix the defaults and handle hook errors.
4. Export the surface.
5. Test through a real app.
:::

## 1. The contract

The contract is everything a plugin can rely on. Keep the global config small: a value one plugin
owns belongs in that plugin's `config`. Global events are for names several plugins share.

```ts file="src/config.ts" group="framework" check
import { envPlugin, logPlugin, processEnv } from "@moku-labs/common";
import { createCoreConfig } from "@moku-labs/core";

export type Config = { stage: "production" | "development" | "test" };
export type Events = { "message:sent": { id: string; to: string } };

export const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin, typeof envPlugin]>("notifier", {
  config: { stage: "production" },
  plugins: [logPlugin, envPlugin], // [!note] `ctx.log` and `ctx.env` on every plugin. The tuple in the generics makes them typed.
  pluginConfigs: {
    env: { providers: [processEnv()] } // [!note] A sensible default. An app can replace it through `pluginConfigs.env`.
  }
});

export const { createPlugin, createCore } = coreConfig;
```

You do not have to write `log` and `env` yourself: [`@moku-labs/common`](/docs/common/) has them.
For your own infrastructure, use [`createCorePlugin`](/docs/core/api/).

## 2. The plugins

A plugin's name is its key on `app`, so pick the word your users should type. `helpers` run before
`createApp`, so they suit values that end up in config.

```ts file="src/plugins/transport.ts" group="framework" check
import { createPlugin } from "../config";

export type Message = { id: string; to: string; body: string };

export const transportPlugin = createPlugin("transport", {
  config: { endpoint: "https://mail.example.com/send", tokenVariable: "MAIL_TOKEN" },
  helpers: {
    message: (to: string, body: string): Message => ({ id: crypto.randomUUID(), to, body }) // [!note] `transportPlugin.message(...)`, with no app.
  },
  api: ctx => ({
    send: async (message: Message) => {
      const response = await fetch(ctx.config.endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${ctx.env.require(ctx.config.tokenVariable)}` },
        body: JSON.stringify(message)
      });
      if (!response.ok) throw new Error(`Send failed with ${response.status}.`);
      ctx.emit("message:sent", { id: message.id, to: message.to });
    }
  })
});
```

`outbox` depends on `transport`. It owns the queue, opens a timer in `onStart` and closes it in
`onStop`, where it gets only its own state.

```ts file="src/plugins/outbox.ts" group="framework" check
import { createPlugin } from "../config";
import { type Message, transportPlugin } from "./transport";

type OutboxState = { queue: Message[]; timer?: ReturnType<typeof setInterval> };

export const outboxPlugin = createPlugin("outbox", {
  depends: [transportPlugin],
  config: { flushEveryMs: 1000 },
  events: register => ({
    "outbox:drained": register<{ count: number }>("The queue became empty") // [!note] Own events. Visible to plugins that depend on `outbox`.
  }),
  createState: (): OutboxState => ({ queue: [] }),
  api: ctx => ({
    add: (message: Message) => {
      ctx.state.queue.push(message);
      ctx.log.debug("outbox:added", { id: message.id });
    },
    flush: async () => {
      const batch = ctx.state.queue.splice(0);
      const transport = ctx.require(transportPlugin); // [!note] Call `require` inside the method, not in the factory body.
      for (const message of batch) await transport.send(message);
      ctx.emit("outbox:drained", { count: batch.length });
    },
    size: () => ctx.state.queue.length
  }),
  hooks: ctx => ({
    "message:sent": ({ id }) => ctx.log.info("outbox:sent", { id })
  }),
  onStart: ctx => {
    const { flush } = ctx.require(outboxPlugin);
    ctx.state.timer = setInterval(() => void flush(), ctx.config.flushEveryMs);
  },
  onStop: ctx => {
    clearInterval(ctx.state.timer);
  }
});
```

## 3. The defaults

`createCore` fixes the plugin list. Dependencies go first: the kernel checks the order and never
sorts. `onError` is not optional in practice: without one, a failing hook handler vanishes.

```ts file="src/index.ts" group="framework" check
import { coreConfig, createCore } from "./config";
import { outboxPlugin } from "./plugins/outbox";
import { transportPlugin } from "./plugins/transport";

export const { createApp, createPlugin } = createCore(coreConfig, {
  plugins: [transportPlugin, outboxPlugin],
  pluginConfigs: {
    outbox: { flushEveryMs: 5000 } // [!note] Overrides the spec. An app's `pluginConfigs` overrides this.
  },
  onError: (error, core) => core.log.error("hook:failed", undefined, error) // [!note] Only core plugin APIs here. They are ready before any hook can fire.
});

export { outboxPlugin, transportPlugin };
export type { Message } from "./plugins/transport";
```

## 4. The exports

Users import from the package root, nothing deeper.

| Export | Why |
|---|---|
| `createApp` | The one call an app makes. |
| `createPlugin` | So an app can add its own plugins, typed against your config and events. |
| The plugins | So another plugin can write `depends: [outboxPlugin]` and `ctx.require(outboxPlugin)`. |
| The types of your API | So a user can name them. |

Declare the core as a peer dependency, along with `@moku-labs/common` if you use it. A second copy
in `node_modules` makes the types disagree.

```json file="package.json"
{
  "name": "notifier",
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" } },
  "peerDependencies": {
    "@moku-labs/common": "*",
    "@moku-labs/core": "*"
  }
}
```

If part of your framework runs in the browser, add a second entry with its own `createCore` and only
browser-safe plugins. `@moku-labs/web` and `@moku-labs/web/browser` are built this way.

## 5. Test through a real app

Create a new app per test: an app holds state and starts once. `log` in `test` mode prints nothing
and still records, so `expect()` can read what happened.

```ts file="tests/outbox.test.ts" group="framework" check
import { expect, it, vi } from "vitest";
import { createApp, transportPlugin } from "../src";

it("sends the queue and reports the batch", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));

  const app = createApp({
    config: { stage: "test" },
    pluginConfigs: {
      log: { mode: "test" },
      env: { providers: [{ name: "fixture", load: () => ({ MAIL_TOKEN: "t" }) }] } // [!note] A provider is two fields, so a fixture is one line.
    }
  });

  app.outbox.add(transportPlugin.message("ada@example.com", "Hi"));
  await app.outbox.flush();
  expect(app.outbox.size()).toBe(0);

  await vi.waitFor(() => app.log.expect().toHaveEvent("outbox:sent")); // [!note] `emit` does not wait for handlers, so wait for the trace.
});
```

:::gotchas
- **A wrong order is an error, not a sort.** List dependencies first. The kernel reports it with both plugin names.
- **Core plugins go in `createCoreConfig`.** `createCore({ plugins })` takes only plugins from `createPlugin`.
- **`createCore({ pluginConfigs })` is not typed by plugin.** A typo there is silently ignored. `createCoreConfig` and `createApp` check theirs.
- **Keep names off the reserved list.** `start`, `stop`, `emit`, `require`, `has`, `config`, `global` and `state` fail in `createApp`, because they collide with the app's own members.
- **Global events are for every plugin.** A plugin's own event belongs in its `events`, so it shows up only where `depends` says.
:::

## Related

- [Three layers](/docs/concepts/three-layers/): what a framework may and may not do.
- [Plugins](/docs/concepts/plugins/): every spec field.
- [Lifecycle](/docs/concepts/lifecycle/): the order of `onInit`, `onStart`, `onStop`.
- [@moku-labs/common](/docs/common/): the `log` and `env` core plugins.
