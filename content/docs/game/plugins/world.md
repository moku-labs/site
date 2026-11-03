---
title: world
description: "Screen. A small ECS of its own, and projections that turn committed state into entities."
section: Plugins
order: 25
---

## What it does

`world` holds two modules. `ecs` is a zero-dependency entity component system: entities,
components, tags, resources and systems. `projection` turns committed state into entities: a
keyed reconcile of one `view(item)` function per projection, with motions, a despawn queue and
named layers.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| screen, in `screen` | Very Complex | `time`, `model`, `flow` | `world:reconciled` |

The screen never owns state. A projection reads the committed `player` and `session` through its
`from`, keys every item, and calls `view(item)` for the components of its entity. A commit
reconciles the views: new keys enter, gone keys exit, changed items change. Motion hooks are told
why they play: `"mount"` when the view comes or goes with its screen, `"change"` for a commit.

**When a system runs.** A system runs once a frame in its phase (`input`, `animate`, `layout` or
`sync`). It is skipped while a term of its query has no entity. With `scenes: [...]` it runs only
while one of those scenes is mounted or leaving.

**Resources.** `resource(name, defaults)` clones plain JSON defaults into every world.
`resource(name, () => value)` calls the factory once per world, so the value may hold a `Map`. The
engine resource `Now` holds the frame's moment: `world` writes `clock.now()` into it first thing in
every frame. The names `Now`, `Pointer`, `AnimPlayer` and `UiCounters` are the engine's.

## Config

`pluginConfigs.world`.

| Option | Type | Default | Description |
|---|---|---|---|
| `settleMs` | `number` | `350` | Length of the built-in settle motion, in game milliseconds. |
| `reconciledEvent` | `boolean` | `false` | Emit `world:reconciled` after every reconcile. For tests and the editor. |

## API

Mounted at `app.world`, reachable with `ctx.require(worldPlugin)`.

### ecs

| Method | Signature | Description |
|---|---|---|
| `ecs.spawn` | `(owner: World.Owner, components) => World.Entity` | Creates an entity. The id is returned at once. |
| `ecs.despawn` | `(entity) => void` | Removes every component and frees the index. A stale id is a no-op. |
| `ecs.get`, `ecs.set` | `(entity, Component)`, `(entity, Component, patch) => void` | Reads a value; shallow-merges a patch and marks the entity changed. |
| `ecs.add`, `ecs.remove`, `ecs.has` | `(entity, value)`, `(entity, Component)` | Structural changes and the check. |
| `ecs.tag`, `ecs.untag` | `(entity, Tag) => void` | Tags are idempotent. |
| `ecs.query` | `(...terms) => Iterable<[entity, ...values]>` | Walks the store of the first term, deterministic. A `mut()` term marks every yielded entity changed. |
| `ecs.system` | `(definition) => () => void` | Registers a system at the end of its phase list. |
| `ecs.resource` | `(Resource) => value` | The one mutable value of a resource. |
| `ecs.onAdded`, `ecs.onRemoved` | `(Component, fn) => () => void` | Listen to structural changes. |
| `ecs.changed` | `(Component) => Iterable<World.Entity>` | The change set of the frame, cleared in `signals`. |
| `ecs.mode`, `ecs.setMode` | `() => "live" \| "paused" \| "fast"` | The world mode. `"fast"` finishes every motion at once. |
| `ecs.setScene` | `(scene: string) => void` | Which scene is mounted, for the systems that list `scenes`. Called by `scenes`. |
| `ecs.count` | `() => number` | How many entities live now. |
| `ecs.snapshot` | `() => World.WorldSnapshot` | The world as plain JSON, sorted by entity index. |
| `ecs.diff` | `(from: number, to: number) => World.FrameDiff` | What changed between two frames. Dev builds only, last 120 frames. |
| `ecs.schema` | `() => readonly World.ComponentSchema[]` | Every component and tag type the world met. |

### projection

| Method | Signature | Description |
|---|---|---|
| `projection.register`, `projection.replace` | `(spec) => void` | Stores a spec; swaps the spec of a registered one (the dev hot swap). |
| `projection.setLayers`, `projection.layers` | `(list: readonly LayerSpec[]) => void` | The layer list of the scene, in draw order. |
| `projection.mount`, `projection.unmount` | `(names: readonly string[], owner)`, `(names)` | Mounts projections and reconciles them at once. |
| `projection.settle` | `(entity) => void` | Cancels the view's motions and brings it home. |
| `projection.keyOf` | `(entity) => { projection; key } \| undefined` | The projection and key of a view. |
| `projection.entityOf` | `(projection: string, key: string) => World.Entity \| undefined` | The entity of one key. |
| `projection.entitiesOf` | `(name: string) => readonly World.Entity[]` | The live views of a mounted projection, in key order. |
| `projection.causeOf` | `(entity) => "mount" \| "change" \| "discard" \| undefined` | How a view came, or how it is leaving. |
| `projection.feed` | `(name: string, sw: SceneSwitch) => void` | Hands a projection the scene switch its `from` reads as its third argument. |

Also on `projection`: `hold`, `show`, `mute`, `lift`, `membershipVersion`, `motionsOf`, `restOf`,
`setDriver`, `viewOf`, `setRest`, `registerKey`, `onConverged`, `rerunAll`, and the scene build
`build`, `built`, `commit`, `discard`, `left`, `isBuilding`, `onBuild`, `adopt`. Plugins above
`world` use them; a game rarely does. `app.world.systemTimes()` gives the time of each system in an
agent build.

## Helpers

From `@moku-labs/game`: `component`, `tag`, `resource`, `mut`, `system`, `projection`, and the
engine's `Layer`, `Order`, `Exiting`, `Tree`, `Now`. `defineGame` returns a `projection` and a
`system` typed by the game's `player` and `session`. Signatures are on the
[API reference](/docs/game/api/#world).

A projection spec: `name`, `layer`, `lift?`, `from(player, session, sw?)`, `key(item)`,
`view(item)`, the motion hooks `enter`, `exit`, `change` and `loop`, and `initialOnly`: fields the
view gives once, at birth, and another writer owns after that.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `world:reconciled` | `{ mode, projections, entered, changed, exited, revived, queued, hintsRouted, hintsDropped }` | After every reconcile, only with `reconciledEvent`. |

### Listens to

The commits of `model`.

## Example

```ts file="board.ts" check
import { component, createApp, defineFeature, mut, projection, system, Transform, worldPlugin } from "@moku-labs/game";

type Player = { items: { id: string; x: number; y: number }[] };

// A component of the game: a name and plain defaults.
const Spin = component("Spin", { speed: 1 });

// Committed state to entities: one view per item, keyed by its id.
const boardItems = projection({
  name: "board.items",
  layer: "items",
  from: (player: Player) => player.items,
  key: item => item.id,
  view: item => [Transform({ x: item.x, y: item.y }), Spin({ speed: 2 })]
});

// A system runs once a frame in its phase while its query has an entity.
const spin = system({
  name: "board.spin",
  phase: "animate",
  query: [mut(Transform), Spin],
  run: (entities, ctx) => {
    for (const [, transform, { speed }] of entities) transform.rotation += (speed * ctx.time.delta) / 1000;
  }
});

const boardFeature = defineFeature("board", { projections: [boardItems], systems: [spin] });
const app = createApp({ plugins: [worldPlugin, boardFeature] });

// A test drives the screen without a browser: layers, mount, then look a view up by key.
app.world.projection.setLayers([{ name: "items", sort: "y" }]);
app.world.projection.mount(["board.items"], { kind: "plugin", name: "test" });
app.world.projection.entityOf("board.items", "i7");
```

:::gotchas
- **A system cannot `require` a plugin.** It reads the world, resources, the frozen snapshot and `Time` from its context. To play an animation it uses the resource `AnimPlayer`.
- **Work outside the rows goes to a system with `query: []`.** A system with a query does not run while its query is empty.
- **A component changed in place is not seen.** Write with `ecs.set`, or query it with `mut()`.
- **Look an element up again after a restore.** Every view is built again on its rest pose.
:::

## Related

- [Screens](/docs/game/guides/screens/): projections, scenes and JSX.
- [renderer](/docs/game/plugins/renderer/): draws what the world holds.
- [anim](/docs/game/plugins/anim/): the motions of the views.
