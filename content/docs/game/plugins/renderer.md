---
title: renderer
description: "Screen. Pixi v8, loaded lazily: one sync system owns every display object, the viewport fits the reference size, WebGPU first."
section: Plugins
order: 26
---

## What it does

`renderer` draws the world. It loads Pixi v8 lazily (`host`), keeps one `sync` system that owns
every display object, fits the reference viewport to `referenceSide` and `referenceLong`
(`viewport`), and counts the frames: render passes in every build, draw calls in a dev build.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| screen, in `screen` | Very Complex | `time`, `lifecycle`, `world` | `renderer:device-lost` |

Rendering is WebGPU first, with Pixi's WebGL fallback. A device with neither gets an
"unsupported device" screen. Without a `mount` the renderer is inert, so the same app starts in
plain Bun.

The display components are data on entities: `Transform`, `Sprite`, `NineSlice`, `Shape`,
`Parent`, `Display`, `Overlay`, `HudPart`, and the helper `sprite()`.

**On demand.** With `onDemand: true` a frame is drawn only when something visible changed: a
written view, a filter value, a resize, a wake, a capture. A game that writes into its own
`Display` object calls `app.renderer.invalidate(entity)` before the write.

**Safe area.** `viewport.size().safeArea` reads four CSS custom properties on the page,
`--moku-safe-top`, `--moku-safe-right`, `--moku-safe-bottom` and `--moku-safe-left`, each
falling back to `env(safe-area-inset-*, 0px)`.

```css
:root {
  --moku-safe-top: max(env(safe-area-inset-top, 0px), 24px);
}
```

## Config

`pluginConfigs.renderer`.

| Option | Type | Default | Description |
|---|---|---|---|
| `mount` | `string \| HTMLElement \| undefined` | `undefined` | Where the canvas goes. `undefined` keeps the plugin inert. |
| `preference` | `"webgpu" \| "webgl"` | `"webgpu"` | Passed to Pixi. Pixi falls back to WebGL by itself. |
| `background` | `number` | engine default | Clear colour, and the colour of the bars around the frame. |
| `antialias` | `boolean` | `false` | Antialias the whole canvas. |
| `maxResolution` | `number` | `2` | Cap of `devicePixelRatio`. Memory grows with its square. |
| `onDemand` | `boolean` | `false` | Draw a frame only when something visible changed. |
| `keptMb` | `number` | `64` | MiB for kept pictures of still filtered views. `0` keeps none. |
| `warm` | `number` | `1` | Probe draws per drawn frame that create GPU pipelines before a screen needs them. `0` turns it off. |
| `uploads` | `number` | engine default | Textures `assets.warm` puts on the GPU per drawn frame. |
| `poolTrim` | `PoolTrim \| false` | `{ restMs: 1000, aboveMb: 16 }` | Gives back idle render targets between frames. |
| `adaptiveScale` | `AdaptiveScale \| false` | `{ floor: 0.75, devices: "phone" }` | The render scale the adaptive frame rate may lower first. Needs `time.adaptive`. |
| `aspect`, `poolLimit`, `unsupportedMessage` | | engine default | Allowed aspect range, pooled display objects, the unsupported-device text. |
| `loadPixi` | `() => Promise<PixiModule>` | the lazy import | Loader seam. Tests pass a fake module. |
| `debug` | `Partial<DebugSwitches>` | all off | Debug drawing at start. `sync.debug` switches it live. |
| `monitor` | `MonitorConfig` | `{ budgetMs: "rate", frames: 1024 }` | The performance monitor of an agent build. |

In a game made with `defineGameApp`, `mount` belongs to the shell: the page puts the canvas on
`#game`.

## API

Mounted at `app.renderer`, reachable with `ctx.require(rendererPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `host.ready` | `() => boolean` | Whether the renderer draws. False while inert, while the device is lost and on the unsupported screen. |
| `host.kind` | `() => "webgpu" \| "webgl"` | The backend Pixi chose. |
| `host.canvas`, `host.device`, `host.gl`, `host.pixi` | `() => ... \| undefined` | The canvas, the GPU device, the WebGL2 context, the loaded Pixi module. Ask again each time: a restore makes new ones. |
| `host.resolution` | `() => number` | Device pixels per CSS pixel the app draws at now. |
| `viewport.size` | `() => Readonly<ViewportSize>` | The drawn frame in reference units, with `safeArea`. One frozen object until the frame changes. |
| `viewport.toReference`, `viewport.toScreen` | `(clientX, clientY)`, `(point)` | Between client CSS pixels and reference units. |
| `sync.hitTest` | `(x, y, accept: (entity) => boolean) => World.Entity \| undefined` | The topmost accepted entity under a point. |
| `sync.hitAll`, `sync.boundsOf`, `sync.hitBoxOf` | | Every entity under a point; where a view is drawn; its hit box. |
| `sync.displayOf` | `(entity) => unknown` | The Pixi object of an entity. |
| `sync.textures`, `sync.displays`, `sync.fonts`, `sync.filters`, `sync.debug`, `sync.leave` | | The registries other plugins hand the renderer, and the debug switches. |
| `invalidate` | `(entity) => void` | Call before writing into a Pixi object the renderer cannot see. |
| `stats` | `() => RenderStats` | The counters: frame timing, draw calls, render passes, `drawn`, texture memory. |
| `capture` | `(options?) => Promise<Captured \| undefined>` | A PNG of the canvas after the next frame. Dev builds only. |
| `monitor` | `PerfMonitorApi` | The performance log of an agent build: `stream`, `frames`, `mark`, `event`, `setResolution`. |

`monitor.setResolution(n)` works in every build: it is how a player's graphics setting is applied
from an effect.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `renderer:device-lost` | `{ kind: "webgpu" \| "webgl"; reason: string }` | The GPU device or context was lost. `lifecycle` is pushed. |

### Listens to

None that a game sees.

## Example

```ts file="page.ts" check
import { createApp, screen } from "@moku-labs/game";

// A game with a screen names the element the canvas goes into.
const app = createApp({
  plugins: [...screen],
  pluginConfigs: { renderer: { mount: "#game", background: 0x10161d, onDemand: true } }
});
await app.start();

app.renderer.host.kind(); // "webgpu" in Chrome, "webgl" on an older device
app.renderer.viewport.size().safeArea;
app.renderer.stats().drawn; // frames drawn per second
```

:::gotchas
- **No static `pixi.js` import in a game.** The [lint rule](/docs/game/guides/lint/) `lazy-imports` refuses it. Ask `host.pixi()` for the module the renderer loaded.
- **The mount has no border, padding, scrollbar or transform.** The canvas takes its border box.
- **Compare `viewport.size()` with `===`.** It is replaced only when the frame changes, and a write into it throws.
:::

## Related

- [world](/docs/game/plugins/world/): the entities it draws.
- [effects](/docs/game/plugins/effects/): particles and filters on the views.
- [Screens](/docs/game/guides/screens/): the reference size and layers.
