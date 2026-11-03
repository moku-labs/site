---
title: anim
description: "Screen. Choreography as data: tweens, timelines built from typed slots, motions for enter, exit and change, sprite frames."
section: Plugins
order: 30
---

## What it does

`anim` is the one tween core of the engine. It installs itself into `world.projection` as the
tween driver, so every motion of every view runs on it. On top of that it plays timelines:
frozen data built from typed slots, played by a node as an effect.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| screen, in `screen` | Complex | `flow`, `world`, `renderer` | `anim:mark`, `anim:finished` |

**A timeline.** `defineAnimation(id, { slots, build })`. `slots` names the targets with
`type<Anim.Target>()`; a target is `{ projection, key }` or an entity. `build(slots, { at })`
returns the step tree. A node plays it with `await fx(play(animation, slots))`; in fast mode it
finishes at once. A timeline runs in game time, so `time.setScale` and a pause apply to it.

| Step | What it does |
|---|---|
| `sequence(...)`, `parallel(...)` | Run steps one after another, or together. |
| `stagger(items, ms, item => step)` | The same step per item, started `ms` apart. |
| `tween(target, Component, to, { ms, ease?, delayMs?, additive?, space?, reduced?, segments?, repeat? })` | Moves numeric fields. `cubicBezier(x1, y1, x2, y2)` makes an `ease`. |
| `set(target, Component, patch)`, `wait(ms)`, `mark(name)` | Writes at once; waits; marks a point. |
| `frames(target, { keys, fps, loop? })` | Walks a sprite through its textures. |
| `sfx(key, { bus? })`, `haptic(kind)` | Descriptors [audio](/docs/game/plugins/audio/) and [platform](/docs/game/plugins/platform/) handle. |
| `use(animation, slots, tools?)` | Plays another animation inside this one. |
| `spawn(id, components, options?)`, `spawned(id)` | A temporary entity the timeline despawns when it ends, and a target for it. |
| `external(player, clip)` | Throws until Spine arrives. |

**Motions.** `defineMotion({ states, transition?, on: { enter?, exit?, change? }, when? })` builds
the hooks of a projection or the `motion` prop of a ui tag. `when: "change"` plays enter and exit
only for a commit.

**Components.** `Frames({ keys, fps, loop, playing })` walks a sprite through its textures for the
entity's whole life: a spinning coin. `Animation` is the engine's own component. A system cannot
`require` a plugin, so it plays through the resource `AnimPlayer`:
`res(AnimPlayer).play(animation, slots)`.

**Reduced motion.** While it is on, every track takes 0 ms and every loop stands on its first
key; marks and sounds still fire. `reduced: "keep"` on a step plays it as written.

## Config

`pluginConfigs.anim`.

| Option | Type | Default | Description |
|---|---|---|---|
| `maxTracks` | `number` | `2000` | Dev guard: one warning each time the running track count rises past it. Durations live in the steps, never here. |
| `reducedMotion` | `boolean` | engine default | Start value of reduced motion. `setReducedMotion` switches it while the game runs. |

## API

Mounted at `app.anim`, reachable with `ctx.require(animPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `play` | `(animation, slots) => PlayHandle` | Builds the step tree and starts it from the next frame. A node uses the `play` effect instead. |
| `finishAll` | `() => void` | Ends every track and timeline now: targets written, marks jumped, spawned entities despawned. |
| `active` | `() => number` | Tracks in the table, delays and loops included. |
| `reducedMotion`, `setReducedMotion` | `() => boolean`, `(on: boolean) => void` | Read and switch reduced motion. |
| `onMark` | `(fn) => () => void` | Called for every mark a timeline reaches, next to `anim:mark`. |
| `replace` | `(definition) => void` | The dev hot swap of a saved `animations.ts`: the next `play` builds the new tree. |

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `anim:mark` | `{ animation: string; mark: string }` | A `mark` step was reached, or jumped by a finish. |
| `anim:finished` | `{ animation: string }` | A timeline ended or was finished. Never on a cancel. |

### Listens to

None.

## Example

```ts file="hud.ts" check
import {
  type Anim,
  createApp,
  defineAnimation,
  defineFeature,
  defineGame,
  mark,
  play,
  screen,
  sequence,
  sfx,
  Transform,
  tween,
  type
} from "@moku-labs/game";

const { defineNode } = defineGame<{
  player: { coins: number };
  session: { rolls: number };
  assets: string;
  strings: Record<string, unknown>;
}>();

// Animation is data: typed slots for the targets, a build function for the steps.
export const popCoins = defineAnimation("hud.popCoins", {
  slots: { coins: type<Anim.Target>() },
  build: ({ coins }) =>
    sequence(
      tween(coins, Transform, { scale: 1.2 }, { ms: 120 }),
      tween(coins, Transform, { scale: 1 }, { ms: 200, ease: "outCubic" }),
      sfx("hud.coins"),
      mark("done")
    )
});

// A node awaits the timeline like any effect.
export const reward = defineNode({
  outcomes: { done: type() },
  run: async ({ player, fx, out }) => {
    player.coins += 5;
    await fx(play(popCoins, { coins: { projection: "hud", key: "coins" } }));
    return out.done();
  }
});

const app = createApp({ plugins: [...screen, defineFeature("hud", { animations: [popCoins] })] });
app.anim.setReducedMotion(true);
```

:::gotchas
- **Play on a change, never every frame.** A system that plays from phase `input` moves the tree in `animate` of the same frame.
- **A target is resolved once, when the timeline starts.** Every step writes the view that held the key then, also while its exit plays.
- **Declare a motion at module level.** One rebuilt in a view is reported in dev as `ui:motion-rebuilt`.
- **`AnimPlayer` before `anim` starts throws.**
:::

## Related

- [Screens](/docs/game/guides/screens/): motions on views and ui elements.
- [world](/docs/game/plugins/world/): the views a timeline moves.
- [Hot swap](/docs/game/guides/hot-swap/): saving `animations.ts`.
