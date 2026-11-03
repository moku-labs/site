---
title: debug
description: "Logic. The editor's overlay from the game: open, close, toggle, isOpen. A no-op without the agent."
section: Plugins
order: 37
---

## What it does

`debug` lets a game open the [editor's overlay](/docs/editor/plugins/agent/) without importing the
editor. A game's own gesture calls `app.debug.overlay`. A debug build shows the overlay. A store
build does nothing, and the game code needs no guard.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| logic, in every app | Standard | nothing | nothing |

Every app has it, headless and screen. A game never lists it in `plugins`.

**No agent, no overlay.** The members work only on a page with the agent: `moku-game dev` and
`moku-game build --debug`. Everywhere else, in a release build, a library test or `createHeadless`,
every member answers `false`. A release bundle carries none of the overlay code.

**Where a call goes.** Each member looks for the overlay at call time, because the page agent starts
after the app. It tries the channel the agent sets. Then it tries the overlay of an older editor,
which has no pill: the mode is dropped. With neither, it answers `false`.

## Config

The plugin has no `pluginConfigs` entry. How the overlay shows when a debug page starts is the
`debug.overlay` key of the game's `config.ts`.

| `debug.overlay` | What the page does after the agents started |
|---|---|
| `"closed"` | Nothing. The default. |
| `"pill"` | `app.debug.overlay.open({ mode: "pill" })` |
| `"open"` | `app.debug.overlay.open({ mode: "card" })` |

Only a page with the agent reads the key. Any other value makes the config fail with a `[game]` error.
See [The game shell](/docs/game/guides/game-shell/).

## API

Mounted at `app.debug`, reachable with `ctx.require(debugPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `overlay.open` | `(options?: { mode?: "pill" \| "card" }) => boolean` | Shows the overlay: the card by default, the small pill with `{ mode: "pill" }`. `true` when an overlay took the call. |
| `overlay.close` | `() => boolean` | Hides it. `true` when an overlay took the call. |
| `overlay.toggle` | `() => boolean` | Switches between hidden and the last visible mode. `true` when an overlay took the call. |
| `overlay.isOpen` | `() => boolean` | `true` while it shows, as the pill or the card. |

## Events

### Emits

None.

### Listens to

None.

A member whose overlay throws does not throw to the game. It logs `debug:overlay-failed` with the
name of the call and answers `false`.

## Example

```ts file="debug-gesture.ts" check
import { createApp, createPlugin, debugPlugin } from "@moku-labs/game";

// A game plugin that binds its own gesture to the overlay.
const helpPlugin = createPlugin("help", {
  depends: [debugPlugin],
  api: ctx => ({
    longPressOnLogo: () => ctx.require(debugPlugin).overlay.toggle()
  })
});

const app = createApp({ plugins: [helpPlugin] });
await app.start();

app.help.longPressOnLogo(); // false here: plain Bun has no agent
app.debug.overlay.open({ mode: "pill" }); // false here, true on a debug build
app.debug.overlay.isOpen(); // false
```

The ui tag `DebugTrigger` is the ready-made gesture: five taps within three seconds on the marked
view call `app.debug.overlay.open()`. See [ui](/docs/game/plugins/ui/).

:::gotchas
- **`true` does not mean the overlay shows.** It means an overlay took the call. Ask `isOpen()` for what shows.
- **The name `debug` is the engine's.** A game plugin named `debug` is refused at `createApp` as a duplicate name.
- **A `DebugTrigger` view must take a press.** Use a `button`, or an element with `Touchable`.
:::

## Related

- [agent](/docs/editor/plugins/agent/): the overlay itself, on the editor's side.
- [On a phone](/docs/editor/guides/on-a-phone/): a debug build with the editor's agent.
- [ui](/docs/game/plugins/ui/): the `DebugTrigger` tag.
