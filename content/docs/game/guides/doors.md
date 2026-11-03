---
title: Doors
description: "/inspect reads a running game, /control drives a dev build: the doors the editor, MCP tools and e2e scripts use."
section: Guides
order: 17
---

## Two doors

An outside tool reaches a running game through two subpaths. Neither is on the root.

| Subpath | Exports | In a production build |
|---|---|---|
| `@moku-labs/game/inspect` | `read`, `watch`, `defineSource`, the catalogue `sources` | Safe. Every source only reads. |
| `@moku-labs/game/control` | `run`, `defineCommand`, `controlRefused`, `controlReadOnly`, the catalogue `commands` | Dev and debug builds only. |

A source or a command is data: an id, a title, an input schema and one function. `sources` and
`commands` are frozen objects keyed by a short name, so a tool registers `Object.values(sources)`
and `Object.values(commands)`. The page hands both to the browser as `globalThis.doors`.

| Call | Does |
|---|---|
| `read(app, source, input?)` | Reads once. |
| `watch(app, source, input, fn)` | Reads on the first frame, in the `signals` phase, and again when the source changes. Returns the stop function. |
| `run(app, command, input?)` | Resolves `{ value, state }`. `state` is `{ path, frame, tainted }`, read after the command. |

## Drive the dice game

```ts file="tests/doors.test.ts" check
import { commands, run } from "@moku-labs/game/control";
import { read, sources, watch } from "@moku-labs/game/inspect";
import { createHeadless } from "@moku-labs/game/testing";
import { expect, it, vi } from "vitest";
import dice from "../index";

it("rolls, bookmarks and restores through the doors", async () => {
  vi.stubGlobal("__MOKU_GAME_DEV__", true); // [!note] Commands run only in a dev build. A test turns it on like this.
  const { app } = dice.headless({ seed: 42 });
  const game = await createHeadless(app);

  expect(read(app, sources.position)).toEqual({ path: "home", flow: "main", node: "home", waiting: ["roll", "reset"] });

  const seen: string[] = [];
  const stop = watch(app, sources.position, undefined, position => {
    seen.push(position.path);
  });
  app.time.step(16); // [!note] `watch` runs on the frame loop. A headless test steps the frames itself.
  expect(seen).toEqual(["home"]);

  const walked = await run(app, commands.walk, { route: [{ at: "home", intent: "roll" }] });
  expect(walked.state.tainted).toBe(false); // [!note] A walk goes through the graph: the session stays clean.
  expect(read(app, sources.model).session).toEqual({ rolls: 1 });

  const { value: mark } = await run(app, commands.bookmark);
  await run(app, commands.restore, { bookmark: mark });
  expect(read(app, sources.tainted)).toBe(true); // [!note] A restore replaces the state outside the graph: it taints the session.

  stop();
  await game.stop();
  vi.unstubAllGlobals();
});
```

A source that needs the screen names the app it needs: `read(app, sources.locate, { key: "play" })`
on an app without `ui`, `renderer` and `world` is a compile error.

## Sources

Their ids are `game.<key>`. `Changes` is when `watch` reads the source again: `edge` when the flow
state is a new object, `commit` when the snapshot is, `frame` every frame.

| Key | Changes | Reads |
|---|---|---|
| `graph` | edge | `flow.describe()`: flows, nodes, outcomes, edges, slots. |
| `position` | edge | `{ path, flow, node, waiting }`. `waiting` lists the intents the gate waits for. |
| `history` | edge | The edges since the last checkpoint, or the last `last`. |
| `tainted`, `cheats` | frame | Whether a `cheat` or `raw` command ran, and their journal. |
| `model` | commit | The committed `{ player, session, rng }`. |
| `entities`, `projections`, `schema`, `explain` | frame, commit | The ECS: entities, projection keys, component kinds, one entity in full. |
| `ui` | frame | `ui.tree()`: the live screen as plain data. |
| `locate` | frame | Where a ui element (`key`) or a view (`target`) is, `{ x, y, w, h }` in CSS px. |
| `at` | frame | What lies under a page point, topmost first. |
| `render`, `effects`, `assets` | frame | Renderer, effects and asset numbers. |
| `sounds`, `audioMuted` | frame | The audio journal and the master mute. Need `audioPlugin`. |
| `filters` | frame | The filter kinds and the ones switched off. Needs `effectsPlugin`. |
| `log` | frame | `log.trace()`, all entries or those at `level` and above. |
| `diff` | frame | What changed between two frames. Dev builds only, the last 120 frames. |

## Commands

Every command leaves a `moku:dev` debug entry in the log. Its `effect` says what it may change.

| Key | Effect | Does |
|---|---|---|
| `answer` | route | `flow.gate.answer({ intent, payload })`. |
| `tap`, `drag`, `trace` | route | Input on a ui element by `key` or a view by `{ projection, key }`. |
| `key`, `fill`, `scroll` | route | A key press, text into an `input`, a `scroll` to an offset. |
| `walk` | route | `flow.walk(route)`. |
| `bookmark` | read | `flow.bookmark()`, plus the mounted `scene`. |
| `restore` | raw | A bookmark, or a `/testing` repro. |
| `saveExport`, `saveImport` | read, raw | The committed save out, and back in at the main flow's start. |
| `step`, `pause`, `resume`, `timeScale`, `frameRate` | cosmetic | Time: frames, the `devtools` pause reason, the scale, the frame rate. |
| `capture` | read | `{ png }` of the canvas after the next drawn frame. `{ legend: true }` numbers the keyed views. |
| `debug`, `reducedMotion`, `mute`, `filter` | cosmetic | Debug drawing, reduced motion, the master mute, a filter kind on or off. |

| Effect | Means |
|---|---|
| `read` | Takes something out and changes nothing. |
| `route` | Goes through the graph or the input, the way a player does. The session stays clean. |
| `cosmetic` | Changes how the game runs or looks. The session stays clean. |
| `cheat` | Changes the state outside the rules. Taints the session and is journaled. |
| `raw` | Replaces the state outside the graph. Taints the session and is journaled. |

## Turn the dev build on

The engine reads three globals and never sets them.

| Global `true` | Who sets it | Commands that run |
|---|---|---|
| `__MOKU_GAME_DEV__` | `moku-game dev`; a test with `vi.stubGlobal` | Every command. |
| `__MOKU_GAME_CONTROL__` | `moku-game build --debug` | Every command. |
| `__MOKU_GAME_AGENT__` alone | `moku-game build --debug=read` | `read` and `cosmetic` only; the others throw `controlReadOnly`. |

With none of them, `run` throws `[game] Control commands run in dev builds only.` `moku-game build`
defines all three `false`, so the minifier drops every command body. A game without the shell
uses a bundler `define` the same way.

## A game's own sources and commands

`defineSource` and `defineCommand` take the shape of the base catalogue. The id is camelCase words
joined by dots, at least two: `dice.rolls`. Keep them in `.dev` modules: `moku-game build` imports
none, and the editor's dev page imports every `**/*.dev.ts`.

```ts file="dice.dev.ts" check
import { controlRefused, defineCommand } from "@moku-labs/game/control";
import { defineSource } from "@moku-labs/game/inspect";
import type dice from "./index";

export const rolls = defineSource({
  id: "dice.rolls",
  title: "Rolls",
  input: {},
  changes: "commit",
  read: (app: ReturnType<typeof dice.headless>["app"]) => app.model.store.snapshot().session
});

export const rollTwice = defineCommand({
  id: "dice.rollTwice",
  title: "Roll twice",
  input: {},
  effect: "route",
  run: app => {
    if (typeof __MOKU_GAME_DEV__ === "undefined" || !__MOKU_GAME_DEV__) throw controlRefused(); // [!note] Write the guard inline: a `define` of `false` folds it and the minifier drops the body.
    return app.flow.walk([{ at: "home", intent: "roll" }, { at: "home", intent: "roll" }]);
  }
});

export const giveCoins = defineCommand({
  id: "dice.giveCoins",
  title: "Give coins",
  input: { coins: "number" }, // [!note] Kinds are "string", "number", "boolean" and "json"; a trailing "?" makes a field optional.
  effect: "cheat",
  run: (app, { coins }) => {
    if (typeof __MOKU_GAME_DEV__ === "undefined" || !__MOKU_GAME_DEV__) throw controlRefused();
    return app.flow.restore({ ...app.flow.bookmark(), player: { coins, lastRoll: 0 } });
  }
});
```

A command meant for a `--debug` page writes the agent form of the guard, with
`__MOKU_GAME_AGENT__` for a read or cosmetic effect and `__MOKU_GAME_CONTROL__` for the others.
`overlay: "toggle"` or `overlay: "button"` lists a command in the editor's overlay.

:::gotchas
- **`/control` never ships.** `run` throws in a production build; keep game commands in `.dev` files that only the dev page, a debug page and the tests import.
- **Do not re-declare `__MOKU_GAME_DEV__`.** The package ships its declaration.
- **A headless `watch` needs frames.** Call `app.time.step(16)`; nothing runs on its own in plain Bun.
- **`diff` is dev only.** A production build throws `[game] game.diff needs a dev build.`
:::

## Related

- [Testing](/docs/game/guides/testing/): the headless apps the doors run on.
- [Hot swap](/docs/game/guides/hot-swap/): the editor restores a checkpoint after a reload.
- [flow plugin](/docs/game/plugins/flow/): bookmarks and restore in full.
