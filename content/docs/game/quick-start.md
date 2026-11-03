---
title: Quick start
description: "The dice game end to end: the kit, the nodes, the flow, the page, a headless test and the build."
section: Get started
order: 2
---

## A dice game in eight steps

One rest node, two working nodes, one flow. The game rolls a die, adds the face to the coins, and
can reset them.

:::steps
1. **Create the folder and install.** `pixi.js` is a peer dependency. The test below runs on Vitest.

   ```sh terminal title="install"
   $ mkdir dice && cd dice
   $ bun init -y
   $ bun add @moku-labs/game pixi.js
   $ bun add -d vitest
   ```

2. **Point JSX at the engine.** Screens are `.tsx`. The engine expects strict TypeScript with
   `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.

   ```json file="tsconfig.json"
   {
     "compilerOptions": {
       "strict": true,
       "exactOptionalPropertyTypes": true,
       "noUncheckedIndexedAccess": true,
       "jsx": "react-jsx",
       "jsxImportSource": "@moku-labs/game"
     }
   }
   ```

3. **Bind the kit** to the types of the game: `state.ts`.
4. **Write the nodes**: `nodes.ts`.
5. **Wire the flow**: `flow.ts`.
6. **Define the game** as one data object: `index.ts`. Name the page: `config.ts`.
7. **Play it headless** with a test.
8. **Serve and build** with the engine bin `moku-game`.
:::

## The kit

`defineNode` and `defineFlow` come from `defineGame`. They are not root exports. The kit binds
them to the player and the session, so a node that writes a field the game does not have does not
compile.

```ts file="state.ts" group="dice" check
import { defineGame } from "@moku-labs/game";

export type Player = { coins: number; lastRoll: number }; // [!note] The player tree is saved. Plain JSON only: no class, no `Map`, no `Date`.
export type Session = { rolls: number }; // [!note] The session tree lives for one run and is never saved.

export const { defineNode, defineFlow, defineFeature } = defineGame<{
  player: Player;
  session: Session;
  assets: string;
  strings: Record<string, unknown>;
}>();
```

## The nodes

A rest node without a body is a pure wait. The `intent` of the player's answer names the outcome.
A working node gets drafts of the state and returns an outcome.

```ts file="nodes.ts" group="dice" check
import { type } from "@moku-labs/game";
import { defineNode } from "./state";

export const home = defineNode({
  outcomes: { roll: type(), reset: type() },
  rest: true, // [!note] The graph waits here for an answer whose intent is `roll` or `reset`.
  checkpoint: true // [!note] The journal is compacted here. The safe node of a game is a checkpoint.
});

export const roll = defineNode({
  outcomes: { done: type() },
  run: ({ player, session, rng, out }) => {
    const face = rng.stream("dice").range(1, 6); // [!note] One stream per source. Its state is part of the save.

    player.coins += face;
    player.lastRoll = face;
    session.rolls += 1;
    return out.done();
  }
});

export const reset = defineNode({
  outcomes: { done: type() },
  run: ({ player, out }) => {
    player.coins = 0;
    return out.done();
  }
});
```

## The flow

The edge table names the next node for every outcome of every node. A missing edge or an unknown
target is a compile error with a sentence.

```ts file="flow.ts" group="dice" check
import { home, reset, roll } from "./nodes";
import { defineFlow } from "./state";

export const mainFlow = defineFlow("main", {
  nodes: { home, roll, reset },
  start: "home",
  edges: {
    home: { roll: "roll", reset: "reset" },
    roll: { done: "home" },
    reset: { done: "home" }
  }
});
```

## The game and its page

`index.ts` is the whole game as one data object. `defineGameApp` creates no app: the page and the
tests do, with `game.screen()` and `game.headless()`. The graph is run by the page or the test,
never by the game.

```ts file="index.ts" group="dice" check
import { defineGameApp } from "@moku-labs/game/app";
import { mainFlow } from "./flow";

export default defineGameApp({
  flow: mainFlow,
  safeNode: "home", // [!note] The checkpoint the runner enters after a transition failed its retries.
  player: { coins: 0, lastRoll: 0 },
  session: { rolls: 0 }
});
```

`config.ts` is plain data: the page, and later the native app, the system plugins and the save.
Every field but the title has a default.

```ts file="config.ts" group="dice" check
import type { GameConfig } from "@moku-labs/game/app";

export default {
  page: { title: "Dice", background: "#10161d" } // [!note] The colour behind the canvas, the `theme-color` meta and the native window.
} satisfies GameConfig;
```

## Play it headless

`game.headless()` makes the logic app, not started, on a fake clock and an in-memory save.
`createHeadless` starts it and resolves once the graph rests at its first rest node. `walk` plays a
route.

```ts file="game.test.ts" group="dice" check
import type { Flow } from "@moku-labs/game";
import { createHeadless } from "@moku-labs/game/testing";
import { expect, it } from "vitest";
import game from "./index";

const rollOnce: Flow.RouteStep = { at: "home", intent: "roll" }; // [!note] `at` is the path of a rest node, `intent` the answer given there.

it("plays two rolls and a reset without a screen", async () => {
  const { app } = game.headless();
  const run = await createHeadless(app);

  const state = await run.walk([rollOnce, rollOnce]);

  expect(state.path).toBe("home");
  expect(app.model.store.snapshot().session).toEqual({ rolls: 2 });

  await run.walk([{ at: "home", intent: "reset" }]);

  expect(app.model.store.snapshot().player).toMatchObject({ coins: 0 });

  await run.stop();
});
```

```sh terminal title="test"
$ bunx vitest run
```

In a live game the same answer comes from the screen: `app.flow.gate.answer({ intent: "roll" })`.

## Serve and build

Add the scripts and ignore what `moku-game` writes. A game writes no page, no server and no
`bunfig.toml`.

```json file="package.json"
{
  "scripts": {
    "dev": "moku-game dev",
    "build": "moku-game build"
  }
}
```

```sh terminal title="serve"
$ echo ".moku/" >> .gitignore
$ bun run dev     # http://localhost:3000/, with hot reload
$ bun run build   # the production page in dist/web
```

`moku-game dev` writes the dev page into `.moku/` and prints the bound URL on its own line.
`--port 0` takes a free port. Until `.gitignore` lists `.moku/`, it warns: `[game] dev: add ".moku/"
to .gitignore. moku-game writes its dev page there.`

## The folder

| Path | Holds |
|---|---|
| `index.ts` | `export default defineGameApp({ ... })`: the game as one data object |
| `config.ts` | The page, the native app, the system plugins and the save, as plain data |
| `state.ts`, `nodes.ts`, `flow.ts` | The kit, the nodes and the flow of this small game |
| `tests/` | The tests. `tests/scenarios/<name>.ts` are the saves of `?player=<name>` on the dev page |
| `.moku/` | What `moku-game` writes. Git ignores it |
| `dist/web/` | The production page of `moku-game build` |

A bigger game splits into `core/`, `shared/`, `features/` and `plugins/`. See
[Features](/docs/game/guides/features/) and [The game shell](/docs/game/guides/game-shell/).

:::gotchas
- **`defineNode` is not a root export.** Import it from your kit, the result of `defineGame<Types>()`.
- **A node returns `out.<outcome>()`.** A bare string is not accepted.
- **The game never calls `flow.run()`.** The page runs the graph after `app.start()`; a test hands the app to `createHeadless`, which runs it.
- **No `Date.now()` and no `Math.random()` in a node.** Use `now` and `rng` from the node context. The [lint rules](/docs/game/guides/lint/) refuse both.
- **A hook that throws never stops the game.** The engine writes the error entry `"game: a hook failed"` to the log. Read it with `app.log.trace()`.
:::

## Next

- [How it works](/docs/game/how-it-works/): what happens between a rest node and the next one.
- [Nodes & flows](/docs/game/guides/nodes-and-flows/): sub-flows, slots, popups, timers.
- [Screens](/docs/game/guides/screens/): projections, JSX, scenes.
- [Testing](/docs/game/guides/testing/): headless, isolated and visual tests.
