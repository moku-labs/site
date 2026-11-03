---
title: How it works
description: "Nodes, edges and commits: the graph moves only on an answer, and the screen draws what it committed."
section: Get started
order: 3
---

## The picture

A rest node waits. A player answer comes through the gate. A world event comes through the inbox.
Nothing else moves the graph.

:::flow
- player answer, world event
- **rest node** waits
- **transit node** works on drafts
- **edge**: commit, journal, `flow:edge`
- **model**: committed state and save
- **screen**: a projection
:::

:::steps
1. **A rest node waits** at its gate. The gate opens for the outcomes the node declares.
2. **An answer arrives**: `app.flow.gate.answer({ intent: "roll" })` from the screen, or a world event posted to the inbox, such as `elapsed` from the clock.
3. **Transit nodes run.** Each one gets drafts of `player` and `session` and returns `out.<outcome>(payload)`.
4. **The edge commits.** The runner commits the drafts, writes a journal entry and emits `flow:edge`.
5. **The screen follows.** Projections read the committed state and redraw. They never write it.
:::

## Nodes

A node is a small function with a plain `await` body. It gets one context object and returns one
outcome. Exactly one node is active.

| Kind | Written as | Does |
|---|---|---|
| Transit node | `run`, no `rest` | Works on drafts and returns an outcome. |
| Rest node | `rest: true` | The graph waits here. Entering it marks a rest point. |
| Pure wait | `rest: true`, no `run` | Ends on a gate answer whose `intent` is an outcome, or a world event whose `type` is in `inbox`. |
| Checkpoint | `checkpoint: true` on a rest node | The journal is compacted here. `safeNode` must be one. |
| Barrier | `barrier: true` | After its edge the save is written durably. Rollback cannot cross it. |

The context a node gets:

| Field | What |
|---|---|
| `input` | The payload of the edge that led here. |
| `player` | A draft of the saved player tree. Mutate it. |
| `session` | A draft of the session tree, never saved. |
| `rng` | `rng.stream(id)` gives a deterministic stream. |
| `fx` | `await fx(descriptor)`, `fx.start(descriptor)`, `fx.emit(hint(...))`. |
| `out` | One method per declared outcome. |
| `signal` | Aborted on stop, on restore and on an inbox delivery. |
| `now` | `clock.now()`, read once at node entry. |

## Flows and edges

A flow is an id, a `nodes` table, a `start` node and an `edges` table, with one entry per outcome
of every node. The compiler checks the table.

| Edge target | Means |
|---|---|
| `"node"` | Go to that node of the same flow. |
| `exit("outcome")` | Leave a sub-flow with that outcome. |
| `to("node", payload => input)` | Go to that node, adapting the payload to its input. |

A flow that declares `outcomes` is a node of another flow: a sub-flow. A slot, `slot("name")`, is a
node that features contribute sub-flows to. The path of the active node joins node names with `/`
through sub-flows and slots: `"home"`, `"board/awaitIntent"`, `"afterBonus/thanks"`. The
[Nodes & flows](/docs/game/guides/nodes-and-flows/) guide has them in full.

## Commits on edges

The runner opens one model transaction per node run and commits it on the edge. A node that throws
changes nothing.

- **A transition is a transaction.** Rest node to rest node. On an error the runner discards the
  drafts, rolls back to the last rest point, retries `retries` times (1 by default), then enters
  `safeNode`. A failure inside `safeNode` rejects `run()`.
- **Every failure is logged.** An `error` entry `flow:error` with `{ path, rolledBackTo, retry,
  error }`. Read it with `app.log.trace()`.
- **Saving follows the rest points.** Entering a rest node calls `model.store.markRest()`: the save
  provider gets the patches. Leaving a `barrier` node writes durably.
- **`recover`** on a rest node runs only when the runner gave up and enters it as `safeNode`. What it
  writes commits as one edge with the outcome `recover`.

```ts file="nodes.ts" check
import { type } from "@moku-labs/game";
import { defineNode } from "./state";

export const home = defineNode({
  outcomes: { roll: type(), reset: type() },
  rest: true,
  checkpoint: true,
  recover: ({ player }) => {
    player.lastRoll = 0; // [!note] Runs only on the way into the safe node after a failed retry. Commits as the outcome `recover`.
  }
});
```

## Effects

A node never calls `app.model`, `app.clock` or `app.time`. Everything outside the logic goes
through `fx`.

| Form | The node | A failure |
|---|---|---|
| `await fx(descriptor)` | Waits for the result. | Fails the node, unless the effect is cosmetic. |
| `fx.start(descriptor)` | Goes on at once. Write it in place of `void fx(...)`. | The log entry `flow:fx-start-failed`. |
| `fx.emit(hint(kind, payload))` | Goes on. Released after the commit of the edge. | Dropped in fast mode. |

A cosmetic descriptor (`sfx`, `play`, `haptic`, `music`) that fails is a warn entry
`flow:fx-cosmetic-failed` and resolves `undefined`. An awaited effect without a handler resolves
`undefined` at once, so the same node runs headless.

The runner has two modes. In `"live"` effects run as written. In `"fast"`, the mode of a headless
test, effects answer at once, hints are dropped and only `runInFast` handlers run. All node logic
runs for real in both.

## Time and randomness

Time is an input. Randomness is a saved stream.

```ts file="timer.ts" check
import { hint, schedule, type } from "@moku-labs/game";
import { defineNode } from "./state";

export const arm = defineNode({
  outcomes: { armed: type() },
  run: async ({ now, fx, out }) => {
    await fx(schedule(now + 60_000)); // [!note] Asks the clock for one `elapsed` at that moment. No `setTimeout`.
    fx.emit(hint("sparkle", { target: "dice" }));
    return out.armed();
  }
});

export const waiting = defineNode({
  outcomes: { elapsed: type<{ now: number }>(), skip: type() },
  rest: true,
  inbox: ["elapsed"] // [!note] The world event `elapsed` ends this wait as the outcome `elapsed`.
});
```

- `now` is `clock.now()` read once at node entry. A timer is a moment stored in the player; how long
  is left is computed from `now`.
- `rng.stream("chest:42")` is one stream per source. Its methods are integers only: `int`, `range`,
  `pick`, `weighted`, `chance`. A draw commits and rolls back with its transaction.
- The clock posts `{ type: "elapsed", payload: { now } }` into the inbox when the moment arrives and
  when the game resumes.

## The screen is a projection

Rendering reads committed state and never owns it. A projection maps the committed `player` and
`session` to views; `ui` lays out the ones whose `view` returns JSX. Without a document the screen
plugins are inert, so the same app starts in plain Bun.

Only answers go the other way. A button names an `intent`, a gesture names one, and the gate takes
it when the resting node lists it. See [Screens](/docs/game/guides/screens/).

## What `run()` checks

- Every outcome of every node has an edge. Every edge names a node of the same flow or a declared flow outcome.
- The start node is in `nodes`, and every node is reachable from it.
- A cycle needs at least one rest node.
- Every `inbox` type is an outcome of its node.
- Every edge of a `barrier` node leads to a rest node of the same flow.
- Flow ids are unique. A feature name is not a flow id and not a plugin name.
- Two contributions of one slot need different `order` values.
- `safeNode` is the path of a checkpoint node.
- A flow above 15 nodes is a warning. Split it into sub-flows of 7 to 15 nodes.

## The plugins in order

The logic plugins are registered first: `time`, `lifecycle`, `model`, `clock`, `flow`. The list
`screen` follows: `world`, `renderer`, `input`, `assets`, `scenes`, `anim`, `i18n`, `text`, `ui`.
Then the opt-in `effects`, `audio` and `platform`, `platform` last. `game.screen()` composes all of
them for you; `game.headless()` composes the logic plugins only.

A game plugin listens to the graph through events:

```ts file="plugins/edge-log.ts" check
import { createPlugin, flowPlugin } from "@moku-labs/game";

export const edgeLog = createPlugin("edgeLog", {
  depends: [flowPlugin],
  hooks: ctx => ({
    "flow:edge": payload => {
      ctx.log.info("edge", { node: payload.node, outcome: payload.outcome }); // [!note] `flow:edge` fires after the commit of every edge.
    }
  })
});
```

## Related

- [flow plugin](/docs/game/plugins/flow/): the runner, the gate, the inbox and their API.
- [model plugin](/docs/game/plugins/model/): transactions, rest points, the save.
- [State & save](/docs/game/guides/state-and-save/): the player, migrations, bookmarks.
