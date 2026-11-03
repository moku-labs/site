---
title: Testing
description: "Play the game without a screen: headless apps, routes, isolated features, repro runs and visual baselines."
section: Guides
order: 15
---

## The apps of a game

A test makes its app from the game's `index.ts`. Both methods return `{ app, clock, provider }`:
the app not started, on a fake clock at `startMoment` and a fresh in-memory save. Each call is
fresh.

| Method | Composes | Use it for |
|---|---|---|
| `game.headless(seams?)` | The logic plugins, `logicOnly` of the features, `headless.plugins` | Rules, flows, saves. Plain Bun. |
| `game.screen(seams?)` | The screen set, `audio`, `effects`, `platform`, then `shared`, the features and the game's plugins | Screens, layout, the doors. Without a mount the renderer is inert, so it runs in plain Bun too. |

| Seam | `headless` | `screen` | Default |
|---|---|---|---|
| `seed` | yes | yes | The definition's `seed`, else 42. |
| `clock` | yes | yes | `fakeClock(startMoment)`. `startMoment` is `1_000_000`. |
| `provider` | yes | yes | A fresh `memory()`. |
| `player`, `session` | yes | yes | The definition's. |
| `manifest`, `io` | | yes | None. A test passes the parsed manifest and a file seam. |
| `platform`, `keepAwake`, `audio`, `renderer` | | yes | None: the platform plugin is inert, the renderer has no mount. |

## Play a route

`createHeadless(app)` sets the flow mode to `"fast"`, starts the app, runs the graph and resolves
when the loop rests for the first time. In fast mode effects answer at once and hints are dropped;
all node logic runs for real.

```ts file="tests/dice.test.ts" check
import type { Flow } from "@moku-labs/game";
import { createHeadless } from "@moku-labs/game/testing";
import { expect, it } from "vitest";
import game from "../index";

const rollOnce: Flow.RouteStep = { at: "home", intent: "roll" };

it("plays two rolls without a screen", async () => {
  const { app, provider } = game.headless({ seed: 42 });
  const run = await createHeadless(app);

  expect(run.state().path).toBe("home"); // [!note] `createHeadless` resolves at the first rest node.
  expect(provider.calls.map(call => call.method)).toEqual(["load", "commit"]); // [!note] A new player is committed before the first node runs.

  const state = await run.walk([rollOnce, rollOnce]);

  expect(state.path).toBe("home");
  expect(app.model.store.snapshot().session).toEqual({ rolls: 2 });
  await run.stop();
});
```

| `HeadlessGame` | What |
|---|---|
| `walk(route)` | Plays the steps and resolves with the flow state. |
| `answer({ intent, payload? })` | One gate answer. `true` when the gate took it. |
| `state()` | `{ running, path, stack, pending, mode }`. |
| `history()` | The journal since the last checkpoint. |
| `stop()` | Stops the app. |

A route step is `{ at, intent, payload? }`: at the rest node `at`, give that answer. Or
`{ at, result: { outcome, payload? } }`: substitute the result of the sub-flow at that path, so a
test skips a whole popup flow.

A checkpoint compacts `history()`. Assert on `state()`, on a bookmark, or on the `flow:edge`
events of a plugin you pass.

## Timers

The clock of `game.headless()` is a `fakeClock(startMoment)`. `clock.advance(ms)` fires due timers
at once; yield the microtask queue, then read the state. `clock.set(moment)` jumps to a moment.
`stepFrames(app, count, deltaMs)` calls `app.time.step(deltaMs)` `count` times, for code that runs
on frames, such as `watch` of the doors.

## Isolated features

`isolate(feature, options)` plays one feature without the rest of the game. It composes
`options.shared` and the feature as `logicOnly`, then `options.plugins`. The feature's flow becomes
a node of a harness main flow, so paths read as in the game.

```ts file="features/bonus/index.ts" group="bonus" check
import { exit, type } from "@moku-labs/game";
import { defineFeature, defineFlow, defineNode } from "../../state";

const offer = defineNode({ outcomes: { take: type(), skip: type() }, rest: true });
const pay = defineNode({
  outcomes: { done: type() },
  run: ({ player, out }) => {
    player.coins += 10;
    return out.done();
  }
});

export const bonusFlow = defineFlow("bonus", {
  nodes: { offer, pay },
  start: "offer",
  outcomes: { finished: type() },
  edges: { offer: { take: "pay", skip: exit("finished") }, pay: { done: exit("finished") } }
});

export const bonusScreen = defineFeature("bonusScreen", { flows: [bonusFlow] }); // [!note] A feature and a flow share one namespace: `bonus` is taken by the flow.
```

```ts file="features/bonus/__tests__/isolated/bonus.isolated.ts" group="bonus" check
import { createHeadless, isolate, stub } from "@moku-labs/game/testing";
import { expect, it } from "vitest";
import { bonusFlow, bonusScreen } from "../..";

const player = { coins: 0, lastRoll: 0 };

it("pays ten coins, then leaves the flow", async () => {
  const app = isolate(bonusScreen, { flow: bonusFlow, player })();
  const game = await createHeadless(app);

  expect(game.state().path).toBe("bonus/offer");
  await game.walk([{ at: "bonus/offer", intent: "take" }]);

  expect(game.state().path).toBe("exited"); // [!note] Every exit of a flow with outcomes lands on the rest node `exited`.
  expect(app.model.store.snapshot().player.coins).toBe(10);
  await game.stop();
});

it("skips the payment with a stub", async () => {
  const app = isolate(bonusScreen, { flow: bonusFlow, stubs: { pay: stub("done") }, player })(); // [!note] A stubbed node ends at once with its outcome.
  const game = await createHeadless(app);

  await game.walk([{ at: "bonus/offer", intent: "take" }]);

  expect(app.model.store.snapshot().player.coins).toBe(0);
  await game.stop();
});
```

| Option | Default | What |
|---|---|---|
| `flow` | required | The feature's flow. |
| `player` | required | The player a new save starts from. |
| `as` | `flow.id` | The name the game's main flow holds the flow under. |
| `shared` | none | The shared layer, composed as `logicOnly` first. |
| `stubs` | `{}` | Node name to `stub(outcome, payload?)`. |
| `plugins` | `[]` | More plugins the feature needs headless. |
| `session` | `{}` | The session at start. |
| `seed` | `1` | The rng seed. |

A node that is not stubbed runs for real, the flow of another feature too. A wrong stub key or
outcome does not compile, and throws at run time: `[game] isolate: no node "enrgy" in flow
"board".` `{ at: "exited", intent: "again" }` enters the flow once more.

## Repro runs

`runRepro(app, { player, session?, rng?, checkpoint?, route })` restores a state at a checkpoint,
then walks a route, and resolves with `{ path, player, session }`. The app keeps running: stop it
with `app.stop()`. A bug report that carries a save and the route that broke it becomes a test.

`saveOf(player, seed)` builds a save document for a fixture, and `memory(fixture)` starts a provider
on it. A second app over the same `memory()` reads what the first one wrote.

## A node alone

`fakeFx(options?)` is the `fx` of a node context for a unit test that calls `node.run` directly. It
returns `{ fx, awaited, started, emitted }`, and `options.answer(descriptor)` gives what an awaited
effect resolves with. `fx.start` refuses `answers` and a `guide`, as the game does.

## Visual tests

`@moku-labs/game/visual` runs in Node and Bun. A visual test is data: where the game starts, then
steps. A step is a `/control` command by its short name with its input, or a checkpoint.

```ts file="tests/visual/roll.visual.ts" check
import { defineVisualTest } from "@moku-labs/game/visual";

export const roll = defineVisualTest("roll", {
  start: { player: { coins: 0, lastRoll: 0 }, checkpoint: "home" },
  steps: [
    { answer: { intent: "roll" } }, // [!note] The input of the `answer` command of `/control`.
    { checkpoint: "rolled" } // [!note] Lands every motion, then saves state.json, describe.json and screen.webp.
  ]
});
```

```ts file="tests/visual/index.ts" check
import game from "../../index";
import { roll } from "./roll.visual";

export default { app: { app: () => game.screen().app }, tests: [roll] }; // [!note] `moku-game visual` reads this default export.
```

`moku-game visual` plays the tests against `tests/visual/baselines/`. A missing baseline is
written; `--update` rewrites them; any other is compared.

| Leg | Runs | Compares |
|---|---|---|
| Headless | Every run, in plain Bun | `state.json` and `describe.json`, exactly. |
| Pixels | On a Mac, on a dev page in Chrome with WebGPU, or WebGL with `--webgl` | `screen.webp`, with a tolerance. Needs `playwright-core`. |

| Flag | Does |
|---|---|
| `--update` | Rewrites the baselines of every test it runs. |
| `--only <name>` | Runs one test. Repeats. |
| `--no-pixels`, `--pixels` | The headless leg alone, or the pixel leg off a Mac too. |
| `--webgl` | The tests with `webgl: true`, on the page with `?renderer=webgl`. |
| `--url <url>` | A page already served, such as `moku-game dev`. |

The exit code is 1 when a checkpoint differs. No CI job runs pixels: a pixel difference with the
same state and describe is reported as a rendering regression.

## Test layout

The `test-suffix` lint rule holds every test file to its folder's suffix:

| Folder | Suffix |
|---|---|
| `tests/e2e/` | `.e2e.ts` |
| `tests/visual/` | `.visual.ts` |
| `tests/editor/` | `.editor.ts` |
| `__tests__/`, `__tests__/unit/`, `__tests__/integration/` | `.test.ts` |
| `__tests__/isolated/` | `.isolated.ts` |
| `__tests__/visual/` | `.visual.ts` |

The `index.ts` of a kind folder passes. Helpers go to `tests/helpers/` or `__tests__/fixtures/`.

:::gotchas
- **Pass an app that is not started.** `createHeadless` starts it and runs the graph.
- **`game.headless()` has no screen plugin.** `app.has("renderer")` is `false`; use `game.screen()` for views.
- **The isolated app's seed is `1`.** The game's is 42. Pass `seed` when a test compares draws.
- **Yield after `clock.advance`.** The elapsed event reaches the graph on the microtask queue.
:::

## Related

- [Doors](/docs/game/guides/doors/): read and drive a game from a test or a tool.
- [State & save](/docs/game/guides/state-and-save/): bookmarks and scenarios.
- [The game shell](/docs/game/guides/game-shell/): `moku-game visual` in the command table.
