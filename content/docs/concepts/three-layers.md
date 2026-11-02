---
title: Three layers
description: "createCoreConfig, createCore, createApp. Who writes what."
section: Concepts
order: 1
---

## The factory chain

Moku is a micro-kernel with three layers. Each layer constrains the one above it, and each step of
the chain captures its types in a closure, so the next step stays typed with no explicit generics.

```text
createCoreConfig(id, { config, plugins? })   Step 1: capture Config, Events, core plugins
  → { createPlugin, createCore }
createCore(coreConfig, { plugins, ... })     Step 2: capture the default plugins
  → { createApp, createPlugin }
createApp({ plugins?, config?, ... })        Step 3: merge the app's extras, run init
  → App  (frozen, plugin APIs mounted by name)
```

| Layer | Who writes it | Can | Cannot |
| --- | --- | --- | --- |
| 1. `@moku-labs/core` | the kernel | lifecycle, registry, events, config, freeze | know anything about a domain |
| 2. Framework, such as `@moku-labs/web` | the framework author | define the config shape, events, default plugins | change the kernel |
| 3. Your app | you, or an agent | configure, compose plugins, call typed APIs | change the framework or bypass a plugin |

## Layer 1: createCoreConfig

The kernel has no domain logic. The framework names itself, declares its global config shape and its event map,
and lists the core plugins that land on every `ctx`. `@moku-labs/web` calls it with the id `web`,
which is why every kernel error in this framework starts with `[web]`.

## Layer 2: createCore

The framework fixes its default plugins. An app can configure them but never remove or reorder
them. `@moku-labs/web` ships `site`, `i18n`, `router`, `head` and `spa` as defaults and exports
`createApp` and `createPlugin` to you.

| Option | Purpose |
| --- | --- |
| `plugins` | Default plugins, always loaded. |
| `pluginConfigs` | Framework-level overrides. |
| `onReady` | Runs after every `onInit`. |
| `onError` | Receives hook dispatch failures. Lifecycle errors propagate instead. |

## Layer 3: createApp

This is the layer you write. Everything comes from the framework: `createApp`, `createPlugin` and
the plugin instances.

```ts file="src/app.ts" check
import { createApp, createPlugin } from "@moku-labs/web";

const greetingPlugin = createPlugin("greeting", {
  config: { name: "world" },
  api: ctx => ({
    hello: () => `Hello, ${ctx.config.name}!`
  })
});

const app = createApp({
  plugins: [greetingPlugin], // [!note] Added after the framework's defaults.
  config: { mode: "ssg" },
  pluginConfigs: {
    site: { name: "My Site", url: "https://example.com" },
    greeting: { name: "Moku" } // [!note] Per plugin, by name. Checked against the plugin's config type.
  }
});

console.log(app.greeting.hello()); // "Hello, Moku!"
```

The final plugin list is `[...frameworkDefaults, ...yourPlugins]`. `createApp` is synchronous:
init runs before it returns.

## Rules

:::gotchas
- **An app never imports `@moku-labs/core`.** It imports `createApp`, `createPlugin` and plugins
  from its framework.
- **Config is shallow.** `{ ...defaults, ...overrides }`. A nested object is replaced as a whole,
  so keep config flat.
- **Everything is frozen.** The global config, each plugin config and the app. Only `ctx.state`
  is mutable.
:::
