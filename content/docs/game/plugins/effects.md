---
title: effects
description: "Opt-in. Particles and filters as components: emitters, WGSL and GLSL filters, seven built-in filters. Headless it draws nothing."
section: Plugins
kind: optional
order: 34
---

## What it does

`effects` draws cosmetic extras as data on entities: particles and filters. Nothing of it enters
the model, the journal or a save. Headless it draws nothing. A game without `effectsPlugin`
carries none of its systems, filters or shaders in its bundle.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| opt-in, `plugins: [...screen, effectsPlugin]` | Complex | `flow`, `world`, `renderer`, `assets`, `anim` | nothing |

`game.screen()` of `defineGameApp` composes it for the game. An app made with `createApp` adds it
itself.

**Particles.** `defineEmitter(id, config)` describes a particle effect; a feature lists it under
`emitters`. Required: `textures` (1 to 16 asset keys of one atlas page) and exactly one of `burst`
or `rate`. The `Emitter({ effect, active })` component runs it on its entity. Particles step in
the `animate` phase, so they freeze while paused, and a fast walk emits nothing. Their random
source is seeded, never `Math.random` and never the model's rng.

| Emitter option | Default |
|---|---|
| `lifeMs` | `[600, 1000]` |
| `speed`, `spin` | `[0, 0]` |
| `angle` | `[0, 360]` |
| `gravity`, `drag`, `prewarmMs` | `0` |
| `shape` | `{ kind: "point" }`, or `circle`, `rect`, `ring` |
| `scale`, `alpha` | `{ from: 1, to: 1 }` |
| `space` | `"world"`, or `"local"` |
| `maxParticles` | `256` |
| `blend` | `"normal"`, or `"add"` |

**Filters.** `defineFilter(id, { wgsl, glsl, uniforms?, passes?, padding?, inputs?, fallback?, cache?, area? })`
turns a WGSL fragment body and its GLSL twin into a component type; a feature lists it under
`filters`. Both bodies are required, so a filter draws on WebGPU and on WebGL. A uniform is a
number (tweenable), `{ color }` or an array of 2 to 4 numbers. Every filter component also has
`enabled` and `order`. A filter covers the entity's subtree; on a ui element it goes in the
`components` prop.

Built-in filters: `Glow`, `Outline`, `Blur`, `ColorMatrix`, `Noise`, `Displacement` (`map` is an
asset key) and `Alpha`. A motion tweens them like any component.

**Shader checks.** Every body compiles once on the device when the renderer first draws. A broken
filter draws its `fallback` or the view unfiltered, never a blank frame. A dev build also draws
magenta stripes over it.

## Config

`pluginConfigs.effects`.

| Option | Type | Default | Description |
|---|---|---|---|
| `maxParticles` | `number` | `3000` | Live particles over every instance above which one warning fires per crossing. |
| `maxPasses` | `number` | `24` | Render passes per frame above which one warning fires. |
| `phone` | `boolean \| "auto"` | `"auto"` | Whether the device is a phone. `"auto"`: a coarse pointer and a short side of at most 820 CSS px. |
| `blur` | `{ quality: number; phoneResolution: number }` | `{ quality: 2, phoneResolution: 0.5 }` | What a `Blur` with `quality: 0` and `resolution: 0` resolves to. A game that sets it gives both fields. |

## API

Mounted at `app.effects`, reachable with `ctx.require(effectsPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `stats` | `() => { particles; emitters; filters; renderPasses }` | What runs now. Headless every number is 0. |
| `diagnostics.kinds` | `() => readonly string[]` | The filter kinds: built-ins, then feature filters. |
| `diagnostics.disable`, `diagnostics.enable` | `(kind: string) => boolean` | Turns a kind off or on, to measure its cost on a device. Acts on a dev or agent page only. |
| `diagnostics.disabled` | `() => readonly string[]` | The kinds turned off. |

## Events

### Emits

None. The budgets are log warnings.

### Listens to

`ui:hot-swap` (a saved emitter) and `assets:replaced` (a swapped texture).

## Example

```ts file="steam.ts" check
import {
  createApp,
  defineEmitter,
  defineFeature,
  effectsPlugin,
  Emitter,
  Glow,
  projection,
  screen,
  Sprite
} from "@moku-labs/game";

// A particle effect as data. The feature lists it under `emitters`.
export const steam = defineEmitter("fx.steam", { textures: ["board.puff"], rate: 12, lifeMs: [600, 1000] });

// The view of a generator: a sprite, its steam, and a glow over both.
const generators = projection({
  name: "board.generators",
  layer: "items",
  from: (player: { generators: { id: string }[] }) => player.generators,
  key: item => item.id,
  view: () => [Sprite({ texture: "board.generator" }), Emitter({ effect: "fx.steam" }), Glow({ strength: 2 })]
});

const app = createApp({
  plugins: [...screen, effectsPlugin, defineFeature("board", { projections: [generators], emitters: [steam] })],
  pluginConfigs: { renderer: { mount: "#game" }, effects: { maxPasses: 16 } }
});
app.effects.stats(); // { particles: 0, emitters: 0, filters: 0, renderPasses: 0 }: nothing runs before start
```

:::gotchas
- **`effect: ""` draws nothing.** The `Emitter` of `defineGame` takes the game's emitter ids and `""`; `defineEmitter` never takes `""`.
- **A body that reads the screen position is drawn live.** Write `canvasPixel(uv)` for the pixel's canvas position and it is kept.
- **An `area` also clips the view's own children.** Make the box hold a shadow or a badge that overhangs it.
:::

## Related

- [renderer](/docs/game/plugins/renderer/): render passes, kept pictures and the warm-up.
- [Screens](/docs/game/guides/screens/): filters on ui elements.
- [API reference](/docs/game/api/#effects): the filter and emitter helpers.
