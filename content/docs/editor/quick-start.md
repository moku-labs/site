---
title: Quick start
description: "Install the editor, run moku-editor in the game folder, open the tools page."
section: Get started
order: 2
---

## A moku-game folder

A moku-game folder has `index.ts` and `config.ts`: the game `moku-game dev` runs. It needs one
command.

:::steps
1. **Install** the editor and its peers as dev dependencies.

   ```sh terminal title="install"
   $ bun add -d @moku-labs/editor @moku-labs/game typescript
   ```

2. **Run the editor** in the game folder.

   ```sh terminal title="moku-editor"
   $ bunx moku-editor --root .
   Game   http://127.0.0.1:3000/
   Tools  http://127.0.0.1:3000/__editor/
   Root   /home/dev/timber
   ```

3. **Open the tools page** at `http://127.0.0.1:3000/__editor/`. The link pill goes from `connecting` to `live · frame N` as soon as the game page says hello.

4. **Ignore the editor's files.** Add `.moku/` to the game's `.gitignore`. The bin writes its port and token to `.moku/editor.json`.
:::

There is nothing to wire. The bin asks the engine for the dev page (`preparePage` of
`@moku-labs/game/cli`) with the editor's page agent on it. It also starts the engine's keys watch
(`watchKeys`), so `generated/` stays fresh and a saved string shows without a `moku-game keys`
run. Then it runs again under the page's `.moku/bunfig.toml`, so Bun loads the engine's hot
plugin. The page starts the agent after the game started and sets `globalThis.editor`.

| Flag | Default | What it does |
|---|---|---|
| `--root`, `-r` | `.` | The game folder, or the project root the editor reads and writes. |
| `--port`, `-p` | `3000` | Port on `127.0.0.1`. `0` picks a free port. |
| `--no-hmr` | hot reload on | Serves the game without Bun hot reload. |
| `--packed` | loose files | Serves `dist/assets` from `moku-game pack`. A big game loads faster. There is no keys watch, and new art shows only after the next pack. |
| `--preload FILE` | none | A file Bun preloads in the serving process. Repeatable. Engine page only. |
| `--serve-plugin FILE` | none | A Bun plugin the engine page bundles with, after the engine's hot plugin. Repeatable. Engine page only. |

`bunx moku-editor --help` lists every command and flag.

## Use it with Claude Code

Register the MCP server from the game folder:

```sh terminal
$ claude mcp add moku-editor -- bunx moku-editor mcp
```

Claude Code starts the bridge. It uses the running editor, or starts one. Keep the game or the
tools page visible: screenshots need the page on screen. See [Claude Code](/docs/editor/guides/claude-code/).

## A game with its own HTML page

A game that serves its own page has three pieces: the **agent** on the game page, the **server**
in Bun, the **tools page** in a browser tab.

### 1. The agent, in dev only

The default agent plugins are `registry`, `channel`, `perf`, `recorder` and `overlay`. The
websocket `bridgePlugin` and the screenshot `capturePlugin` are opt-in. A dev entry adds them
behind the engine's dev flag:

```ts file="src/editor.ts" check
import { bridgePlugin, capturePlugin, createApp } from "@moku-labs/editor/agent";
import { app } from "./game";

const devPlugins = __MOKU_GAME_DEV__ ? [bridgePlugin, capturePlugin] : []; // [!note] `__MOKU_GAME_DEV__` is the engine's dev flag. A dev build defines it `true`.
const editor = createApp({
  plugins: devPlugins,
  pluginConfigs: { registry: { game: app, name: "my-game" } } // [!note] `game` is the app `createApp` from `@moku-labs/game` returned. It is required.
});
await editor.start(); // [!note] Start it after the game: the registry probes the game's sources at start. It never waits for the server.
```

`registry.modules` takes the game's `.dev` modules: extra sources and commands. For a game that
ships, use the entry in [Production builds](/docs/editor/guides/production-builds/). It keeps the
whole agent out of the release bundle.

### 2. The server

The quickest way is the bin with the game's HTML file. It serves the page with the editor
mounted:

```sh terminal title="moku-editor"
$ bunx moku-editor web/index.html --port 3000 --root .
Game   http://127.0.0.1:3000/
Tools  http://127.0.0.1:3000/__editor/
Root   /home/dev/game
```

Or wrap the game's own `Bun.serve` with the server core:

```ts file="src/serve.ts" check
import { createApp } from "@moku-labs/editor/server";
import index from "./index.html";

const editor = createApp({ pluginConfigs: { files: { root: `${import.meta.dir}/..` } } }); // [!note] `files.root` is the project root. The editor reads and writes only inside it.
await editor.start();

const serveAsset = (request: Request) => new Response(Bun.file(`public${new URL(request.url).pathname}`));
Bun.serve(editor.hub.serve({ port: 3000, routes: { "/": index }, fetch: serveAsset })); // [!note] `hub.serve` wraps your options: it forces `127.0.0.1`, merges the editor routes and adds the websocket handler. Call it once, after `start()`.
```

A game that serves itself owns the hot reload setting. The Hot reload switch of the tools page is
inert there.

### 3. The tools page

Open `http://127.0.0.1:3000/__editor/`. It ships prebuilt in the package and embeds the game at
`pages.gameUrl` (default `/`).

## The tools page in a narrow pane

The tools page is built to sit next to a chat, at a half or a third of the screen. Game is the
first workspace and the default.

| Key | Workspace |
|---|---|
| ⌘1 | Game |
| ⌘2 | Flow |
| ⌘3 to ⌘6 | Render, State, Files, Console |

Density is `auto` (compact below 820 px of window width), `compact` or `comfortable`. Pick it in
the palette or the ⋯ menu. The [tools page guide](/docs/editor/guides/tools-page/) has the rest.

:::gotchas
- **Start the agent after the game.** The registry probes the game's sources at start.
- **`registry.game` is required.** The registry throws at init without it.
- **The server needs Bun.** It uses `Bun.serve` and HTML imports. The agent and the tools page run in the browser.
- **Add `.moku/` to `.gitignore`.** It holds the port and the per-start token, the captures and the device logs.
:::

## Next

- [How it works](/docs/editor/how-it-works/): the three cores and the wire between them.
- [The tools page](/docs/editor/guides/tools-page/): the picker, the reference line, hot reload.
- [Configuration](/docs/editor/configuration/): every option of every plugin.
