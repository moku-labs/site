---
title: Quick start
description: "A framework with two plugins and an app on top of it, in four small files."
section: Get started
order: 2
---

## A framework in five steps

You write this page's code once per framework. An app on an existing framework, such as
`@moku-labs/web`, never imports the core.

:::steps
1. **Install.** The core has no dependencies.

   ```sh terminal title="install"
   $ mkdir my-framework && cd my-framework
   $ bun init -y
   $ bun add @moku-labs/core
   ```

2. **Name the framework and its contract.** `createCoreConfig` captures the global config and the events.
3. **Write the plugins.** Each one owns its config, state, API and event handlers.
4. **Fix the defaults.** `createCore` takes the plugin list and returns `createApp`.
5. **Write an app.** `createApp` configures the plugins and returns a typed, frozen object.
:::

## The code

```ts file="my-framework/config.ts" group="quick-start" check
import { createCoreConfig } from "@moku-labs/core";

type Config = { siteName: string };
type Events = { "router:navigate": { from: string; to: string } };

export const coreConfig = createCoreConfig<Config, Events>("my-framework", { // [!note] The id starts every kernel error.
  config: { siteName: "Untitled" }
});

export const { createPlugin, createCore } = coreConfig; // [!note] This `createPlugin` already knows `Config` and `Events`.
```

```ts file="my-framework/plugins/router.ts" group="quick-start" check
import { createPlugin } from "../config";

export const routerPlugin = createPlugin("router", {
  config: { basePath: "/" },
  createState: ctx => ({ currentPath: ctx.config.basePath }),
  api: ctx => ({
    navigate: (path: string) => {
      const from = ctx.state.currentPath;
      ctx.state.currentPath = path;
      ctx.emit("router:navigate", { from, to: path }); // [!note] A wrong name or payload does not compile.
    },
    current: () => ctx.state.currentPath
  })
});
```

```ts file="my-framework/plugins/views.ts" group="quick-start" check
import { createPlugin } from "../config";
import { routerPlugin } from "./router";

export const viewsPlugin = createPlugin("views", {
  depends: [routerPlugin], // [!note] Checked in `createApp`: `router` must be earlier in the list.
  createState: () => ({ count: 0 }),
  hooks: ctx => ({
    "router:navigate": () => {
      ctx.state.count += 1;
    }
  }),
  api: ctx => ({
    count: () => ctx.state.count
  })
});
```

```ts file="my-framework/index.ts" group="quick-start" check
import { coreConfig, createCore } from "./config";
import { routerPlugin } from "./plugins/router";
import { viewsPlugin } from "./plugins/views";

export const { createApp, createPlugin } = createCore(coreConfig, {
  plugins: [routerPlugin, viewsPlugin] // [!note] An app can configure these. It cannot remove or reorder them.
});
```

```ts file="app.ts" group="quick-start" check
import { createApp } from "./my-framework";

const app = createApp({
  config: { siteName: "My Blog" },
  pluginConfigs: { router: { basePath: "/blog/" } },
  onReady: ctx => console.log(`ready: ${ctx.config.siteName}`),
  onStop: ctx => console.log(`views: ${ctx.views.count()}`) // [!note] Callbacks see every plugin API.
});

await app.start();
app.router.navigate("/blog/about/");
console.log(`at: ${app.router.current()}`);
await app.stop();
```

## Run

```sh terminal title="run"
$ bun app.ts
ready: My Blog
at: /blog/about/
views: 1
```

`createApp` is synchronous, so `ready` prints before `app.start()` runs. `views` prints from
`onStop`, after every plugin has stopped.

## Let an app add a plugin

`createApp` also takes extra plugins. Export `createPlugin` from the framework, as above, and an
app writes its own. Its API lands on `app`, in the same types as the defaults.

```ts file="extend.ts" group="quick-start" check
import { createApp, createPlugin } from "./my-framework";

const greeterPlugin = createPlugin("greeter", {
  config: { greeting: "Hello" },
  api: ctx => ({
    greet: (name: string) => `${ctx.config.greeting}, ${name}. Welcome to ${ctx.global.siteName}.`
  })
});

const app = createApp({
  plugins: [greeterPlugin],
  config: { siteName: "My Blog" },
  pluginConfigs: { greeter: { greeting: "Hi" } }
});

console.log(app.greeter.greet("Ada"));
```

:::gotchas
- **Generics are all or nothing.** `createCoreConfig<Config, Events>` is the only call that takes them. To add core plugins as well, pass the third one too: see [Write a framework](/docs/core/guides/write-a-framework/).
- **`createApp` runs `onInit`.** Every plugin is initialized when it returns. `app.start()` is for what must wait: sockets, timers, listeners.
- **An app starts once.** A stopped app cannot start again. Create a new one.
:::

## Next

- [How it works](/docs/core/how-it-works/): what `createApp` does, in order.
- [Write a framework](/docs/core/guides/write-a-framework/): core plugins, defaults, exports, tests.
- [Three layers](/docs/concepts/three-layers/): who writes what.
- [API reference](/docs/core/api/): every export and type.
