---
title: agent
description: "The editor-agent core on the game page: registry, channel, perf, recorder, overlay, and the opt-in bridge and capture."
section: Plugins
order: 20
---

## What it is

`@moku-labs/editor/agent` is the `editor-agent` core. It runs on the game page, or headless in
Bun. It is the only place the editor touches the game's doors. A debug build on a phone carries
the same core.

| Plugin | Set | Tier | Purpose |
|---|---|---|---|
| `registry` | default | Complex | Wraps the game's doors, `.dev` modules and `editor.*` commands into entries; builds the `Manifest`. |
| `channel` | default | Standard | The in-process `EditorChannel`. |
| `perf` | default | Complex | The performance read model: a 6 s frame window and the cause of each spike. |
| `recorder` | default | Complex | The performance log on the device, off until someone starts it. |
| `overlay` | default | Complex | The editor's window over the game: hidden, pill or card. |
| `bridge` | opt-in | Complex | The websocket from the game page to the hub. |
| `capture` | opt-in | Standard | Screenshots on demand, never on its own. |

`bridgePlugin` and `capturePlugin` are opt-in: a dev entry adds them in `plugins`. The engine's
page agent, `@moku-labs/editor/agent/page`, starts the core with both. Options are on
[Configuration](/docs/editor/configuration/).

## registry

The only place the editor touches the game's doors. It wraps doors, `.dev` modules and `editor.*`
commands into entries, and builds the `Manifest` with the page's build and every command's
`allowed`, `reason` and `overlay` marker. It emits `registry:command` for every run, with who ran
it (`via`). It owns the runtime-free protocol the root entry exports.

| API | What it does |
|---|---|
| `manifest()` | The manifest: sources, commands, the build. |
| `source(id)`, `command(id)` | One entry, or `undefined`. |
| `add(entry)` | Adds an editor command or source. Call it in `onInit`. |
| `envelope()` | Where the game stands now: `{ path, frame, tainted }`. |
| `clock()`, `game()`, `build()` | The clock, the game app, the page's build. |

## channel

The in-process `EditorChannel`: an immediate read on watch, runs off the frame loop, and a timer
heartbeat that beats while the game is paused.

API: `read`, `watch`, `run`, `status`, `heartbeat`, `onHeartbeat`.

## perf

Reads the engine monitor's frame ring four times a second into a 6 s window, ranks the causes of
every spike, and serves the overlay and Mission control's feeds. It is off, with its reason, when
the game has no monitor.

| Kind | Names |
|---|---|
| API | `status`, `readWindow`, `second`, `spikes`, `spike`, `monitor` |
| Sources | `editor.perf.second`, `editor.perf.window`, `editor.perf.spikes`, `editor.perf.spike`, `editor.spikes`, `editor.perf.frames`, `editor.perf.events`, `editor.perf.passes`, `editor.perf.detail` |
| Command | `editor.perf.sections` |

## recorder

The performance log on the device. Nothing records until the phone, the tools page or an agent
starts it, and `startedBy` says who. It keeps every monitor line for hours, in OPFS chunks or in
memory, rotates at `maxLogMb`, shares a finished log, and keeps an outbox the bridge ships. It
also writes the editor's `devtools`, `command` and `recorder` events.

| Kind | Names |
|---|---|
| API | `start`, `stop`, `mark`, `status`, `files`, `share`, `remove`, `unsentRun`, `ack` |
| Commands | `editor.record { on?, label?, mark? }`, `editor.mark` |
| Source | `editor.recorder`, with the last 32 marks |

## overlay

The editor's window over the game, on a phone or a dev page: hidden, a pill, or a card with the
tabs Frames, Game, Record and Link. It sets `globalThis.__MOKU_GAME_OVERLAY__` for the engine's
`app.debug.overlay`. See [On a phone](/docs/editor/guides/on-a-phone/).

| Kind | Names |
|---|---|
| API | `open`, `close`, `toggle`, `isOpen`, `mode`, `commands` |
| Command | `editor.overlay { mode }` |

## bridge

Opt-in. The websocket from the game page to the hub: hello, requests, throttled values, a backoff
reconnect, and the checkpoint across Bun's reload. It runs each hub `run` with who sent it. On a
phone it is the device link: it dials the hub's device listener, pairs by a code and ships the
recorder's log.

| Kind | Names |
|---|---|
| API | `status`, `session`, `link`, `connect` |
| Commands | `editor.reload`, `editor.clock` |

## capture

Opt-in. Screenshots on demand, never on its own. JPEG by default; `format` and `quality` change it.

Commands: `editor.capture`, `editor.series`, `editor.seriesStop`, `editor.sheet`.

## Events

| Event | Kind | Emitted by | Hooked by |
|---|---|---|---|
| `bridge:status` | global | bridge | overlay |
| `overlay:changed` | global | overlay | recorder |
| `overlay:connect` | global | overlay | bridge |
| `registry:command` | per-plugin | registry | recorder |
| `recorder:status` | per-plugin | recorder | overlay, bridge |

Payloads are on [Events](/docs/editor/events/).

:::gotchas
- **`registry.game` is required.** `onInit` throws without it.
- **The bridge and capture are opt-in.** Without the bridge the page never reaches the server.
- **The overlay lists only the game's commands.** A game marks its own `.dev` commands `overlay: "button"` or `"toggle"`.
:::
