---
title: "@moku-labs/game"
description: "A 2D puzzle engine where the game is a graph, and the screen is a projection of it."
section: Get started
order: 1
---

## What it is

`@moku-labs/game` is a 2D puzzle engine on TypeScript and PixiJS, built on `@moku-labs/core`. You
write small nodes and edge tables. The engine runs them, saves on the edges and replays the whole
game without a screen.

It ships no genre rules: no merge, no match-3, no physics. A game brings its own pure rule
functions.

### Six ideas

- **[The game is a graph.](/docs/game/guides/nodes-and-flows/)** Flows are edge tables. Nodes are
  small functions with plain `await` bodies. One node is active at a time.
- **[State commits only on edges.](/docs/game/how-it-works/)** A node works on drafts. The runner
  commits them when the node returns an outcome. A node that throws changes nothing.
- **[Position is data.](/docs/game/guides/state-and-save/)** Node path, input and state describe
  the whole game. Checkpoints, rollback, bookmarks and repro runs come from that.
- **[The screen is a projection.](/docs/game/guides/screens/)** Rendering reads committed state and
  never owns it. The same game plays whole in plain Bun, with no screen at all.
- **[Deterministic by construction.](/docs/game/guides/lint/)** Time is an input named `now`.
  Randomness is a saved `rng` stream. A lint rule refuses `Date.now` and `Math.random` in game logic.
- **Data, not classes.** Animations, strings, styles, scenes and effects are frozen data.

## Status

Working, still young. The API may still change before the first stable release.

| Milestone | What it added |
|---|---|
| V1 | The logic: `time`, `lifecycle`, `model`, `clock`, `flow`. A game plays to the end headless. |
| V2 | The screen: a small ECS of its own, a lazy Pixi renderer, gestures, typed assets, scenes. |
| V3 | The interface: animations, strings, MSDF text, screens in JSX, sound. |
| V4 | Two doors for the editor: read a running game, drive a dev build. |
| V5 | Particles, WGSL filters, sprite frames, the production asset pack, a text field, visual tests. |
| V6 | `platform`: Back button, haptics, keep-awake. Filters on WebGL. The game as a Tauri app on iOS and Android. |

Rendering is WebGPU first, with Pixi's WebGL fallback. A device with neither gets an "unsupported
device" screen.

## Install

```sh terminal title="install"
$ bun add @moku-labs/game pixi.js
```

Bun only, ESM only: there is no CJS build. `pixi.js` is a peer dependency. Screens are `.tsx`, so a
game points JSX at the engine:

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

The other peers are optional. A web-only game installs neither `@moku-labs/system` nor
`@moku-labs/native`.

| Optional peer | Install it for |
|---|---|
| `@moku-labs/system` | The system plugins of `config.ts` and the `"store"` save. See [Native](/docs/game/guides/native/). |
| `@moku-labs/native` | `moku-game native`, the iOS, Android and macOS builds. A dev dependency. |
| `playwright-core` | The pixel leg of the [visual tests](/docs/game/guides/testing/). |
| `sharp` | The production asset pack. |
| `typescript` | The project index of `@moku-labs/game/project`. |

## The idea in five lines

:::steps
1. **A node** is a small function. It gets drafts of the state and returns `out.<outcome>(payload)`.
2. **A flow** is an edge table: for every outcome of every node, the node that comes next.
3. **A rest node** waits. A player answer comes through the gate, a world event through the inbox.
4. **The runner** commits the drafts on the edge. A node that throws rolls back to the last rest point.
5. **The screen** reads the committed state and sends answers back through the gate.
:::

A dice game: one rest node, one working node, one flow. `defineGame` binds the helpers to the types
of the game.

```ts file="flow.ts" group="dice" check
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
    player.coins += rng.stream("dice").range(1, 6); // [!note] Randomness is a named stream, saved with the player.
    session.rolls += 1;
    return out.done(); // [!note] The drafts commit on this edge.
  }
});

export const mainFlow = defineFlow("main", {
  nodes: { home, roll },
  start: "home",
  edges: { home: { roll: "roll" }, roll: { done: "home" } } // [!note] The compiler checks the table: a missing edge does not compile.
});
```

The game itself is one data object in `index.ts`. It creates no app: the page and the tests do.

```ts file="index.ts" group="dice" check
import { defineGameApp } from "@moku-labs/game/app";
import { mainFlow } from "./flow";

export default defineGameApp({
  flow: mainFlow,
  safeNode: "home",
  player: { coins: 0 },
  session: { rolls: 0 }
});
```

`bunx moku-game dev` serves it with hot reload. The [quick start](/docs/game/quick-start/) adds the
page, a headless test and the build.

## Entry points

| Import | Runs in | For |
|---|---|---|
| `@moku-labs/game` | anywhere | The engine: plugins, helpers, components. |
| `@moku-labs/game/app` | anywhere | `defineGameApp`, `startMoment`, the types of `index.ts` and `config.ts`. |
| `@moku-labs/game/app/page` | the browser | `startPage`, the page the generated `.moku/main.ts` calls. |
| `@moku-labs/game/app/system` | the browser, the native shell | The system shell over the optional peer `@moku-labs/system`. |
| `@moku-labs/game/cli` | Node and Bun | `runCli`, the bin `moku-game`; `preparePage` and `watchKeys` for the editor. |
| `@moku-labs/game/testing` | anywhere | Headless and isolated games, the fake clock, the in-memory save. |
| `@moku-labs/game/visual` | Node and Bun | Visual tests: baselines of state, describe and pixels. |
| `@moku-labs/game/assets` | Node and Bun | Asset keys, the manifest, strings, the pack. |
| `@moku-labs/game/inspect` | anywhere | Read a running game. |
| `@moku-labs/game/control` | dev builds | Drive a running game. |
| `@moku-labs/game/hot` | the Bun dev server | The Bun plugin that hot swaps views. |
| `@moku-labs/game/lint` | oxlint | The game lint rules, as an oxlint JS plugin. |
| `@moku-labs/game/project` | Node and Bun | Where every engine id of a game is defined. |
| `@moku-labs/game/jsx-runtime`, `/jsx-dev-runtime` | anywhere | The JSX runtime. A game never imports it by hand. |

Every export of every entry is in the [API reference](/docs/game/api/).

## The plugins

Six logic plugins run in every app. The nine screen plugins come as one list, `screen`. Three more
are opt-in: `[...screen, effectsPlugin, audioPlugin, platformPlugin]`, `platform` last.

| Plugin | Set | What it does |
|---|---|---|
| [time](/docs/game/plugins/time/) | logic | One frame loop, six phases, `step` for tests. |
| [lifecycle](/docs/game/plugins/lifecycle/) | logic | A stack of pause reasons. |
| [model](/docs/game/plugins/model/) | logic | Player and session state, the save, `rng` streams, migrations. |
| [clock](/docs/game/plugins/clock/) | logic | Trusted `now()` and timers stored as moments. |
| [flow](/docs/game/plugins/flow/) | logic | The graph: runner, gate, inbox, effects, features. |
| [debug](/docs/game/plugins/debug/) | logic | The editor's overlay from the game, a no-op without the agent. |
| [world](/docs/game/plugins/world/) | screen | A small ECS and projections from committed state. |
| [renderer](/docs/game/plugins/renderer/) | screen | Pixi, loaded lazily, synced from the ECS. |
| [input](/docs/game/plugins/input/) | screen | Gestures as data: tap, press, drag, swipe. |
| [assets](/docs/game/plugins/assets/) | screen | Manifest, load tiers, typed keys, the production pack. |
| [scenes](/docs/game/plugins/scenes/) | screen | A scene as a declaration: bundle, layers, music. |
| [anim](/docs/game/plugins/anim/) | screen | Choreography as data: tweens, timelines, motions. |
| [i18n](/docs/game/plugins/i18n/) | screen | Strings as data, ICU messages, compiled per locale. |
| [text](/docs/game/plugins/text/) | screen | MSDF text, styles, inline tags and icons. |
| [ui](/docs/game/plugins/ui/) | screen | Screens in JSX, Yoga layout, popups, styles. |
| [effects](/docs/game/plugins/effects/) | opt-in | Particles and filters as components, WGSL and GLSL. |
| [audio](/docs/game/plugins/audio/) | opt-in | Music and sound effects on three buses. |
| [platform](/docs/game/plugins/platform/) | opt-in | The phone: Back button, haptics, keep-awake. |

`log` and `env` come from `@moku-labs/common` and sit on every plugin context as `ctx.log` and
`ctx.env`.

## Start with Claude

Install the moku plugin in Claude Code and describe the game in plain words. It writes the nodes,
the flows and the headless tests, and plays them.

```sh terminal title="Claude Code"
$ /plugin marketplace add moku-labs/claude
$ /plugin install moku@moku
```

```text prompt
Build a sliding-tile puzzle game on @moku-labs/game
```

```text prompt
Add a daily chest to my game that opens after a timer
```

```text prompt
Write a headless test that plays my first level to the end
```

```text prompt
Build my game as an iOS app with haptics and a store save
```

## Where to next

- [Quick start](/docs/game/quick-start/): the dice game end to end, with a headless test.
- [How it works](/docs/game/how-it-works/): nodes, edges, commits, and the screen as a projection.
- [Nodes & flows](/docs/game/guides/nodes-and-flows/): the graph in full.
- [The game shell](/docs/game/guides/game-shell/): `index.ts`, `config.ts`, the page, the `moku-game` commands.
- [API reference](/docs/game/api/): every entry and every export.
