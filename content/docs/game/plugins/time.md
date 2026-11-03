---
title: time
description: "Logic. The one frame loop: six phases, a time scale, an idle cap, an adaptive frame rate, and step() for tests."
section: Plugins
order: 20
---

## What it does

`time` owns the single `requestAnimationFrame` loop of the game. Every frame runs six phases in
this order: `input`, `animate`, `layout`, `sync`, `signals`, `render`. A plugin registers its
frame work for one phase with `onFrame`.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| logic, in every app | Standard | nothing | `time:thermal`, `time:rate` |

The frame state is `Time`: `{ delta, elapsed, scale, frame, idle }`, in scaled milliseconds.
Game logic never reads it. A node gets `now` from [clock](/docs/game/plugins/clock/) through its
context.

In plain Bun there is no frame source. `isRunning()` is false, and a test drives the frames with
`step(deltaMs)`.

**Idle cap.** After `idleAfterMs` without a `wake()`, the loop runs at `idleFps` and
`snapshot().idle` is true. `wake()` lifts it at once. `input`, `anim`, `flow`, `assets`, `scenes`,
`text` and `ui` call it. `step()` is never capped.

**Adaptive frame rate.** With `adaptive: { floor }` the loop runs at the highest divisor of the
display rate at or below `maxFps`: 120 on a 120 Hz panel, 60 on a 60 Hz one, 72 on 144 Hz. It
drops one step when drawn frames come late, and returns after a dwell. It never goes below
`floor`. Only drawn frames count. Every change emits `time:rate`. It is off by default, in a
headless app and on a fake clock.

## Config

`pluginConfigs.time`.

| Option | Type | Default | Description |
|---|---|---|---|
| `maxFps` | `30 \| 60 \| 120` | `60` | Frame rate cap. With `adaptive`, the top of the ladder. |
| `maxDeltaMs` | `number` | `50` | Upper bound of one frame's delta, in milliseconds. |
| `idleFps` | `0 \| 30` | `30` | Frame rate of an idle screen. `0` turns the idle cap off. |
| `idleAfterMs` | `number` | `2000` | Unscaled milliseconds without a `wake()` before the loop goes idle. |
| `adaptive` | `false \| { floor: 30 \| 60 }` | `false` | The adaptive frame rate. |

## API

Mounted at `app.time`, reachable with `ctx.require(timePlugin)`.

| Method | Signature | Description |
|---|---|---|
| `onFrame` | `(phase: Time.Phase, callback: (time: Readonly<Time.Time>) => void) => () => void` | Registers a frame callback. Callbacks of one phase run in registration order. Returns the remover. |
| `snapshot` | `() => Readonly<Time.Time>` | A copy of the current `Time`. |
| `setScale` | `(scale: number) => void` | Multiplies every frame delta. `0` freezes game time while frames keep running. |
| `pause`, `resume` | `() => void` | Stop and restart the phases. Called by [lifecycle](/docs/game/plugins/lifecycle/). |
| `isPaused` | `() => boolean` | Whether the clock is paused. |
| `isRunning` | `() => boolean` | Whether a real frame source drives the loop. False in plain Bun. |
| `step` | `(deltaMs: number) => void` | Runs exactly one frame. Ignores the fps cap, the pause flag and `maxDeltaMs`. The time scale still applies. For tests and tools. |
| `wake` | `() => void` | Resets the idle timer. Cheap and safe inside a frame callback. |
| `rate` | `() => Readonly<Time.FrameRate>` | The frame rate now: `fps`, who decides it, why, the display rate, the ladder and the thermal status. One frozen object until it changes. |
| `setRate` | `(choice: "auto" \| 30 \| 60 \| 120) => Readonly<Time.FrameRate>` | Forces the cap, never above `maxFps`. `"auto"` gives it back to the config. |

Members for engine plugins and tools: `wakes()`, `frameListeners()`, `allowScale(floor)`,
`sceneChanged()`, `frameDrawn()`, `frameProbed()`, and, in agent builds only (dev pages and
`--debug` builds), `measure(listener)`, `agentClock()` and `chargeAgent(ms)`. Without the agent
flag those three do nothing.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `time:rate` | `Time.RateChange`: `from`, `to`, `reason`, `mode`, `displayHz`, `thermal`, `window`, `dwellMs` | The adaptive frame rate changed. |
| `time:thermal` | `Time.ThermalReading`: `{ status, headroom, at, android }` | The native shell reported heat. Only in an agent build or with `adaptive`. |

### Listens to

None.

## Example

```ts file="sparkle.ts" check
import { createApp, createPlugin, timePlugin } from "@moku-labs/game";

// A game plugin with frame work declares the dependency and registers on start.
const sparklePlugin = createPlugin("sparkle", {
  depends: [timePlugin],
  createState: () => ({ elapsed: 0 }),
  onStart: ctx => {
    ctx.require(timePlugin).onFrame("animate", time => {
      ctx.state.elapsed += time.delta;
    });
  }
});

const app = createApp({
  plugins: [sparklePlugin],
  pluginConfigs: { time: { maxFps: 120, adaptive: { floor: 60 } } }
});
await app.start();

app.time.isRunning(); // false in plain Bun: there is no frame source
app.time.step(16); // one frame of 16 ms, the way a test drives the loop
app.time.rate().fps;
```

:::gotchas
- **A node never reads `time`.** Game logic takes `now` from its node context, and `Date.now()` is refused by the [lint rules](/docs/game/guides/lint/).
- **`120` needs a WebView that delivers 120 Hz.** Android does today. WKWebView on iOS and macOS is capped at 60 by WebKit.
- **A callback registered during a frame runs from the next frame on.**
- **`pause()` belongs to `lifecycle`.** A game pushes a pause reason instead of pausing the clock.
:::

## Related

- [clock](/docs/game/plugins/clock/): trusted time for the game logic.
- [lifecycle](/docs/game/plugins/lifecycle/): what pauses the loop.
- [Testing](/docs/game/guides/testing/): headless games driven with `step`.
