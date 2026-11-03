---
title: model
description: "Logic. Player and session state, the save, transactions, rest-point rollback, rng streams and migrations."
section: Plugins
order: 22
---

## What it does

`model` holds the committed state of the game. Two trees: `player`, which is saved, and
`session`, which lives for one run. The save document is `{ player, rng }`. The plugin has two
modules: `store` and `rng`.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| logic, in every app | Very Complex | nothing | `model:committed` |

A game does not write to the model. The [flow](/docs/game/plugins/flow/) runner opens one
transaction per node run, the node changes its drafts of `player` and `session`, and the runner
commits them on the edge. A node that throws changes nothing. A game reads
`app.model.store.snapshot()`; the runner calls the rest.

**Rest points.** Entering a rest node calls `store.markRest()`: the save provider gets the patches
since the last rest point. Leaving a `barrier` node calls `markBarrier(txId)`: a durable write,
and rollback cannot cross it. `rollback()` returns to the last rest point.

**Randomness.** A node draws from `rng.stream(id)`. Stream state is part of the save, so a draw
commits and rolls back with its transaction.

**Migrations.** A save carries its version. `load()` runs a stored save through the migration
chain up to `schemaVersion`. A new player and a migrated save are handed to the provider at once,
before the first node runs. A save that cannot be read throws `SaveUnreadableError`, with
`savedVersion` and `schemaVersion`: the save is newer, a step is missing, a step throws or the
shape is wrong.

State is plain JSON only: no classes, no `Map`, no `Date`, no `undefined` values.

## Config

`pluginConfigs.model`.

| Option | Type | Default | Description |
|---|---|---|---|
| `playerProvider` | `Model.PlayerStateProvider \| undefined` | `undefined` | The save seam. `undefined`: in memory, nothing is persisted. |
| `initialPlayer` | `Json` | `{}` | Player state of a new player. Deep-cloned. |
| `initialSession` | `Json` | `{}` | Session state at every start. Deep-cloned. |
| `seed` | `"from-save" \| number` | `"from-save"` | `"from-save"`: a new player gets a random seed once. A number fixes it, for tests. |
| `schemaVersion` | `number` | `1` | Version of the save schema this build writes. |
| `migrations` | `readonly Model.Migration[]` | `[]` | Ordered chain. `up` of `from: n` produces version `n + 1`. |

In a game made with `defineGameApp`, the shell owns `playerProvider`, `initialPlayer`,
`initialSession` and `seed`: they come from the definition and the seams, and setting them is a
compile error. The game keeps `schemaVersion` and `migrations`. See
[The game shell](/docs/game/guides/game-shell/).

A provider has four members:

| Member | Signature |
|---|---|
| `load` | `() => Promise<{ state: Json; version: number } \| null>` |
| `commit` | `(patches, version) => void` |
| `commitDurable` | `(patches, txId, version) => Promise<void>` |
| `flush` | `() => Promise<void>` |

`memory()` of `@moku-labs/game/testing` is the in-memory provider of the tests. The page uses
`"memory"`, `"local"` or `"store"` from `config.ts`.

## API

Mounted at `app.model`, reachable with `ctx.require(modelPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `store.load` | `() => Promise<void>` | Loads the save, or starts a new player. Nothing is written until the document is complete. |
| `store.snapshot` | `() => Model.Snapshot` | The committed `{ player, session, rng }`, frozen. The same object while nothing was committed. Before `load()` it shows the initial player. |
| `store.begin` | `() => Model.Transaction` | Opens the drafts of one node run. One at a time. |
| `store.markRest` | `() => void` | Hands the provider everything since the last rest point. |
| `store.markBarrier` | `(txId: string) => Promise<void>` | A durable write. Rollback cannot cross it. |
| `store.rollback` | `() => void` | Returns to the last rest point. Emits `model:committed` with cause `"rollback"`. |
| `store.restore` | `(input: { player; session?; rng?; version? }) => void` | Replaces the trees: a bookmark, a repro. Emits with cause `"restore"`. |
| `store.schemaVersion` | `() => number` | The schema version this build writes. |
| `store.flush` | `() => Promise<void>` | Asks the provider to write what it holds. Called on a background pause and on stop. |
| `rng.peek` | `(id: string) => number \| undefined` | The committed state of one stream, for tools and tests. Never draws. |

The `RngStream` of a node has integer methods only: `int(maxExclusive)`, `range(min, maxInclusive)`,
`pick(items)`, `weighted(table)` with `{ weight }` entries, `chance(numerator, denominator)`.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `model:committed` | `{ roots: readonly ("player" \| "session" \| "rng")[]; cause: "edge" \| "rollback" \| "restore" \| "load" }` | Committed state changed. |

### Listens to

None.

## Example

```ts file="save.ts" check
import { createApp, type Model } from "@moku-labs/game";
import { memory } from "@moku-labs/game/testing";

// Version 2 adds gems to every saved player. `up` works on the whole save document.
const addGems: Model.Migration = {
  from: 1,
  up: save => {
    const document = save as { player: { coins: number }; rng: Model.Json };
    return { ...document, player: { ...document.player, gems: 0 } };
  }
};

const app = createApp({
  pluginConfigs: {
    model: {
      playerProvider: memory(),
      initialPlayer: { coins: 0, gems: 0 },
      initialSession: { rolls: 0 },
      seed: 42,
      schemaVersion: 2,
      migrations: [addGems]
    }
  }
});

app.model.store.snapshot().player; // { coins: 0, gems: 0 }: before load() it shows the initial player
app.model.store.schemaVersion(); // 2
```

:::gotchas
- **A node never calls the model.** It changes `player` and `session` of its context. Everything outside logic goes through `fx`.
- **No `Math.random()`.** Use `rng.stream("some-id")`, one id per source, such as `"chest:42"`.
- **`session` is never saved.** Put what must survive a reload in `player`.
- **Compare by identity.** `snapshot()` returns the same object while nothing was committed.
:::

## Related

- [State and save](/docs/game/guides/state-and-save/): rng, migrations and checkpoints.
- [flow](/docs/game/plugins/flow/): the runner that commits on edges.
- [API reference](/docs/game/api/): `SaveUnreadableError` and the testing helpers.
