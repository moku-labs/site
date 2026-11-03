---
title: server
description: "The editor-server core in Bun: files, hub, connect, collector, pages, and the moku-editor bin."
section: Plugins
order: 21
---

## What it is

`@moku-labs/editor/server` is the `editor-server` core. It runs on Bun: it uses `Bun.serve` and
HTML imports. It has no opt-in plugins; all five are defaults.

| Plugin | Tier | Purpose |
|---|---|---|
| `files` | Standard | The project-root sandbox, the project index, the computer's engine fingerprint. |
| `hub` | Complex | The websocket switchboard: guard, token, sessions, routing, device listeners. |
| `connect` | Complex | Connect a phone from the tools page, and its wired telemetry. |
| `collector` | Complex | Device logs on the computer: one JSONL file per phone log. |
| `pages` | Complex | Serves the tools page. Home of the `moku-editor` bin. |

A custom composition keeps the order: `connectPlugin` between `hubPlugin` and `collectorPlugin`,
and `collectorPlugin` before `pagesPlugin`. Options are on
[Configuration](/docs/editor/configuration/).

## files

The project-root sandbox: list, read, an atomic write with a version check, image captures, the
[project index](/docs/editor/guides/project-index/) and the computer's engine fingerprint. A file
must match the `allow` globs and none of the `deny` globs.

API: `list`, `read`, `write`, `writeBinary`, `writeDataUrl`, `readBinary`, `resolve`, `root`, `find`, `project`,
`engine`, `refreshEngine`.

## hub

The websocket switchboard. It guards each upgrade with Host, Origin and the token, opens sessions,
routes requests, fans out values, applies backpressure, and sends the `hotReload` and `engine`
notifications. It keeps the tools page's selection and relays `editor.select` to it. In device
mode it runs the device listeners (adb and LAN), the pairing and a ping for each phone's latency.

API: `serve`, `token`, `sessions`, `fetch`, `websocket`, `addRoutes`, `guard`, `publish`,
`closeAll`, `path`, `listenDevices`, `stopDevices`, `devices`, `listenLan`, `stopLan`,
`addEditorMethods`.

`serve(options)` wraps the game's `Bun.serve` options: it forces `127.0.0.1`, merges the game's
routes, the routes from `addRoutes` and `{path}/ws`, and adds the websocket handler. Call it once,
after `start()`. `addEditorMethods` registers another plugin's editor methods, such as
`connect.*`, for tools sockets only.

## connect

Connect a phone from the tools page. It turns device mode on and off on request, keeps the device
directory (`editor.devices`: phones adb lists, pairings asking, linked devices), confirms a
pairing in the page, and for a phone by wire reads CDP over `adb forward` and the wired telemetry
(`editor.deviceTelemetry`, once a second).

| Kind | Names |
|---|---|
| API | `directory`, `telemetry` |
| Editor methods | `connect.scan`, `connect.wire`, `connect.network`, `connect.off`, `connect.confirm`, `connect.refuse`, `connect.watch`, `connect.unwatch` |

The editor methods answer only tools sockets. Errors: `port_in_use` when another process holds the
device port, `no_lan`, `not_owner` when device mode belongs to `moku-editor perf`, `no_ticket`.

## collector

Device logs on the computer: one JSONL file per phone log, `adb reverse`, heat and system frames
while device mode is on, a wired phone's `telemetry` lines while it records, and the route of
`perf mark`. On a dev server it is idle. It houses the summary and compare of
`moku-editor perf`.

API: `sessions`, `mark`, `adb`, `settled`.

## pages

Serves the prebuilt tools page with its boot JSON, its assets, and the `hello` and `hmr` routes.
It is the home of the `moku-editor` bin, of `moku-editor mcp` and of `moku-editor perf`.

API: `routes`, `attachServer`, `hotReload`, `setHotReload`, `attachPerf`.

| Command | What it does |
|---|---|
| `moku-editor [--root DIR]` | Serves a moku-game folder's engine page with the editor. |
| `moku-editor <game-html>` | Serves a game's own HTML page with the editor. |
| `moku-editor mcp` | The stdio MCP server for Claude Code. See [Claude Code](/docs/editor/guides/claude-code/). |
| `moku-editor mcp-config` | Prints the `.mcp.json` snippet and the `claude mcp add` line. |
| `moku-editor e2e -c <config>` | One Playwright run per project and spec file, each on its own `PORT`. |
| `moku-editor perf` | Phones over adb or the LAN: logs, heat, live lines. See [On a phone](/docs/editor/guides/on-a-phone/). |
| `moku-editor perf mark`, `summary`, `compare` | A mark in every live log, the summary of a log, two logs side by side. |

`moku-editor e2e` gives each spec file a fresh bin, because Bun's dev server degrades after many
hot reloads in one process. A run holds `.moku/e2e.lock`, so two runs never overlap.

## Events

| Event | Kind | Emitted by | Hooked by |
|---|---|---|---|
| `hub:session` | global | hub | your plugins |
| `files:written` | global | files | none yet |
| `files:project` | global | files | hub |
| `hub:device` | per-plugin | hub | collector, connect |
| `connect:telemetry` | per-plugin | connect | collector |
| `collector:session` | per-plugin | collector | pages |

Payloads are on [Events](/docs/editor/events/).

:::gotchas
- **The server needs Bun.** It uses `Bun.serve` and HTML imports.
- **`files.root` must be an existing folder.** The editor reads and writes nothing outside it.
- **`.env` files, `node_modules`, `.git` and `dist` are denied** by default, for list, read and write.
:::
