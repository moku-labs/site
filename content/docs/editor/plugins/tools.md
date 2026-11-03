---
title: tools
description: "The editor-tools core on the tools page: link, activeSource, workspace, panels and the six workspace views."
section: Plugins
order: 22
---

## What it is

`@moku-labs/editor/tools` is the `editor-tools` core. It runs on the tools page in a browser. The
page the server serves is this core, prebuilt. All ten plugins are defaults.

| Plugin | Tier | Purpose |
|---|---|---|
| `link` | Complex | The page's only connection to the server. |
| `activeSource` | Standard | One source per page: the local preview, a phone or another page. |
| `workspace` | Complex | The shell: top bar, rail, palette, toasts, keys, devices, the game frame. |
| `panels` | Standard | The panel host for `definePanel` specs. |
| `flowView` | VeryComplex | The Flow workspace. |
| `gameView` | Complex | The Game workspace, the default. |
| `renderView` | Complex | The Render workspace, Mission control. |
| `stateView` | Standard | The State workspace. |
| `filesView` | Complex | The Files workspace. |
| `consoleView` | Standard | The Console workspace. |

A custom composition with `workspacePlugin` or `renderViewPlugin` composes `activeSourcePlugin`
right after `linkPlugin`. Options are on [Configuration](/docs/editor/configuration/).

## link

The page's only connection: the boot JSON, one socket, the session choice, the remote
`EditorChannel`, the files client, the link status, the hot reload state and the computer's
engine. It publishes the selection and answers `editor.select`.

API: `read`, `watch`, `run`, `status`, `manifest`, `onManifest`, `sessions`, `choose`, `retry`,
`boot`, `frameUrl`, `files`, `hotReload`, `setHotReload`, `selection`, `notify`, `handle`,
`engine`, `onEngine`, `published`, `onPublished`, `onSessions`, `onHeartbeat`, `ownSession`,
`runIn`, `callEditor`.

## activeSource

One source per tools page. It pauses the local preview while a phone is the source and resumes it
after. It follows phones that link and leave: the notice, the timeline markers, a rejoin within
`rejoinMs`. It holds connect's scan and watch leases and estimates a phone's clock offset.

API: `current`, `preview`, `useDevice`, `useLocal`, `onChange`, `directory`, `scan`, `connectWire`,
`connectNetwork`, `connectDevice`, `confirmPairing`, `refusePairing`, `stopDevices`, `telemetry`,
`onTelemetry`, `markers`, `notice`, `reconnect`, `label`, `health`, `clockOffsetMs`, `openConnect`.

## workspace

The shell: the top bar with the game mark, the engine, the Hot reload toggle and the ⋯ menu, the
rail, the palette, toasts, keys and Esc, the preferences, the twenty-one devices, the one game
iframe, the source pill, the disconnect notice and the paused veil.

API: `show`, `device`, `setDevice`, `gameFrame`, `palette`, `toast`, `keys`, `mount`, `host`,
`setOverlayInGame`, `hotReload`, `copyOnSelect`, `setCopyOnSelect`, `scenarios`, `setScenario`,
`startLocalPreview`.

## panels

The panel host. It watches sources, waits for the first values, marks stale data and re-checks on
a manifest change. A view registers a spec in its `onInit`. See
[Writing a plugin](/docs/editor/guides/writing-a-plugin/).

API: `register`, `run`, `list`, `mountInto`.

## flowView

The Flow workspace: a canvas of the flow graph with ELK layout, focus, a trail, and the Inspector
with its Info and Code tabs.

API: `camera`, `focus`, `flows`, `layout`.

## gameView

The Game workspace, the default. The device stage with one Fit scale per kind, the device frames
and Fold, the Sound and Copy Ref switches, the element picker, the style card, the Code section,
the Styles fields with their pending edits, area drags, the pick for the chat, the selection
published to MCP, screenshots, series, the capture card and the contact sheet. It reads no scene
from a phone. See [The tools page](/docs/editor/guides/tools-page/).

API: `pick`, `inspect`, `scene`, `locate`, `capture`, `series`, `openSheet`, `copyReference`,
`fold`, `bookmarks`, `editStyle`, `clearEdits`, `edits`, `copyEdits`.

## renderView

The Render workspace, Mission control, of the page's one source: the connection bar and the
Connect panel, the 2-minute frame timeline, range selection and its inspector, the cards, Record
and Monitoring, and Scene details. See [The Render workspace](/docs/editor/guides/render-workspace/).

API: `mission`, `inspect`, `pause`, `live`, `setSpan`, `seek`, `select`, `step`, `jump`, `setRate`,
`setSection`, `setOverdraw`, `record`, `mark`, `snapshot`, `reveal`, `highlight`, `sortTextures`,
`filterBundle`, `refresh`.

## stateView

The State workspace: the player and session trees, the last commit derived by diffing
`game.model`, and the runner.

API: `lastCommit`, `onCommit`, `note`, `tainted`, `expandAll`.

## filesView

The Files workspace: the project tree, tabs, a viewer, an in-place editor, previews, the conflict
bar and Used by.

API: `open`, `save`, `resolveConflict`, `fileOf`, `usedBy`, `editorUrl`.

## consoleView

The Console workspace: `game.log` as a table, a level filter, search, Preserve log, command errors
and a rail badge.

API: `lines`, `visible`, `counts`, `setFilter`, `clear`, `focusFrame`.

## Events

| Event | Kind | Emitted by | Hooked by |
|---|---|---|---|
| `link:status` | global | link | workspace, panels, all six views |
| `link:project` | global | link | flowView, gameView, renderView, filesView |
| `workspace:changed` | global | workspace | panels, flowView, gameView, renderView, filesView |
| `workspace:ran` | global | workspace, panels | stateView, consoleView |
| `workspace:density` | global | workspace | flowView |
| `workspace:open-file` | global | flowView, gameView | filesView |
| `workspace:select-node` | global | filesView | flowView |
| `workspace:focus-frame` | global | consoleView | flowView |
| `workspace:reveal` | global | gameView | renderView |
| `workspace:inspect` | global | renderView | gameView |
| `workspace:open-sheet` | global | filesView | gameView |
| `activeSource:changed` | per-plugin | activeSource | workspace, renderView |
| `activeSource:connect-requested` | per-plugin | activeSource | renderView |

Payloads are on [Events](/docs/editor/events/).

:::gotchas
- **No view depends on another view.** Cross-view requests are the global `workspace:*` events.
- **Only `renderView` requires `activeSource`.** `stateView` does not require `workspace`.
- **The Game workspace reads no scene from a phone.** Switch to the local preview to pick.
:::
