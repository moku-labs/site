---
title: Nodes & flows
description: "defineNode and defineFlow: outcomes, edge tables, sub-flows, slots, the gate and the inbox."
section: Guides
order: 10
full: true
---

## The kit

`defineNode` and `defineFlow` are not root exports. `defineGame<Types>()` returns them, typed by
the game's `player` and `session`, so the compiler checks every write and every edge. A game binds
the kit once, in `state.ts` or `core/kit.ts`, and every node file imports it.

```ts file="state.ts" check
import { defineGame } from "@moku-labs/game";

export type Player = { coins: number; lastRoll: number };
export type Session = { rolls: number };

export const { defineNode, defineFlow, defineFeature } = defineGame<{
  player: Player;
  session: Session;
  assets: string; // [!note] The asset keys. `moku-game keys` writes the precise union; see Assets.
  strings: Record<string, unknown>; // [!note] The string table. The generated `Strings` type makes a wrong key a compile error.
}>();
```

## defineNode

| Key | What |
|---|---|
| `outcomes` | Required. `{ done: type(), failed: type<{ reason: string }>() }`: one type tag per outcome. |
| `input` | `type<Input>()`: the payload the node takes from the edge that led to it. |
| `run` | The body. Required unless `rest: true`. Returns `out.<outcome>(payload)`. |
| `rest` | `true`: the graph waits here. |
| `checkpoint` | On a rest node: the journal is compacted here. |
| `barrier` | The save is written durably after this node. Every edge of a barrier leads to a rest node of the same flow. |
| `inbox` | Outcome names of a rest node that a world event of the same `type` may produce. |
| `over` | Entering the node waits while a pointer is down, so a popup never opens in the middle of a drag. |
| `scene` | The id of the scene this node is shown on. Without it the node keeps the current scene. |
| `guide` | On a rest node: the tutorial step, derived from the committed state. |
| `recover` | On a rest node: what it writes when the runner enters it as `safeNode` after a failure. |

`type<Payload>()` is a type tag: it carries the payload type and nothing else. A node without
`input` accepts any payload. An edge's payload must fit the input of its target.

## defineFlow

| Key | What |
|---|---|
| `nodes` | A node, a sub-flow or a slot per name. |
| `start` | A node whose input accepts the flow input. |
| `edges` | `edges[node][outcome] = target`. One entry per outcome of every node. |
| `input` | `type<Input>()` of the flow. |
| `outcomes` | Declare them to use the flow as a node of another flow. |

An edge target is a node name, `exit("outcome")` to leave a sub-flow, or `to("node", mapper)` to
adapt the payload. Annotate the mapper's parameter type yourself.

## Sub-flows and slots

A flow with `outcomes` is a node of another flow. A slot is a node that features fill.

```ts file="flows/main.ts" check
import { exit, slot, to, type } from "@moku-labs/game";
import { defineFlow, defineNode } from "../state";

const pick = defineNode({ outcomes: { picked: type<{ face: number }>(), back: type() }, rest: true });
const apply = defineNode({
  input: type<{ value: number }>(),
  outcomes: { done: type() },
  run: ({ input, player, out }) => {
    player.coins += input.value;
    return out.done();
  }
});

export const bonusFlow = defineFlow("bonus", {
  nodes: { pick, apply },
  start: "pick",
  outcomes: { finished: type(), left: type() }, // [!note] With `outcomes`, the flow is a node of another flow.
  edges: {
    pick: { picked: to("apply", (payload: { face: number }) => ({ value: payload.face * 2 })), back: exit("left") },
    apply: { done: exit("finished") }
  }
});

const lobby = defineNode({ outcomes: { bonus: type() }, rest: true, checkpoint: true });

export const main = defineFlow("main", {
  nodes: { lobby, bonus: bonusFlow, afterBonus: slot("afterBonus") }, // [!note] A slot is a node with the outcome `done`. Features contribute sub-flows to it.
  start: "lobby",
  edges: {
    lobby: { bonus: "bonus" },
    bonus: { finished: "afterBonus", left: "lobby" },
    afterBonus: { done: "lobby" }
  }
});
```

The paths here read `"lobby"`, `"bonus/pick"` and `"afterBonus/…"`: node names joined by `/`.

A slot may declare outcomes besides `done`: `slot("name", { shop: type<{ tab: string }>() })`. The
flow that holds it gives each one an edge. Contributions run in `order`; one that exits a declared
outcome leaves the slot at once with its payload, and the later ones do not run. How a feature
fills a slot is in [Features](/docs/game/guides/features/).

## The gate: player answers

A rest node waits at its gate. `app.flow.gate.answer({ intent, payload? })` is the one entry of
player answers. A pure wait ends with the outcome named by `intent`, and the answer payload becomes
the outcome payload.

| Rule | What happens |
|---|---|
| The gate lists the intent | It takes the answer and returns `true`. |
| The gate does not list it | It drops the answer. |
| The gate is closed | It keeps the refused answer and offers it once to the next gate that opens. |

How long a refused answer is kept is `flow.holdMs`, in milliseconds of game time. `0`, the
default, keeps it for one frame and the first answer wins. Above `0` the last answer wins and it is
dropped when older than `holdMs`. `Infinity` keeps it until the next gate opens. The gate keeps one
answer, never a queue.

`app.flow.gate.state()` answers `{ open, allowed, narrowed, blocked? }`.

## Effects that take answers

An awaited effect may open the gate for its own answers. The node waits, and the promise resolves
with the answer the player gave.

```ts file="nodes/confirm-reset.ts" check
import { type } from "@moku-labs/game";
import { defineNode } from "../state";

export const confirmReset = defineNode({
  outcomes: { yes: type(), no: type() },
  over: true,
  run: async ({ fx, out }) => {
    const answer = (await fx({ kind: "popup", payload: { name: "reset" }, answers: ["yes", "no"] })) as { // [!note] A descriptor written by hand resolves `unknown`. `popup(Component, props)` is typed by the component.
      intent: string;
    };

    return answer.intent === "yes" ? out.yes() : out.no();
  }
});
```

`popup(Component, props)` from the kit builds that descriptor from a component with `outcomes`; its
result is typed, so comparing it with an intent the component does not declare is a compile error.
See [Screens](/docs/game/guides/screens/).

## The inbox: world events

`app.flow.inbox.post({ type, payload? })` queues a world event, one entry per type. It is delivered
only to a rest node whose `inbox` lists the type. The event payload becomes the outcome payload.
The clock posts `elapsed` this way; `assets` posts `ready`.

## Tutorial steps

A tutorial step is data. A rest node derives it from the committed state with `guide`, so no save
field and no `run` holds it.

```ts file="tutorial.ts" check
import { defineGame, type } from "@moku-labs/game";

const { defineNode } = defineGame<{
  player: { board: string[] };
  session: { tutorial: number };
  assets: string;
  strings: Record<string, unknown>;
}>();

export const awaitIntent = defineNode({
  rest: true,
  outcomes: { merge: type<{ from: string; to: string }>(), tutorialBlocked: type() },
  guide: ({ session }) =>
    session.tutorial === 2
      ? {
          allow: { intent: "merge", payload: { from: "c2", to: "c3" } }, // [!note] While the guide stands, the gate takes only this answer and `blocked`.
          target: [{ projection: "board.items", key: "c2" }, { projection: "board.items", key: "c3" }],
          pad: 8,
          blocked: { intent: "tutorialBlocked" } // [!note] A press outside the window answers this outcome instead.
        }
      : undefined
});
```

`guide` runs when the node is entered and again after a commit while it waits. An equal result
changes nothing, `undefined` lifts the guide, and leaving the node removes it. `ui` draws a veil
around the targets and locks input outside them. `await fx(guide({ allow: { intent: "roll" } }))`
in a body still works, with the same options.

## Checked at run()

The compiler checks the edge table. `flow.run()` checks the rest:

- The start node is in `nodes`, and every node is reachable from it.
- A cycle needs at least one rest node. A slot never counts as one.
- Every `inbox` type is an outcome of its node. A rest node has outcomes or a `run` body.
- Flow ids are unique. A feature name is neither a flow id nor a plugin name.
- `safeNode` is the path of a checkpoint node.
- `recover` is allowed on a rest node only.
- A flow above 15 nodes is a warning: split it into sub-flows of 7 to 15 nodes.

:::gotchas
- **`defineNode` and `defineFlow` come from the kit.** `import { defineNode } from "@moku-labs/game"` does not exist.
- **No `setTimeout` in a node.** Store the due moment in `player`, `await fx(schedule(moment))`, and wait for `elapsed` at a rest node with `inbox: ["elapsed"]`.
- **State is plain JSON.** No class, no `Map`, no `Date`, no `undefined` values in the trees.
- **A node never calls the app.** Not `app.model`, not `app.clock`, not `app.time`. Everything outside the logic goes through `fx`.
- **Keep rules pure.** `(state, input, tables) => result`: the node calls the rule and writes the result into the draft.
:::

## Related

- [How it works](/docs/game/how-it-works/): commits, rollback, effects, modes.
- [Features](/docs/game/guides/features/): contributions to a slot, sub-features.
- [flow plugin](/docs/game/plugins/flow/): the runner API, events and config.
