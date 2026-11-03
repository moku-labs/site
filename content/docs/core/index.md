---
title: "@moku-labs/core"
description: "Micro-kernel plugin framework. Under 8 KB, zero deps."
section: Get started
order: 1
---

## Overview

Moku Core is the micro-kernel under every Moku framework. Two runtime exports, a bundle under
8 KB gzipped, zero dependencies. Most checks run at compile time.

It enforces three layers. The kernel has no domain logic. A framework defines the config shape, the
event contract and the default plugins. An app only configures, composes plugins and calls typed
APIs. A plugin cannot change the framework, and an app cannot reach into a plugin.

- **Each plugin owns its parts.** Config, state, API and events, resolved by the kernel.
- **Explicit dependencies.** `depends: [otherPlugin]`, validated when the app is created.
- **Strict emit.** Only known event names compile. A wrong payload is a type error.

:::callout
You build an app on a framework such as `@moku-labs/web`, never on the core directly. Install the
core when you write a framework of your own.
:::

## Install

```sh terminal
bun add @moku-labs/core
```

## Quick start

A framework and an app in one file: `createCoreConfig` defines the framework, `createCore` fixes
its default plugins, `createApp` is what the app calls.

```ts file="my-framework.ts" check
import { createCoreConfig } from "@moku-labs/core";

type Config = { siteName: string };
type Events = { "router:navigate": { from: string; to: string } };

const coreConfig = createCoreConfig<Config, Events>("my-site", { // [!note] "my-site" prefixes every kernel error.
  config: { siteName: "Untitled" }
});

const routerPlugin = coreConfig.createPlugin("router", {
  config: { basePath: "/" },
  createState: () => ({ currentPath: "/" }),
  api: ctx => ({
    navigate: (path: string) => {
      const from = ctx.state.currentPath;
      ctx.state.currentPath = path;
      ctx.emit("router:navigate", { from, to: path });
    },
    current: () => ctx.state.currentPath
  })
});

const framework = coreConfig.createCore(coreConfig, { plugins: [routerPlugin] });

const app = framework.createApp({
  config: { siteName: "My Blog" },
  pluginConfigs: { router: { basePath: "/blog" } }
});

await app.start();
app.router.navigate("/about"); // [!note] Fully typed: the API comes from the plugin spec.
await app.stop();
```

The chain is the whole API: `createCoreConfig` → `createCore` → `createApp`. The second runtime
export, `createCorePlugin`, builds infrastructure plugins such as `log` and `env`.

## Start with Claude

```text prompt
Write my own framework on @moku-labs/core with a router plugin
```

```text prompt
Add a typed event to my framework and emit it from a plugin
```

```text prompt
Make my search plugin depend on the router plugin
```

```text prompt
Add an infrastructure plugin to my framework with createCorePlugin
```

## Where to next

- [Quick start](/docs/core/quick-start/): a framework and an app, file by file.
- [How it works](/docs/core/how-it-works/): what `createApp` does, config merging, `require`, events.
- [Write a framework](/docs/core/guides/write-a-framework/): a package people install.
- [API reference](/docs/core/api/): every export and type.
