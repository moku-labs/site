---
title: State & save
description: "The player and session trees, rng streams, the save provider, migrations, bookmarks and scenarios."
section: Guides
order: 14
---

## Two trees

The game's state is two plain JSON trees. Node path, input and these trees describe the whole
game, so a position is data you can save, restore and replay.

| Tree | Lives | Saved |
|---|---|---|
| `player` | Across runs. | Yes, with the `rng` streams: the save document is `{ player, rng }`. |
| `session` | One run. It starts from the definition's `session` at every start. | Never. |

State is plain JSON only: no class, no `Map`, no `Date`, no `undefined` values. A node changes it
through the `player` and `session` drafts of its context, and nothing else does.

## Read committed state

The page, a test or a game plugin reads `app.model.store.snapshot()`: the committed
`{ player, session, rng }`, frozen. `game.headless()` and `game.screen()` type it by the game's own
player and session. A node never calls the model; it gets drafts.

`model:committed` fires on every change, with `roots` (`"player"`, `"session"`, `"rng"`) and a
`cause`: `"edge"`, `"rollback"`, `"restore"` or `"load"`.

## Transactions and rest points

| Moment | What the runner does |
|---|---|
| A node starts | Opens one transaction. The node writes drafts. |
| The node returns an outcome | Commits the drafts on the edge and writes a journal entry. |
| The node throws | Discards the drafts and rolls back to the last rest point. |
| A rest node is entered | `markRest()`: the save provider gets the patches. |
| A `barrier` node is left | `markBarrier(txId)`: a durable write. Rollback cannot cross it. |
| A `checkpoint` is entered | The journal is compacted. `flow.journalLimit`, 500, caps it in between. |

## Randomness

`rng.stream(id)` in a node gives a deterministic stream. Use one id per source, such as
`"chest:42"`. Stream state is part of the save, so a draw commits and rolls back with its
transaction.

| Method | Gives |
|---|---|
| `int(maxExclusive)` | An integer below the bound. |
| `range(min, maxInclusive)` | An integer in the range. |
| `pick(items)` | One item. |
| `weighted(table)` | One entry of `{ weight: number }` entries. |
| `chance(numerator, denominator)` | `true` with that chance. |

A new save gets the seed of the definition, `seed: 42` by default. `game.headless({ seed: 7 })`
pins another for a test. `app.model.rng.peek(id)` answers a stream's state, `undefined` for a
stream never drawn from.

## Where the save lives

The page picks the save from `config.ts`:

| `save` | Where the player lives |
|---|---|
| `"memory"` | In memory, for this page only. The default. |
| `"local"` | `localStorage`, under `<native.identifier>:save`, or `moku-game:save` without `native`. Where storage is refused, a memory save and a warning. |
| `"store"` | The system store: idb on the web, the Tauri store in the native app. Needs `@moku-labs/system`. |

A store save that cannot be read rejects the load. The game never starts over a real save as a new
player.

Under the page is one seam, `Model.PlayerStateProvider`:

| Member | What |
|---|---|
| `load()` | `{ state, version }`, or `null` for a new player. |
| `commit(patches, version)` | The patches of a rest point. |
| `commitDurable(patches, txId, version)` | The durable write of a barrier. |
| `flush()` | Writes what is pending. The page calls it on `pagehide`. |

Tests get `memory()` from `@moku-labs/game/testing`: an in-memory provider that records every call.
`storeSave(store, key, report)` of `@moku-labs/game/app/system` is the provider over a system
store. See [Native](/docs/game/guides/native/).

## Migrations

The save carries a version. `model.schemaVersion` is the version this build writes, 1 by default.
`model.migrations` is the ordered chain: the `up` of `from: n` produces version `n + 1`, and works
on the whole save document.

```ts file="index.ts" check
import type { Model } from "@moku-labs/game";
import { defineGameApp } from "@moku-labs/game/app";
import { mainFlow } from "./flow";

const addLastRoll: Model.Migration = {
  from: 1,
  up: save => {
    const document = save as { player: { coins: number }; rng: Model.Json }; // [!note] `up` gets the whole document, `{ player, rng }`, as JSON.
    return { ...document, player: { ...document.player, lastRoll: 0 } };
  }
};

export default defineGameApp({
  flow: mainFlow,
  safeNode: "home",
  player: { coins: 0, lastRoll: 0 },
  session: { rolls: 0 },
  pluginConfigs: { model: { schemaVersion: 2, migrations: [addLastRoll] } } // [!note] The game keeps `schemaVersion` and `migrations`. The shell writes the provider, the seed and the starting state.
});
```

`load()` hands a migrated save, or a new player, to the provider at once, before the first node
runs. A save at the current version produces no commit.

`flow.run()` rejects with `SaveUnreadableError` when the save is newer than the build, a step of the
chain is missing, a step throws or the shape is wrong. The error carries `savedVersion` and
`schemaVersion`.

## Bookmarks

`app.flow.bookmark()` is the position as serialisable data: `{ path, input, player, session, rng,
graph }`. `app.flow.restore(bookmark)` brings it back on a running graph.

```ts file="tests/bookmark.test.ts" check
import { createHeadless } from "@moku-labs/game/testing";
import { expect, it } from "vitest";
import game from "../index";

it("restores the coins of a bookmark", async () => {
  const { app } = game.headless({ seed: 7 });
  const run = await createHeadless(app);

  await run.walk([{ at: "home", intent: "roll" }]);
  const mark = app.flow.bookmark(); // [!note] Plain JSON: store it, send it, restore it later.
  const coins = app.model.store.snapshot().player.coins;

  await run.walk([{ at: "home", intent: "reset" }]);
  await app.flow.restore(mark);

  expect(app.model.store.snapshot().player.coins).toBe(coins);
  await run.stop();
});
```

- A rest checkpoint is always accepted. Any other node only when the graph did not change since
  the bookmark.
- A bookmark taken while a popup waits names the waiting transit node and carries `rest`, the rest
  point before it. Restoring it runs that node again from its start.
- After a restore the picture is the one of the restored state: views stand on their rest pose and
  every ui root is built again.

## Scenarios

A scenario is a prepared save. `tests/scenarios/<name>.ts` default-exports a `Scenario<Player>`:
a function of the device time that returns `{ player, session? }`. On the dev page,
`?player=<name>` starts from it on a fresh memory save, never on the stored one.

```ts file="tests/scenarios/rich.ts" check
import type { Scenario } from "@moku-labs/game/app";
import type { Player } from "../../state";

const rich: Scenario<Player> = () => ({ player: { coins: 500, lastRoll: 6 } }); // [!note] It gets the device time, so a stored timer can be due already.

export default rich;
```

A test starts from the same save: `game.headless({ player: rich(startMoment).player })`, with
`startMoment` from `@moku-labs/game/app`. An unknown name on the page logs `[game] No scenario
"<name>".` and starts from the starting player.

:::gotchas
- **A node never reads the save.** It gets drafts; the page and the tests read `snapshot()`.
- **`session` is not saved.** Anything a reload must keep goes into `player`.
- **Timers are moments.** Store the due moment in `player` and compute what is left from `now`.
- **`seed` belongs to the shell.** `pluginConfigs.model.seed` is a compile error in `defineGameApp`; pass `seed` on the definition or the seam.
:::

## Related

- [model plugin](/docs/game/plugins/model/): the store, rng and provider API.
- [Testing](/docs/game/guides/testing/): `runRepro`, `memory`, `saveOf`.
- [The game shell](/docs/game/guides/game-shell/): `config.ts` and the page.
