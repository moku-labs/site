---
title: How it works
description: "A catalog of core plugins: where they load, what each entry may import, and when env and log run."
section: Get started
order: 3
---

## A catalog, not a framework

`@moku-labs/common` has no `createApp` and no state of its own. It exports plugin objects made with
[`createCorePlugin`](/docs/core/api/). A framework lists them in `createCoreConfig`, and the kernel
does the rest.

| What the kernel does | Effect |
|---|---|
| Builds core plugins before regular ones | `ctx.log` and `ctx.env` are ready in the `hooks`, `api` and `onInit` of every regular plugin. |
| Puts each API on every plugin's context | `ctx.log`, `ctx.env`, by plugin name. |
| Puts each API on the app | `app.log`, `app.env`, and in the app callbacks. |
| Merges config by plugin name | `pluginConfigs.log` and `pluginConfigs.env`, at the framework and in the app. |

The plugin object carries no framework types, so one `logPlugin` works in `web`, `worker` and your
own framework. `createState` gets only `{ global, config }`, so it has neither `ctx.log` nor `ctx.env`.

## Three entries

An import path is a promise about what enters your bundle.

| Entry | Has | Imports from Node |
|---|---|---|
| `@moku-labs/common` | All plugins and all providers | `node:fs`, for `dotenv` |
| `@moku-labs/common/browser` | `logPlugin`, `envPlugin`, `browserEnv` | Nothing |
| `@moku-labs/common/cli` | The terminal kit | `node:readline` |

```ts file="src/client.ts" check
import { browserEnv, envPlugin, logPlugin } from "@moku-labs/common/browser"; // [!note] A client bundle must use this path.
import { createCoreConfig } from "@moku-labs/core";

type Config = {};
type Events = {};

export const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin, typeof envPlugin]>("my-client", {
  config: {},
  plugins: [logPlugin, envPlugin],
  pluginConfigs: {
    env: { providers: [browserEnv()] }
  }
});
```

:::callout{tone="warn"}
Tree-shaking the root entry is not the same promise. `dotenv` imports `node:fs` at the top of the
module, and the root entry holds it. Use `/browser` for anything that runs in a page.
:::

## When env resolves

`env` does its work once, in `onInit`, which is inside `createApp`.

```text file="the env pipeline"
createApp()
  1. load      each provider's load(), in order. "" counts as absent. First value wins.
  2. check     a public var must carry the prefix, and a prefixed var must be public
  3. fill      schema defaults, then required vars must have a value
  4. publish   public vars with a value go to the public map
  5. freeze    both maps. Any write throws.
```

Any failure throws out of `createApp`. After it returns, every read is a lookup in a frozen map.
A provider is not read again, so a value that changes later is not seen. Details are on the
[env plugin](/docs/common/plugins/env/) page.

## When log records

`log` has no start and no stop. Its `onInit` picks the console sink from `mode`. From then on each call does two things, in this order.

```text file="one log call"
ctx.log.info("mailer:sent", { to })
  1. append  { level, event, data, ts } to the in-memory trace, always
  2. fan out to every sink, in the order they were added
```

The trace ignores `mode`, so `expect()` and `trace()` work the same in production and in tests. A
sink only decides what is printed. Details are on the [log plugin](/docs/common/plugins/log/) page.

## How a framework configures them

Config for a core plugin merges through all three layers, so a framework can set a default and an
app can replace it. Every level is shallow: a new `providers` array replaces the old one.

```text file="merge order, last wins"
spec config → createCoreConfig({ pluginConfigs }) → createCore({ pluginConfigs }) → createApp({ pluginConfigs })
```

`@moku-labs/web` uses this: its browser entry sets `browserEnv()` for you, so a web app needs no
`env` config in the browser.

:::gotchas
- **`onStop` has no `ctx.log`.** Its context is `{ global, config, state }`. To log during teardown, keep `ctx.log` in state from `onStart`. It still works then: core plugins stop last.
- **Neither plugin holds a resource.** They have no `onStart` or `onStop`, so `app.start()` is not needed before you read `ctx.env` or call `ctx.log`.
- **Env errors start with `[web]`.** The prefix is fixed in the plugin, in every framework. It does not name your framework.
:::

## Related

- [log plugin](/docs/common/plugins/log/) and [env plugin](/docs/common/plugins/env/).
- [Lifecycle](/docs/concepts/lifecycle/): the order of core and regular plugins.
- [API reference](/docs/common/api/): every export of all three entries.
