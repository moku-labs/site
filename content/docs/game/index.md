---
title: "@moku-labs/game"
description: "A 2D puzzle engine where the game is a graph."
section: Get started
---

## Overview

`@moku-labs/game` is a 2D puzzle engine where the game is a graph, and the screen renders the
committed state. You write small nodes and edge tables. The engine runs them, saves on the edges
and replays the whole game without a screen. It ships no genre rules.

- **Flows are edge tables.** Nodes are small functions with plain `await`
  bodies. One node is active at a time.
- **State commits only on edges.** A node works on drafts. A node that throws changes nothing.
- **Deterministic.** Time is an input named `now`. Randomness is a saved `rng`
  stream. A lint rule refuses `Date.now` and `Math.random` in game logic.

## Install

```sh terminal
bun add @moku-labs/game pixi.js
```

Bun only, ESM only. `pixi.js` is a peer dependency. Screens are `.tsx`, so a game sets
`"jsxImportSource": "@moku-labs/game"`.

## Quick start

A dice game: one rest node, one working node, one flow. `defineGame` binds the helpers to the
types of the game.

```ts file="flow.ts" check
import { defineGame, type } from "@moku-labs/game";

const { defineNode, defineFlow } = defineGame<{
  player: { coins: number };
  session: { rolls: number };
  assets: string;
  strings: Record<string, unknown>;
}>();

const home = defineNode({ outcomes: { roll: type() }, rest: true, checkpoint: true }); // [!note] A rest node: the graph waits here for the player.

const roll = defineNode({
  outcomes: { done: type() },
  run: ({ player, session, rng, out }) => {
    player.coins += rng.stream("dice").range(1, 6);
    session.rolls += 1;
    return out.done(); // [!note] The drafts commit on this edge.
  }
});

export const mainFlow = defineFlow("main", {
  nodes: { home, roll },
  start: "home",
  edges: { home: { roll: "roll" }, roll: { done: "home" } }
});
```

The game itself is one data object in `index.ts`:

```ts file="index.ts"
import { defineGameApp } from "@moku-labs/game/app";
import { mainFlow } from "./flow";

export default defineGameApp({
  flow: mainFlow,
  safeNode: "home",
  player: { coins: 0 },
  session: { rolls: 0 }
});
```

Serve it with hot reload:

```sh terminal
bunx moku-game dev
```

## Start with Claude

```text prompt
Build a blog with tags and an RSS feed on @moku-labs/web
```

```text prompt
Add a D1-backed comments API with @moku-labs/worker
```

```text prompt
Make a couch quiz game: TV shows questions, phones answer
```

```text prompt
Ship this app to macOS and iOS
```
