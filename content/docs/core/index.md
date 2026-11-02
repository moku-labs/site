---
title: "@moku-labs/core"
description: "Micro-kernel plugin framework. Under 8 KB, zero deps. The kernel says no."
section: Get started
---

## Overview

Moku Core is the micro-kernel under every Moku framework. Two runtime exports, a bundle under
8 KB gzipped, zero dependencies. The type system does the heavy lifting.

It enforces three layers. The kernel is pure machinery. A framework defines the config shape, the
event contract and the default plugins. An app only configures, composes plugins and calls typed
APIs. Code written in a plugin cannot break the framework, and app code cannot break a plugin.

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

Describe what you want. The conductor picks the packages.

```text prompt
Build a blog with tags and an RSS feed on @moku-labs/web
```

```text prompt
Add a D1-backed comments API with @moku-labs/worker
```

```text prompt
Make a couch quiz game: TV shows questions, phones answer
```

```text prompt
Ship this app to macOS and iOS
```
