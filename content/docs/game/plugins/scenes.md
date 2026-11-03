---
title: scenes
description: "Screen. A scene as a declaration: bundle, bundles(state), layers, projections, music. A node names its scene."
section: Plugins
order: 29
---

## What it does

`scenes` mounts what the screen shows. A scene is data: its bundle, more bundles read from the
committed state, its layers, its projections and its music. A node names the scene it is shown on,
and the runner switches through `flow.onEnter` before the node runs.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| screen, in `screen` | Standard | `flow`, `world`, `assets` | `scenes:changed` |

**A live switch.** The bundles the next scene names are warmed first, so its first frame uploads
none of them. With a drawing renderer the next scene is then built aside, over the next frames,
within `buildMs` of each frame, and swapped in one frame. Until the swap `current()` answers the
old scene, nothing of the new one is drawn or hit, and the gate stays closed. So the first tap lands
on a complete scene. A fast walk, a world that is not live and a headless app mount in one block.

**The leave look.** Over the scene being left, a live switch shows a veil, and a loader once the
switch is not done `afterMs` after its start. The loader is the engine's ring, a game texture, or a
projection the scene declares. A scene's `leave` is merged over the config field by field; `false`
turns a part or the whole off. The scene being entered may set the veil colour with `enter`.

A rest node with no `scene` keeps the mounted scene. A restore into it does too.

## Config

`pluginConfigs.scenes`.

| Option | Type | Default | Description |
|---|---|---|---|
| `buildMs` | `number \| "auto"` | `"auto"` | Milliseconds per frame the next scene's build may take. `"auto"`: two thirds of the frame interval. `0` throws. |
| `leave` | `Scenes.SceneLeave \| false` | `{ cover: { color: 0x000000, alpha: 0.45, inMs: 50, outMs: 150 }, loader: { afterMs: 400 } }` | What a live switch shows over the scene being left. |

## API

Mounted at `app.scenes`, reachable with `ctx.require(scenesPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `current` | `() => string \| undefined` | The id of the mounted scene. |
| `expect` | `(id: string) => void` | Names the scene the next node without its own `scene` mounts. The restore door calls it. An unknown id throws. |

`defineScene(id, spec)` is the helper. Its spec: `bundle`, `bundles?: (state) => BundleKey[]`,
`layers`, `projections`, `music?`, `leave?`, `enter?`. The `defineScene` of `defineGame` checks
the keys against the game's assets and bundles.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `scenes:changed` | `{ from: string \| undefined; to: string; music: string \| undefined }` | The scene switched, at the swap. `audio` plays the scene's `music` on it. |

### Listens to

The `onEnter` stages of `flow`: `"begin"` for the veil, `"scene"` for the switch.

## Example

```ts file="board.ts" check
import { createApp, defineFeature, defineGame, screen, type } from "@moku-labs/game";

type Player = { items: { id: string }[] };

const { defineNode, defineScene, projection } = defineGame<{
  player: Player;
  session: { episode: string };
  assets: string;
  strings: Record<string, unknown>;
}>();

const boardItems = projection({
  name: "board.items",
  layer: "items",
  from: player => player.items,
  key: item => item.id,
  view: () => []
});

export const boardScene = defineScene("board", {
  bundle: "board",
  layers: { cells: {}, items: { sort: "y" } },
  projections: [boardItems],
  music: "board.theme"
});

// A scene whose art depends on the session: mounted once "location" and the episode are in.
export const wardScene = defineScene("ward", {
  bundle: "location",
  bundles: ({ session }) => [session.episode],
  layers: { room: {} },
  projections: []
});

// A node names its scene; the runner switches before the node runs.
export const awaitIntent = defineNode({ scene: "board", rest: true, outcomes: { merge: type() } });

const app = createApp({
  plugins: [...screen, defineFeature("board", { projections: [boardItems], scenes: [boardScene, wardScene] })],
  pluginConfigs: { scenes: { buildMs: 3 } }
});
app.scenes.current();
```

:::gotchas
- **Every way in waits for the bundles.** A live entry, a restore and the `safeNode` recovery wait for all of `bundles(state)` before the gate opens.
- **A loader projection gets a layer of its own.** No other projection of the scene may draw there.
- **`buildMs: 0` throws.** Use `leave: false` to drop the look, not the build budget.
:::

## Related

- [Screens](/docs/game/guides/screens/): scenes, layers and the JSX views.
- [assets](/docs/game/plugins/assets/): the bundles a scene names.
- [audio](/docs/game/plugins/audio/): the scene's music.
