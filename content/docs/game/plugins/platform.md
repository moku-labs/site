---
title: platform
description: "Opt-in. The phone as a provider: the Back button, haptics and keep-awake. Inert without a provider."
section: Plugins
kind: optional
order: 36
---

## What it does

`platform` connects the game to the phone through a provider the game passes. The provider's
pause and resume become the `"background"` reason of [lifecycle](/docs/game/plugins/lifecycle/).
Its Back press runs the Back chain. The `haptic` effect reaches `provider.haptic`. `keepAwake`
keeps the screen on while the game runs.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| opt-in, last in the array | Standard | `lifecycle`, `flow`, `input` | nothing |

Without a provider the plugin is inert: a `haptic` effect resolves at once, so the same node runs
on the web and headless.

A game imports no native package. In a game made with `defineGameApp`, the page builds the
provider from the `system` list of `config.ts`, through `@moku-labs/game/app/system`, and turns
keep-awake on when the list names `keepAwake`. See [Native](/docs/game/guides/native/).

**The Back chain.** One press, the first step that takes it wins:

1. Escape: a popup with an `escape` button closes. Answer `"popup"`.
2. The intent `back`, when the resting node lists it. Answer `"intent"`.
3. `provider.exit()`. Answer `"exit"`.

Without a provider the answer is `"none"`. While a guide narrows the gate, Back is offered to it as
the intent `back` and answers `"intent"`.

**Haptics.** `await fx(haptic("success"))` in a node, or `haptic("light")` as a timeline step.
The kinds are `HAPTIC_KINDS`: `light`, `medium`, `heavy`, `selection`, `success`, `warning`,
`error`. A fast walk is silent.

A `PlatformProvider` has six members: `onPause(fn)`, `onResume(fn)` and `onBack(fn)`, each
returning its remover, then `haptic(kind)`, `keepAwake(on)` and `exit()`. A provider method that
throws is logged, never thrown into the frame.

## Config

`pluginConfigs.platform`.

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | `PlatformProvider \| undefined` | `undefined` | The phone. Absent: the plugin is inert and `back()` answers `"none"`. |
| `keepAwake` | `boolean` | `false` | Keep the screen on while the game runs. Released while it is paused and on stop. |

In a game made with `defineGameApp`, all of `platform` belongs to the shell; `game.screen()` takes
the provider as its `platform` seam.

## API

Mounted at `app.platform`, reachable with `ctx.require(platformPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `back` | `() => "popup" \| "intent" \| "exit" \| "none"` | Runs the Back chain once, as the system Back button does. |
| `exit` | `() => void` | The last step of the chain alone, for a Leave button. Without a provider it does nothing. |

## Events

### Emits

None.

### Listens to

`lifecycle:changed`: a pause releases keep-awake.

## Example

```ts file="phone.ts" check
import { createApp, createPlugin, flowPlugin, type PlatformProvider, platformPlugin, screen } from "@moku-labs/game";

// A headless test drives the plugin with a fake of six functions.
const ticks: string[] = [];
const provider: PlatformProvider = {
  onPause: () => () => undefined,
  onResume: () => () => undefined,
  onBack: () => () => undefined,
  haptic: kind => {
    ticks.push(kind);
  },
  keepAwake: () => undefined,
  exit: () => undefined
};

// The Leave button of a game is an effect; this plugin answers it by leaving the app.
const leavePlugin = createPlugin("leave", {
  depends: [flowPlugin, platformPlugin],
  onStart: ctx => {
    ctx.require(flowPlugin).fx.handle("exit", () => ctx.require(platformPlugin).exit());
  }
});

const app = createApp({
  plugins: [...screen, platformPlugin, leavePlugin],
  pluginConfigs: { platform: { provider, keepAwake: true } }
});
await app.start();
app.platform.back(); // "popup", "intent", "exit" or "none"
```

:::gotchas
- **`platformPlugin` goes last** in a hand-made plugin list, after the screen set, `effects` and `audio`.
- **`exit()` skips Escape and the intent.** Use it for a Leave button; `back()` replays the system button.
- **List `back` on a rest node to own the button.** A node that does not list it lets the press leave the app.
:::

## Related

- [Native](/docs/game/guides/native/): the system shell and the native build.
- [lifecycle](/docs/game/plugins/lifecycle/): the `"background"` reason.
- [Game shell](/docs/game/guides/game-shell/): `system` in `config.ts`.
