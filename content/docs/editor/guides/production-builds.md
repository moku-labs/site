---
title: Production builds
description: "The editor is a dev dependency: a release build carries none of it. How the guard folds the agent away."
section: Guides
order: 15
---

## How it works

The editor is a dev dependency, not a runtime. Nothing of it ships in a release build. The engine
defines its build flags inline, so a branch behind a flag that is `false` drops out of the bundle.

## A moku-game folder

A moku-game folder needs nothing here. The engine's release page names no agents. A debug build
(`moku-game build --debug`) adds `@moku-labs/editor/agent/page` on purpose. The body of that page
agent sits behind the inline guard `__MOKU_GAME_DEV__ || __MOKU_GAME_AGENT__`, so a release build,
which defines both `false`, drops it.

## A game with its own HTML page

Import the agent only behind the engine's dev flag, with a dynamic import. A production build
defines `__MOKU_GAME_DEV__` as `false` and drops it whole:

```ts file="src/dev.ts" check
import { app } from "./game";

if (__MOKU_GAME_DEV__) {
  const { createApp, bridgePlugin, capturePlugin } = await import("@moku-labs/editor/agent"); // [!note] A dynamic import inside the branch: the bundler never reaches the module in a release build.
  await createApp({ plugins: [bridgePlugin, capturePlugin], pluginConfigs: { registry: { game: app } } }).start();
}
```

## What ends up in the bundle

Measured with `Bun.build` (browser, minified, the game itself external) in the editor's own test
suite:

| Entry | Flags | Editor code in the bundle | Size |
|---|---|---|---|
| The dev entry above | `__MOKU_GAME_DEV__` `false` | None | 0 B (the whole entry is 73 B, the game's own lines) |
| The dev entry above | `__MOKU_GAME_DEV__` `true` | Agent core, registry, channel, perf, recorder, the overlay with its fonts, bridge, capture, Preact, `@moku-labs/core`, `@moku-labs/common` | 299,859 B minified, 122,297 B gzip |
| The engine's page, debug build | `__MOKU_GAME_DEV__` `false`, `__MOKU_GAME_AGENT__` `true` | The same agent through `@moku-labs/editor/agent/page` | 299,807 B minified, 123,404 B gzip |
| The engine's page, release build | both `false` | None: the guard folds | 0 B (the whole entry is 155 B) |

The editor's test bounds the dev agent at 124,000 B gzip. To stay under it, the phone only reads:
the marks, the pass chains and the 2-minute history are built on the tools page.

## Why a static import drops out too

The package is `"sideEffects": false`. The agent core, each agent plugin and each core config are
created `/* @__PURE__ */`. So a static import used only inside `if (__MOKU_GAME_DEV__)` drops out
too, and so does a type-only import of a plugin.

An agent export used outside that branch keeps what it references. A game entry that logs
`bridgePlugin.name` outside the branch, with `__MOKU_GAME_DEV__` `false`, still ships the agent
without capture: 288,933 B minified, 119,887 B gzip.

:::gotchas
- **Touch no agent export outside the dev branch.** One reference keeps most of the agent in the bundle.
- **The guard folds only with the engine's flags.** A release build defines `__MOKU_GAME_DEV__` and `__MOKU_GAME_AGENT__` as `false`.
- **A store check looks for `/__editor/hello` and `[moku-editor]`.** Neither is in a release bundle.
:::

## Related

- [On a phone](/docs/editor/guides/on-a-phone/): the debug build and its flags.
- [Quick start](/docs/editor/quick-start/): the dev entry of a game with its own page.
