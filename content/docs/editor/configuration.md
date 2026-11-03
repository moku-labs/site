---
title: Configuration
description: "Every option of every plugin of the three cores, set through pluginConfigs."
section: API reference
order: 41
---

## How config works

Every option belongs to a plugin. The three global configs, `AgentConfig`, `ServerConfig` and
`ToolsConfig`, are empty. Options are set through `pluginConfigs` and shallow-merged over the
defaults. An array you pass replaces the default array, and an object option such as
`flowView.layout` replaces the default object as a whole.

A bad value throws at `createApp`, with a `[moku-editor] <plugin>.<field> …` message and a fix
line.

```ts file="src/editor-config.ts" check
import { createApp as createAgent } from "@moku-labs/editor/agent";
import { createApp as createServer } from "@moku-labs/editor/server";
import { createApp as createTools } from "@moku-labs/editor/tools";
import { app } from "./game";

// agent: a QA build with the overlay card open at start, docked left
export const editor = createAgent({
  pluginConfigs: { registry: { game: app }, overlay: { mode: "card", dock: "left" } }
});

// server: open files in Cursor instead of VS Code
export const server = createServer({
  pluginConfigs: {
    files: { root: `${import.meta.dir}/..` },
    pages: { editorUrl: "cursor://file/{path}:{line}" }
  }
});

// tools: start on the Flow workspace (Game is the default)
export const tools = createTools({ pluginConfigs: { workspace: { defaultWorkspace: "flow" } } });
```

## Agent

| Plugin | Option | Default | Meaning |
|---|---|---|---|
| registry | `game` | `undefined` | **Required.** The app the game made with `createApp`. |
| registry | `modules` | `[]` | The game's `.dev` modules, merged after the doors. |
| registry | `name` | `undefined` | `Manifest.game`. Falls back to `document.title`, then `"game"`. |
| channel | `heartbeatMs` | `1000` | Ms between two beats. Whole number ≥ 100. |
| perf | `readEveryMs` | `250` | How often perf reads the monitor's frame ring, 50 to 1000. |
| perf | `windowMs` | `6000` | The window the graph and every spike count cover, 1000 to 30000. |
| perf | `frames` | `1024` | Rows perf keeps: at least `windowMs` at 120 Hz. 64 to 16384. |
| perf | `feedPasses` | `false` | Read the engine's pass ring and send the pass rows. |
| perf | `feedSystems` | `true` | Read and send the top 5 systems of each frame. |
| perf | `feedNodes` | `false` | Read and send the demand marks of each frame. |
| recorder | `autoStart` | `false` | `false`: nothing records until someone starts it. `"device"`: a log starts by itself on a debug build. `true`: on every page. |
| recorder | `keepMb` | `64` | Most MB in memory. 1 to 512. |
| recorder | `flushEveryMs` | `1000` | How often the queue is serialized, 100 to 10000. |
| recorder | `persistEveryMs` | `5000` | How often text is written to the store, 1000 to 60000. |
| recorder | `storage` | `"auto"` | `"auto"`: OPFS when the page has it, else memory. `"memory"`: never on disk. |
| recorder | `keepFiles` | `10` | Finished logs kept. 1 to 100. |
| recorder | `maxLogMb` | `32` | The size of one log; at it the recorder rotates to the next log. 1 to 512. |
| overlay | `mode` | `"hidden"` | `"hidden"`, `"pill"` or `"card"` at start when the device remembers none. |
| overlay | `dock` | `"right"` | `"left"` or `"right"`: the edge the window docks to. |
| overlay | `remember` | `true` | Remember place, mode and tab in `localStorage`. |
| overlay | `mount` | `undefined` | CSS selector of the host's parent; `undefined` is `document.body`. |
| bridge | `hello` | `"/__editor/hello"` | Hello route: a same-origin path or an absolute URL. |
| bridge | `retryMs` | `1000` | First reconnect delay; doubles up to 30 s, ±20 % jitter. |
| bridge | `callTimeoutMs` | `5000` | Deadline of one `read` or `run`. |
| bridge | `device` | `undefined` | Device mode at this computer address (`host:port`). `undefined`: page mode on a served page; device mode with `__MOKU_GAME_EDITOR__` or on a native page. `__MOKU_GAME_EDITOR__ = "off"` wins: no link at all. |
| bridge | `linesPerBatch` | `200` | Most log lines in one `perf.lines` message, 1 to 1000. |
| capture | `maxDurationMs` | `20000` | Longest series accepted. |
| capture | `minIntervalMs` | `16` | Shortest series interval accepted. |

## Server

| Plugin | Option | Default | Meaning |
|---|---|---|---|
| files | `root` | `"."` | Project root; must be an existing folder. |
| files | `allow` | `["**/*.ts", "**/*.tsx", "**/*.json", "**/*.md", "**/*.css", ".moku/**"]` | Globs a file must match. Case-sensitive. |
| files | `deny` | `["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.env*"]` | Globs never listed, read or written. Case-insensitive. |
| files | `project` | `true` | Open the project index of `root` on start. `false`: off with reason `disabled`. |
| hub | `path` | `"/__editor"` | URL prefix of every editor route. |
| hub | `allowOrigins` | `[]` | Extra exact origins allowed. |
| hub | `callTimeoutMs` | `5000` | Deadline of a forwarded call. |
| hub | `silentAfterMs` | `6000` | No heartbeat this long marks a session silent. |
| hub | `devicePort` | `47600` | Port of the device listeners. `0` picks a free port. |
| hub | `deviceLan` | `false` | Also listen on the computer's LAN address for paired phones. |
| hub | `lanAddress` | `undefined` | The LAN address to bind; `undefined` picks the first non-internal IPv4 of an `en*`, `wl*` or `eth*` interface. |
| hub | `deviceOrigins` | `["tauri://localhost", "https://tauri.localhost", "http://tauri.localhost"]` | Exact Origins a phone's WebView sends. |
| hub | `pairing` | `"lan"` | `"lan"`: only a LAN phone is asked for its code. `"always"`: every phone is asked. |
| hub | `pairTimeoutMs` | `60000` | How long a pairing waits before it is refused. |
| connect | `adb` | `"adb"` | The adb command: a name on `PATH` or a path. |
| connect | `adbTimeoutMs` | `5000` | One adb call is killed after this, 500 to 60000. |
| connect | `scanEveryMs` | `2000` | `adb devices -l` period while the Connect panel is open or device mode runs. |
| connect | `answerTimeoutMs` | `20000` | A ready phone with no session after this reads "No debug game answered". |
| connect | `leaseMs` | `10000` | A scan or watch lease the tools page does not renew for this long ends. |
| connect | `telemetryEveryMs` | `1000` | The wired telemetry tick, 250 to 10000. |
| connect | `meminfoEveryMs` | `5000` | `dumpsys meminfo` period, 1000 to 60000. |
| connect | `heapEveryMs` | `250` | CDP `Runtime.getHeapUsage` period, 100 to 5000. |
| connect | `gcDropMb` | `0.5` | A heap drop of at least this is an inferred GC. |
| connect | `gcTrace` | `false` | Allows CDP tracing of GCs. |
| connect | `wire` | `"manual"` | `"auto"`: the adb listener on at start when `adb version` answers and the port is free. |
| collector | `out` | `".moku/perf"` | Folder of the device logs, relative to the files root or absolute. |
| collector | `everyS` | `10` | Seconds between two adb readings of heat and system frames, 1 to 3600. |
| collector | `reverseEveryMs` | `2000` | Ms between two `adb devices` and `adb reverse` rounds, ≥ 500. |
| collector | `adb` | `"adb"` | The adb command: a name on `PATH` or a path. |
| collector | `adbTimeoutMs` | `5000` | The longest one adb command may run, ≥ 500. |
| collector | `appId` | `undefined` | The game's Android package; `<appId>.debug` is preferred when installed. |
| pages | `title` | `"moku editor"` | Tools page `<title>`. |
| pages | `editorUrl` | `"vscode://file/{path}:{line}"` | The "Open in editor" link template. |
| pages | `pageDir` | `undefined` | Built page folder; `undefined` is `dist/tools` next to the module. |
| pages | `gameUrl` | `"/"` | Same-origin URL of the game page the tools page embeds. |
| pages | `toolsPage` | `true` | Serve the tools page and its assets. |

The switches of `moku-editor perf` are not options of their own. They map onto the fields above:
`--port` to `hub.devicePort`, `--lan` to `hub.deviceLan`, `--out` to `collector.out`, `--every` to
`collector.everyS`, `--no-ui` to `pages.toolsPage: false`.

## Tools

| Plugin | Option | Default | Meaning |
|---|---|---|---|
| link | `retryMs` | `1000` | Base of the reconnect backoff, capped at 8 s. |
| link | `boot` | `"#moku-editor-boot"` | Selector of the boot JSON tag. |
| link | `role` | `"page"` | `"page"`: the editor page, which publishes the selection. `"tools"`: a plain tools client, such as a headless test. |
| link | `reloadGraceMs` | `8000` | How long an expected reload reads as "reloading" before a game that has not come back reads as lost. |
| activeSource | `autoUse` | `true` | A phone that links while the local preview is the source becomes the source. |
| activeSource | `pauseLocal` | `true` | Pause the local preview while a phone is the source. |
| activeSource | `rejoinMs` | `15000` | A lost phone that comes back within this is the source again; `0`: never. |
| activeSource | `noticeMs` | `12000` | How long the disconnect notice shows. |
| activeSource | `renewMs` | `4000` | How often the scan and watch leases are renewed. |
| activeSource | `markers` | `32` | Source-switch markers kept for the timeline. |
| workspace | `defaultWorkspace` | `"game"` | Shown at start when the hash names none. |
| workspace | `storageKey` | `"moku-editor"` | `localStorage` key of the preferences. |
| workspace | `reloadTimeoutMs` | `15000` | How long `reload()` waits for the new session. |
| workspace | `hotReloadWaitMs` | `1500` | After a save with hot reload on: how long the reload waits for Bun before it reloads the frame itself. |
| workspace | `toastMs` | `2600` | How long one toast stays. |
| panels | none | `{}` | No options. |
| flowView | `historyLast`, `trailLength`, `rejectedOutcomes` | `20`, `6`, `["rejected"]` | History watched, trail edges, rejection outcomes. |
| flowView | `layout` | `{ file: ".moku/editor/layout.json", worker: true, saveDelayMs: 400 }` | Saved positions, ELK in a worker, save debounce. Replaced as a whole. |
| flowView | `zoom` | `{ min: 0.08, max: 3, defaultMin: 0.8 }` | Zoom range and default camera floor. Replaced as a whole. |
| flowView | `hub` | `{ minOutcomes: 6, minReturns: 4 }` | The hub rule. Replaced as a whole. |
| gameView | `capturesDir` | `".moku/captures"` | Where captures and pick shots go, each in a day folder. `.moku/captures` or a folder under it. |
| gameView | `captureCardMs`, `seriesWarnShots` | `10000`, `200` | Capture card timeout, series warning. |
| gameView | `seriesDurationsMs`, `seriesIntervalsMs` | `[1000, 2000, 5000, 10000, 20000]`, `[16, 50, 100, 250, 500, 1000]` | Series popover chips. |
| renderView | `releaseLogMax` | `50` | Release log entries kept. Mission control has no option: its history is 2 minutes. |
| stateView | `expandDepth`, `maxPatches`, `pageSize` | `2`, `200`, `100` | Tree depth open, patches kept, children per page. |
| filesView | `maxFiles`, `maxHighlightChars` | `5000`, `512000` | Index cap, highlight cap. |
| filesView | `reloadExtensions`, `revalidateMs` | `[".ts", ".tsx", ".css", ".json"]`, `2000` | Saves that reload the game, tab re-read age. |
| consoleView | `maxLines`, `preserveLog` | `5000`, `false` | Lines kept, Preserve log at start. |
| consoleView | `freshMs`, `summaryChars` | `1200`, `160` | Fresh-error highlight, inline data length. |

:::gotchas
- **`registry.game` has no default.** The agent's `onInit` throws without it.
- **An object option is replaced, not merged.** Pass the whole `flowView.layout`, `zoom` or `hub` object.
- **`gameView.capturesDir` is `.moku/captures` or a folder under it.** Captures and pick shots go into day folders there.
:::
