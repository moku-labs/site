---
title: On a phone
description: "A debug build carries the agent: the overlay's frame graph, a log on the device, and moku-editor perf on the computer."
section: Guides
order: 14
---

## How it works

A frame rate measured in a desktop browser says little about a phone. A **debug build** puts the
editor's agent into the game the phone runs, with no dev server. The overlay shows the frames, the
device keeps a log once someone records, and the computer links the phone in one of two ways:

- **Connect device** in the Render workspace of the dev tools page. See [The Render workspace](/docs/editor/guides/render-workspace/).
- **`moku-editor perf`**, which pairs the phone, keeps its logs and serves a tools page with the phone as its source.

:::flow
- perf
- **recorder**
- bridge
- **hub**
- collector
- `.moku/perf/`
:::

On the phone, `perf` reads the engine's frames into a 6 s window, the `recorder` keeps the log,
and the `bridge` ships it. On the computer, the `hub` takes the phone's socket and the `collector`
writes one file per log.

## A debug build

```sh terminal title="debug builds"
$ bunx moku-game build --debug
$ bunx moku-game build --debug --editor <computer-ip>:47600
$ bunx moku-game build --debug=read
$ bunx moku-game native build android --debug
```

The engine builds the release page plus the editor's page agent, `@moku-labs/editor/agent/page`,
and the game's `.dev` modules. The agent starts after the game, behind the inline guard
`__MOKU_GAME_DEV__ || __MOKU_GAME_AGENT__`, with the default plugins plus bridge and capture.

| Flag | `moku-game dev` | `build --debug` | `build --debug=read` | `build` (release) |
|---|---|---|---|---|
| `__MOKU_GAME_DEV__` | `true` | `false` | `false` | `false` |
| `__MOKU_GAME_AGENT__` | `true` | `true` | `true` | `false` |
| `__MOKU_GAME_CONTROL__` | `true` | `true` | `false` | `false` |
| Commands the page runs | every one | every one | `read` and `cosmetic` | none: no agent |

- **`--editor host:port`** is where the bridge dials. The default `127.0.0.1:47600` is what `adb reverse` maps to the computer. An address picked on the overlay's Link tab is remembered on the phone and wins over the build's.
- **`__MOKU_GAME_EDITOR__ = "off"`** is a store-signed test build with no editor link. The overlay and the commands keep working.
- **A native debug build** is a second Android app, `<appId>.debug`, installed beside the store app.
- **A refused command** is greyed on the overlay. A run answers -32009 `read_only`. `game.capture` is a `read` command, so screenshots work on every debug build.

## Open the overlay

The game decides when the overlay shows. The editor ships no gesture and no debug button.

| Way | What it does |
|---|---|
| `app.debug.overlay.open({ mode })` | Opens it as `"pill"` or `"card"` (the card by default). Also `close()`, `toggle()`, `isOpen()`. On a page without the agent flag each answers `false`. |
| `DebugTrigger()` on a view | Five taps within 3 s open it. |
| `config.debug.overlay` | `"closed"`, `"pill"` or `"open"`, applied by the engine right after the agents started. |
| `editor.overlay { mode }` | `"hidden"`, `"pill"` or `"card"`, from the tools page or MCP. |

## The window

- **Pill.** Fps now, the spikes of the last 6 s, the link light and REC. A tap opens the card.
- **Card.** Docked to the left or right edge, dragged by its grip, snapped inside the safe area. The device remembers place, mode and tab.

| Tab | What it shows |
|---|---|
| **Frames** | The frame graph of the last 6 s with the cause of every spike (gpu, upload, compile, long frame, js, gc?, gap), the counters, and the spike record. **STALE** when the phone's engine differs from the computer's. |
| **Game** | Only the commands the game marked in its `.dev` module with `overlay: "toggle"` or `overlay: "button"`. |
| **Record** | The device log: start, stop, mark, who started it, the files, share, remove. |
| **Link** | The device link the bridge reports, and Connect / Pair to another `host:port`. |

The engine targets 120 fps where the display allows it and falls back to 60 by itself. The
graph's budget line follows each frame's own rate. For an A/B run, force a rate with
`game.frameRate { fps }` from MCP or the tools page.

## The log

Nothing is recorded until someone starts it: the Record tab on the phone, Record in Render, or
an agent through MCP. `editor.record { on?, label?, mark? }` starts, stops and marks, and answers
`{ on, file, startedBy, marked }`.

| `startedBy` | Who |
|---|---|
| `{ by: "phone" }` | The Record tab on the device |
| `{ by: "editor" }` | Record on the tools page |
| `{ by: "agent", name: "Claude Code" }` | An MCP client; the hub stamps its name |
| `"code"` | The game's own code |
| `"auto"` | A game that sets `recorder.autoStart` to `"device"` or `true` |

A log is JSONL, one file per run: `perf-<yyyymmdd>-<hhmm>-<model>.jsonl`. On the phone it goes
to OPFS when the page has it, else to memory, bounded by `recorder.keepMb`. While the phone is
linked, the bridge ships the log to the computer and the hub confirms each batch, so a dropped
Wi-Fi loses nothing. Besides the game's lines the log holds the editor's `devtools`, `command`
and `recorder` events.

## `moku-editor perf`

Run it in the game folder, with the phone on USB or on the same Wi-Fi:

```sh terminal
$ bunx moku-editor perf --lan
```

It prints a panel with five rows: **Phones** (the wired listener), **LAN** (the address a phone
pairs on), **Tools** (`http://127.0.0.1:47600/__editor/#render`), **Logs** (`.moku/perf`) and
**Engine** (the computer's engine fingerprint).

| Switch | Default | Plugin field it sets |
|---|---|---|
| `--lan` | off | `hub.deviceLan`: also listen on the computer's LAN address |
| `--port`, `-p` | `47600` | `hub.devicePort` |
| `--out`, `-o` | `.moku/perf` | `collector.out` |
| `--every` | `10` | `collector.everyS`: seconds between two adb readings of heat and system frames |
| `--no-ui` | tools page on | `pages.toolsPage: false` |

- **Over adb**, every 2 s the collector runs `adb devices` and `adb reverse` for every ready phone, so a phone plugged in later is reached without a restart.
- **Over the LAN**, a phone shows a four-digit code. Type it in the terminal; Enter refuses.
- **Live lines** show one block per phone log: the screen, the rate, fps, p90, GPU ms, spikes and heat. A STALE line warns once when the phone's engine differs from the computer's: rebuild the game so the logs match.
- **The files** are one JSONL file per phone log in `.moku/perf/`. Ctrl+C stops device mode, writes the files and prints the summary of each log.

```sh terminal title="perf tools"
$ bunx moku-editor perf mark "boss"
$ bunx moku-editor perf summary .moku/perf/perf-20261014-1532-sm-a266b.jsonl
$ bunx moku-editor perf compare before.jsonl after.jsonl
```

`perf mark` adds a mark to every live log, from a second terminal. `perf summary` prints one row
per screen and rate:

```text
| screen      | rate | frames | p50 | p90 | p99 | gpu | spikes             | passes | tex MB art/tgt/kept | heap |
|-------------|------|--------|-----|-----|-----|-----|--------------------|--------|---------------------|------|
| garden/boss |  120 |  57600 |   9 |  12 |  25 | 4.8 | 9 (js 5, upload 4) |    6.2 |         96 / 32 / 6 |  151 |
| garden/boss |   60 |  15000 |  17 |  19 |  45 | 6.1 | 7 (upload 6, js 1) |    6.2 |         96 / 32 / 6 |  151 |
```

`perf compare` puts two logs side by side, with ▲ at 10 % worse or more and ▼ at 10 % better or
more. The exit code stays 0; a closing warning counts the screens that got worse.

```text
| screen      | rate |    p90 A → B |    p99 A → B | spikes/min A → B | gpu A → B |       worse |
|-------------|------|--------------|--------------|------------------|-----------|-------------|
| garden/boss |  120 | 18 → 13 ▼28% | 31 → 25 ▼19% |   1.2 → 0.6 ▼50% | 6.1 → 5.9 |             |
| settings    |   60 |      17 → 17 | 22 → 26 ▲18% |      0.0 → 0.4 ▲ | 3.0 → 3.1 | p99, spikes |
```

## What degrades

| Missing | What happens |
|---|---|
| The engine's renderer monitor | perf is off with its reason, the recorder records nothing, the `editor.perf.*` sources are `available: false`. |
| A GPU timer | GPU cells read `—` with "no timer". The causes come from the other columns. |
| OPFS | The log stays in memory, bounded by `keepMb`, and is gone with the page. |
| A native share sheet | Share downloads the file. |
| `adb` on the computer | No USB link, no heat and system frames, no wired telemetry. A LAN phone pairs and logs as usual. |
| WebView debugging in the build | No CDP: the phone's JS heap reads not available. GPU, CPU and memory still read over adb. |
| An iPhone or iPad | No iOS debug build yet: nothing to link. |

:::gotchas
- **A release build has no agent.** Use `build --debug` for the phone tools.
- **Nothing records by itself.** `recorder.autoStart` is `false` unless the game opts in.
- **A log over 32 MiB is refused for the native share.** Pull it with `moku-editor perf` over adb instead.
- **`.moku/perf.json` holds the hub token while perf runs.** Keep `.moku/` in `.gitignore`.
:::

## Related

- [The Render workspace](/docs/editor/guides/render-workspace/): Connect device and Mission control.
- [agent plugins](/docs/editor/plugins/agent/): `perf`, `recorder`, `overlay`, `bridge`.
- [Production builds](/docs/editor/guides/production-builds/): why a release build carries nothing.
