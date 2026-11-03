---
title: clock
description: "Logic. Trusted time as an input: a monotonic now() and one elapsed signal at the next due moment."
section: Plugins
order: 23
---

## What it does

`clock` gives the game time it can trust. `now()` never decreases, whatever the device clock
does, so a player who sets the clock back gains nothing. The clock holds one pending due moment
and sends one `elapsed` signal when it arrives.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| logic, in every app | Standard | nothing | nothing |

A node never touches the clock. It reads `now`, taken once at node entry, from its context. A
timer is a moment stored in `player`. The node arms it with `await fx(schedule(moment))` and waits
for `elapsed` at a rest node that lists it in its `inbox`. [flow](/docs/game/plugins/flow/) posts
`{ type: "elapsed", payload: { now } }` into its inbox when the moment arrives and when the game
resumes.

## Config

`pluginConfigs.clock`.

| Option | Type | Default | Description |
|---|---|---|---|
| `source` | `Clock.ClockSource \| undefined` | `undefined` | Time source. `undefined`: the system source, `Date.now` and `setTimeout`. Tests pass `fakeClock()`. |

A `ClockSource` is `{ now(), setTimer(callback, delayMs), clearTimer(handle) }`.

In a game made with `defineGameApp`, all of `clock` belongs to the shell: `game.headless()` and
`game.screen()` take the clock as a seam, `fakeClock(startMoment)` by default.

## API

Mounted at `app.clock`, reachable with `ctx.require(clockPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `now` | `() => number` | Trusted time. Never decreases. |
| `scheduleAt` | `(moment: number \| undefined) => void` | Replaces the single pending due moment. A moment in the past fires on the next macrotask of the source. |
| `onElapsed` | `(listener: (input: { now: number }) => void) => () => void` | Listens for `elapsed`: a due moment arrived, or `poke` was called. |
| `poke` | `() => void` | Delivers `elapsed` now, without touching the due moment. The engine calls it on resume. |
| `dueAt` | `() => number \| undefined` | The pending due moment. |
| `pending` | `() => number` | `0` or `1`: whether a scheduled moment is not yet due. A leak check reads it. |
| `listeners` | `() => number` | How many `onElapsed` listeners are registered. |

## Events

### Emits

None.

### Listens to

None.

## Example

```ts file="energy.ts" check
import { clockPlugin, createApp, createPlugin } from "@moku-labs/game";
import { fakeClock } from "@moku-labs/game/testing";

// A game plugin that needs trusted time declares the dependency and asks for the API.
const energyPlugin = createPlugin("energy", {
  depends: [clockPlugin],
  api: ctx => ({ fullAt: (missing: number) => ctx.require(clockPlugin).now() + missing * 60_000 })
});

const source = fakeClock(1_000_000);
const app = createApp({ plugins: [energyPlugin], pluginConfigs: { clock: { source } } });

app.clock.onElapsed(({ now }) => app.log.info("elapsed", { now }));
app.clock.scheduleAt(app.energy.fullAt(3));
source.advance(3 * 60_000); // a fake clock fires due timers synchronously
```

:::gotchas
- **No `setTimeout` in game logic.** Store the due moment in `player` and `await fx(schedule(moment))`. The [lint rules](/docs/game/guides/lint/) refuse timers in logic files.
- **One pending moment.** `scheduleAt` replaces it. The clock does not reschedule by itself.
- **How long is left is computed from `now`.** The save holds the moment, never a countdown.
:::

## Related

- [flow](/docs/game/plugins/flow/): the inbox that receives `elapsed`.
- [Nodes and flows](/docs/game/guides/nodes-and-flows/): timers with `schedule` and `inbox`.
- [Testing](/docs/game/guides/testing/): `fakeClock` and `advance`.
