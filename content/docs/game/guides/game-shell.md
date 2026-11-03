---
title: The game shell
description: "defineGameApp, config.ts, the page and the moku-game bin: a game is a folder of data."
section: Guides
order: 16
full: true
---

## A game is a folder

`index.ts` is the game as one data object. `config.ts` is the page, the native app, the system
plugins and the save, as plain data. The engine bin `moku-game` serves, builds and packs the
folder. A game writes no page, no server, no bridge and no `bunfig.toml`, and makes no `createApp`
call.

| Path | Holds |
|---|---|
| `index.ts` | `export default defineGameApp({ ... })`: the flow, the starting state, the features, the plugins and their configs |
| `config.ts` | `export default { page, native?, system?, save?, assets? } satisfies GameConfig` |
| `core/` | The kit (`defineGame`) and its types |
| `shared/` | The shared layer |
| `features/<f>/` | One feature: `flow/`, `rules/`, `views/`, `styles/`, `motion/`, `world/`, `assets/`, `strings/`; a sub-feature in `features/<f>/<sub>/` |
| `plugins/` | The game's own plugins |
| `generated/` | What `moku-game keys` writes: `assets.ts`, the strings, `manifest.json` |
| `tests/` | The tests. `tests/scenarios/<name>.ts` are the saves of `?player=<name>` |
| `.moku/` | What `moku-game` writes: the dev page, its `bunfig.toml`, the Tauri project. Git ignores it |
| `dist/assets/`, `dist/web/`, `dist-native/` | The pack, the web build, the native apps |

## index.ts: the game

`defineGameApp(definition)` takes the whole game and returns `{ headless(seams?), screen(seams?) }`.
It creates no app. Every type comes from the object: no generic at the call site.

```ts file="index.ts" check
import { defineGameApp } from "@moku-labs/game/app";
import { mainFlow } from "./flow";

export default defineGameApp({
  flow: mainFlow,
  safeNode: "home",
  player: { coins: 0, lastRoll: 0 },
  session: { rolls: 0 },
  seed: 7,
  headless: { features: [] }, // [!note] `[]` composes no feature headless. Left out, the headless app takes the game's `features`.
  pluginConfigs: { flow: { holdMs: 120 }, ui: { tapTargetPt: 48 } } // [!note] Every plugin of the screen app, minus the keys the shell writes.
});
```

| Key | Default | What |
|---|---|---|
| `flow` | required | The main flow. |
| `player` | required | The player a new save starts from. |
| `session` | required | The session at every start. |
| `safeNode` | the start of the main flow | The checkpoint entered after a failed retry. |
| `strings` | none | `type<Strings>()`: types `app.i18n.isKey` by the game's string table. |
| `orientation` | `"portrait"` | The orientation the layout is designed for. |
| `referenceSide` | `1080` | The short side of the design frame, in reference units. |
| `referenceLong` | `1920` | The long side the layout needs, in reference units. |
| `seed` | `42` | The rng seed of a new save. |
| `shared` | none | The shared layer, composed first among the features. |
| `features` | `[]` | The top-level features. A parent brings its sub-features. |
| `plugins` | `[]` | The game's own plugins, after the features. Their APIs land on `screen().app`. |
| `headless` | `{}` | `{ features?, plugins? }`: what the headless app composes. |
| `pluginConfigs` | `{}` | Plugin configs, without the keys the shell owns. |

The shell writes some plugin configs from the seams. Those keys are not in the type, so writing one
is a compile error, never a value a shallow merge would drop.

| Plugin | The shell writes | The game keeps |
|---|---|---|
| `model` | `playerProvider`, `initialPlayer`, `initialSession`, `seed` | `schemaVersion`, `migrations` |
| `clock` | `source` | nothing |
| `flow` | `mainFlow`, `safeNode` | `retries`, `settleTimeoutMs`, `journalLimit`, `holdMs` |
| `platform` | `provider`, `keepAwake` | nothing |
| `renderer` | `mount`; a seam's `loadPixi` and `preference` win | the rest |
| `assets` | `manifest`, `io` | `textureBudgetMb`, `preloadDepth`, `baseUrl` |
| `audio` | `context`; a seam's `journal` wins | the rest |

`defineGameApp` checks what TypeScript cannot stop: `[game] defineGameApp needs flow.`, and
`[game] defineGameApp: features[2] is not a feature.` for an entry `defineFeature` did not make.

## config.ts: the page, native, system, save

```ts file="config.ts" check
import type { GameConfig } from "@moku-labs/game/app";

export default {
  page: {
    title: "Dice",
    lang: "en",
    background: "#10161d",
    orientation: "portrait",
    icons: { favicon: "assets/icon.png" },
    boot: { image: "assets/boot.png" } // [!note] Shown from the first paint until the first scene drew, then faded out over 300 ms.
  },
  system: ["lifecycle", "back"],
  save: "local",
  assets: { layers: { shared: "ui" } }
} satisfies GameConfig;
```

| Key | Default | What |
|---|---|---|
| `page.title` | required | The page title. Never empty. |
| `page.lang` | `"en"` | The `lang` of the page. |
| `page.background` | `"#000000"` | The colour behind the canvas, the `theme-color` meta and the native window. The canvas clear colour is `renderer.background`. |
| `page.orientation` | `"portrait"` | `"portrait"`, `"landscape"` or `"any"`. The native build locks it. |
| `page.icons` | none | `{ favicon?, appleTouch? }`: files relative to the game, as `<link>` tags. |
| `page.head` | none | Raw tags for `<head>`, verbatim, in order. |
| `page.boot` | none | `{ image, width?, fadeMs? }`: a picture over the canvas until the first scene drew. `width` `"40vmin"`, `fadeMs` `300`. |
| `native` | none | The native app. Left out, the game has no native build. See [Native](/docs/game/guides/native/). |
| `system` | `[]` | The system plugins the shell wires: `lifecycle`, `back`, `haptics`, `keepAwake`, `store`. |
| `save` | `"memory"` | `"memory"`, `"local"` or `"store"`. See [State & save](/docs/game/guides/state-and-save/). |
| `assets.layers` | `{}` | Asset layers by folder: `{ shared: "ui" }` becomes `--layer shared=ui`. |
| `debug.overlay` | `"closed"` | How the editor's overlay shows when a debug page starts: `"closed"`, `"pill"` or `"open"`. |

A value TypeScript would refuse, in a file that skips `satisfies`, stops `moku-game` and the page:
`[game] config.save is "disk".`, `[game] config.system names "tray", which the game shell does not
wire.`, `[game] config.page.title is empty.`

## The page

`moku-game dev` and `moku-game build` write the page. Its `main.ts` calls `startPage(game, config,
options)` of `@moku-labs/game/app/page`:

```ts file=".moku/main.ts" no-check="written by moku-game dev; it imports the game's files by their .ts names, which the docs checker does not resolve"
// Written by moku-game dev. Do not edit.
import "./dev.ts";
import "./assets-stamp.ts";
import { startPage } from "@moku-labs/game/app/page";
import game from "../index.ts";
import config from "../config.ts";
import scenario0 from "../tests/scenarios/rich.ts";

await startPage(game, config, {
  scenarios: { "rich": scenario0 }
});
```

:::steps
1. **Resolves `config.ts`.**
2. **Picks the start.** `?player=<name>` runs the scenario of that name on a fresh memory save.
3. **Builds the system shell** when `config.ts` names one, then picks the save.
4. **Makes the screen app**: the canvas on `#game`, `manifest.json` next to the page, the device clock, the shell's platform. `?renderer=webgl` asks Pixi for WebGL.
5. **Sets the globals** `game` (the app), `system` (the system app or `undefined`) and `doors` (`read`, `watch`, `sources`; in dev also `run` and `commands`).
6. **Follows reduced motion**, also when the setting changes.
7. **Starts** the shell, then the app, then runs the graph. A graph that stops is logged as `[game] The graph stopped.`, never thrown.
8. **In dev, starts the agents**, each with `{ app, name, modules }`.
:::

On `pagehide` the page flushes the save, and stops the app when the page is really left. A page
kept in the back/forward cache keeps its app running. Every problem goes to the app's log.

## Commands

```sh terminal title="moku-game"
$ bunx moku-game help
```

| Command | Does |
|---|---|
| `dev [--port 3000] [--packed]` | Serves the game with hot reload. Keeps `generated/` fresh on the raw files. |
| `build [--out dist/web]` | Packs the assets and builds the production page. |
| `build --debug[=read] [--editor host:port]` | A debug page with the editor's agent, never shipped. |
| `native build <target> [--simulator]` | Builds the native app: `ios`, `macos`, `android`. |
| `native dev <target>` | Runs the native shell on the dev server. |
| `native doctor`, `native clean` | Checks or removes the native project. |
| `keys [--check]` | Writes `generated/assets.ts`, the strings and `generated/manifest.json`. |
| `pack [--no-cache]` | Packs the assets into `dist/assets`. |
| `visual [--update] [--only <name>]` | Runs `tests/visual/index.ts`: headless, pixels on a Mac. |

Every command takes `--root <dir>` (default `.`), `--preload <path>` and `--serve-plugin <path>`,
before or after the command word. The exit code is `0` on success, else `1` and a `[game] …` line.

### dev

`moku-game dev` writes the dev page into `.moku/`: `index.html`, `dev.ts`, `main.ts`,
`bunfig.toml` and `assets-stamp.ts`, each only when its text changed. It runs Bun again under that
bunfig in the game folder and serves the page.

- `--port 0` takes a free port. A taken port: `[game] dev: port 3000 is in use.`
- `/manifest.json` is the dev manifest. A path segment that starts with a dot, and `node_modules`,
  answer 404. Every file answers with `Cache-Control: no-store`.
- `main.ts` lists `tests/scenarios/*.ts` by file stem. A new or removed scenario rewrites it, and
  the page reloads.
- A save of an asset or a strings file scans the keys again, 100 ms after the last file event. A
  failed scan is one warning, and the server runs on.
- It watches the installed engine and restarts its server when the engine changes.

### build

`moku-game build` packs the assets with the layers of `config.ts`, then bundles the page minified
into `--out`, with `__MOKU_GAME_DEV__` defined `false` and no hot plugin. The page carries no
scenario, no agent, no `.dev` module and no `/control`. Every link starts with `./`, so it runs from
any http sub-path and from Tauri, not from `file://`. A release page that carries the editor's agent
is refused, and its output folder removed.

## The editor's seam

The editor takes the same page from the engine. `@moku-labs/game/cli` exports what it needs:

| Export | What |
|---|---|
| `preparePage(root, { agents?, preload?, servePlugins? })` | Writes the dev page of `moku-game dev` and resolves its paths. Starts no server. |
| `watchKeys(root, { onError? })` | The keys watch of `dev`, for a server the caller runs. Resolves `{ close() }`. |
| `watchEngine(root, { onChange?, onError? })` | Tells when the installed engine changed. Returns `{ close() }`. |
| `runCli(argv)` | The `moku-game` bin. |

With agents, the page also imports the game's `**/*.dev.ts` and hands them to the agents. See
[Doors](/docs/game/guides/doors/).

:::gotchas
- **Add `.moku/` to `.gitignore`.** `moku-game dev` warns until it is there.
- **The game never runs the graph.** The page runs it after `app.start()`; a test runs it through `createHeadless`.
- **`config.ts` is read once.** A changed layer needs a restart of `dev`.
- **`/app` imports no `node:` module, no `@moku-labs/system` and no `@moku-labs/native`.** A web-only game never meets either package.
:::

## Related

- [Quick start](/docs/game/quick-start/): the smallest `index.ts` and `config.ts`.
- [Native](/docs/game/guides/native/): `native`, `system`, the store save and the native build.
- [Hot swap](/docs/game/guides/hot-swap/): what `dev` swaps and what it reloads.
- [API reference](/docs/game/api/): `@moku-labs/game/app`, `/app/page`, `/cli`.
