---
title: flow
description: "Logic. The graph: the runner, the gate for player answers, the inbox for world events, the effects gateway, the features registry."
section: Plugins
order: 24
---

## What it does

`flow` runs the game as a graph. Exactly one node is active. A rest node waits; a player answer
comes through the **gate**, a world event through the **inbox**. Nothing else moves the graph.
The runner opens one [model](/docs/game/plugins/model/) transaction per node run and commits it
on the edge. A node that throws changes nothing: the runner rolls back to the last rest point,
retries, then enters `safeNode`.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| logic, in every app | Very Complex | `time`, `lifecycle`, `model`, `clock` | `flow:edge`, `flow:rest`, `flow:error` |

Five modules: `runner` (its methods sit on the plugin root), `gate`, `inbox`, `fx` and
`features`.

**Effects.** A node runs an effect three ways. `await fx(descriptor)` waits for it.
`fx.start(descriptor)` starts it and goes on. `fx.emit(hint(...))` is released after the commit
of the edge and dropped in fast mode. One plugin owns each effect kind with `fx.handle`. An
awaited effect without a handler resolves `undefined` at once, so the same node runs headless.

**Modes.** `"live"` and `"fast"`. In fast mode effects answer at once, hints are dropped and only
`runInFast` handlers run. All node logic runs for real.

**Graph rules checked at `run()`.** Every outcome has an edge. Every node is reachable from the
start. A cycle needs a rest node. Every `inbox` type is an outcome of its node. Flow ids are unique,
and a feature name is neither a flow id nor a plugin name. `safeNode` is the path of a checkpoint.
A flow above 15 nodes is a warning.

The node, flow, slot and feature helpers are on the [Nodes and flows](/docs/game/guides/nodes-and-flows/)
and [Features](/docs/game/guides/features/) pages.

## Config

`pluginConfigs.flow`.

| Option | Type | Default | Description |
|---|---|---|---|
| `mainFlow` | `AnyFlow \| undefined` | `undefined` | The top-level flow. Required before `run()`. |
| `safeNode` | `string \| undefined` | `undefined` | Path of the checkpoint entered after a failed retry. `undefined`: the start of the main flow. |
| `retries` | `number` | `1` | Retries of a failed transition before `safeNode`. |
| `settleTimeoutMs` | `number` | `2000` | How long `onStop` waits for the active node to settle, in real milliseconds. |
| `journalLimit` | `number` | `500` | Journal entries kept between checkpoints. |
| `holdMs` | `number` | `0` | How long an answer a closed gate refused is kept, in game milliseconds. `0`: one frame, the first answer wins. Above `0`: the last answer wins. `Infinity`: until the next gate opens. |

In a game made with `defineGameApp`, `mainFlow` and `safeNode` come from the definition's `flow`
and `safeNode`.

## API

Mounted at `app.flow`, reachable with `ctx.require(flowPlugin)`.

### Runner

| Method | Signature | Description |
|---|---|---|
| `run` | `() => Promise<void>` | Validates the graph, loads the save and runs the loop until stop. A fatal error rejects. |
| `onEnter` | `(stage: "begin" \| "load" \| "scene", callback) => () => void` | A callback run before every node body. Stages run in that order, each awaited. |
| `walk` | `(route: readonly Flow.RouteStep[], options?: { from?: Flow.Bookmark }) => Promise<Flow.FlowState>` | Walks a route in fast mode through the running loop. |
| `bookmark` | `() => Flow.Bookmark` | Where the graph stands: the last rest node and the committed state. Serialisable. |
| `restore` | `(bookmark: Flow.Bookmark) => Promise<void>` | Replaces the state and enters the bookmark's node. Needs a running graph. |
| `describe` | `() => Flow.FlowGraph` | The whole graph as JSON. Works before `run()`. |
| `state` | `() => Flow.FlowState` | `{ running, path, stack, pending: { fx?, gate? }, mode }`. Frozen, the same object while the graph did not move. |
| `history` | `() => readonly Flow.JournalEntry[]` | The edges since the last checkpoint. |
| `setMode` | `(mode: "live" \| "fast") => void` | Legal before `run()` and while the graph rests. |

### Gate, inbox, fx, features

| Method | Signature | Description |
|---|---|---|
| `gate.answer` | `(answer: { intent: string; payload?: Json }) => boolean` | The one entry of player answers. A closed gate holds a refused answer for the next gate. |
| `gate.pointer` | `(active: boolean) => void` | A pointer is down. Entering an `over` node waits while it is. |
| `gate.state` | `() => { open; allowed; narrowed; blocked? }` | What the gate takes right now. |
| `inbox.post` | `(event: { type: string; payload?: Json }) => void` | Queues one world event, one per type. Delivered to a rest node whose `inbox` lists the type. |
| `fx.handle` | `(kind: string, handler, options?: { runInFast?: boolean }) => () => void` | The single handler of one effect kind. A second handler for the kind throws. |
| `fx.dispatch` | `(descriptor) => void` | Fire and forget. A missing handler is not an error. |
| `fx.onHint` | `(listener) => () => void` | Listens to every released hint. |
| `features.register` | `(name: string, description) => void` | Called by a feature plugin in `onInit`. |
| `features.all` | `() => readonly { name; description; parent? }[]` | Every feature, in registration order. |
| `features.contributions` | `(slotName: string) => readonly Contribution[]` | The sub-flows of one slot, lowest `order` first. |

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `flow:edge` | `{ flow, node, outcome, payload, next, patches: { doc, session }, index, now }` | After the commit of an edge. |
| `flow:rest` | `{ path, checkpoint }` | The graph entered a rest node. |
| `flow:error` | `{ path, error, rolledBackTo, retry }` | A node failed and the graph rolled back. Also written to the log as `flow:error`. |

### Listens to

None.

## Example

```ts file="dice.ts" check
import { createApp, createPlugin, defineGame, flowPlugin, type } from "@moku-labs/game";
import { createHeadless } from "@moku-labs/game/testing";

const { defineNode, defineFlow } = defineGame<{
  player: { coins: number };
  session: { rolls: number };
  assets: string;
  strings: Record<string, unknown>;
}>();

const home = defineNode({ outcomes: { roll: type() }, rest: true, checkpoint: true });
const roll = defineNode({
  outcomes: { done: type() },
  run: ({ player, session, rng, out }) => {
    player.coins += rng.stream("dice").range(1, 6);
    session.rolls += 1;
    return out.done();
  }
});

const mainFlow = defineFlow("main", {
  nodes: { home, roll },
  start: "home",
  edges: { home: { roll: "roll" }, roll: { done: "home" } }
});

// A game plugin hooks the edges of the graph.
const edgeLog = createPlugin("edgeLog", {
  depends: [flowPlugin],
  hooks: ctx => ({
    "flow:edge": payload => {
      ctx.log.info("edge", { node: payload.node, outcome: payload.outcome });
    }
  })
});

const app = createApp({
  plugins: [edgeLog],
  pluginConfigs: {
    model: { initialPlayer: { coins: 0 }, initialSession: { rolls: 0 }, seed: 42 },
    flow: { mainFlow, safeNode: "home" }
  }
});

const game = await createHeadless(app); // fast mode, started, resolved at the first rest
await game.walk([{ at: "home", intent: "roll" }]);
app.flow.state().path; // "home"
app.model.store.snapshot().session; // { rolls: 1 }
await game.stop();
```

:::gotchas
- **The game never calls `flow.run()` itself.** The page runs the graph after `app.start()`; a test hands the app to `createHeadless`, which runs it.
- **An awaited loop in `onStart` never lets `start()` resolve.** A hand-made app starts the graph with `ctx.flow.run().catch(...)`, not awaited.
- **The gate keeps one answer, never a queue.** Set `holdMs` above the longest transit animation a tap should survive.
- **A `recover` belongs on the `safeNode`.** It runs only when the runner gave up and enters the safe node.
:::

## Related

- [How it works](/docs/game/how-it-works/): nodes, edges and commits.
- [Nodes and flows](/docs/game/guides/nodes-and-flows/): `defineNode`, `defineFlow`, slots and effects.
- [Doors for the editor](/docs/game/guides/doors/): bookmarks and restores from outside.
