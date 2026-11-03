---
title: How it works
description: "Three cores: the agent on the game page, the server in Bun, the tools page. One JSON-RPC wire between them."
section: Get started
order: 3
---

## The picture

The game page and the tools page never talk directly. Both talk to the server.

:::flow
- game page
- **agent**
- **server**
- **tools page**
- you
:::

| Piece | Core | Runs on | Plugins |
|---|---|---|---|
| Agent | `editor-agent` | the game page, or headless Bun | `registry`, `channel`, `perf`, `recorder`, `overlay`; opt-in `bridge`, `capture` |
| Server | `editor-server` | Bun | `files`, `hub`, `connect`, `collector`, `pages` |
| Tools | `editor-tools` | the tools page | `link`, `activeSource`, `workspace`, `panels`, and six views |

Every core registers the core plugins `log` and `env` from `@moku-labs/common`, so `ctx.log` and
`ctx.env` exist on every plugin context. Each core has its own config and its own events.

## A request, step by step

:::steps
1. **The agent wraps the game's doors.** The `registry` turns each door of `@moku-labs/game/inspect` and `@moku-labs/game/control` into an entry: raw `Json` in, checked input to the door, wire-safe `Json` out. It builds the `Manifest`.
2. **The bridge says hello.** It fetches `{path}/hello` for `{ ws, token }`, opens the socket with `kind=agent`, sends `hello { manifest }`, then a `heartbeat` every `heartbeatMs`.
3. **The hub opens a session.** The id is `s-` plus 4 hex digits. The hub emits `hub:session` and routes `game` requests from the tools page to that session, and `files` requests to the files sandbox. One agent-side watch is shared by every tools subscriber.
4. **The link picks the session.** On the tools page, `link` reads the boot JSON that `pages` injected, picks a session, caches its manifest and exposes a remote `EditorChannel`. Every panel reads through it.
5. **A phone joins the same way.** A debug build dials the hub's device listener as `kind=agent role=device`, pairs, and then runs as an ordinary session that every tools page sees.
6. **One source per page.** `activeSource` pauses the local preview before the link picks a phone, and resumes it when the page goes back.
:::

The game frame inside the tools page is a plain same-origin iframe that runs its own agent.

## One channel for every surface

An `EditorChannel` has `read`, `watch`, `run` and `status`. The overlay reads the agent's
in-process channel. The tools page reads the remote one through `link`. MCP and a headless test
go through the same calls. A source or a command is declared once, in the registry.

A tools view is data: `definePanel` returns a frozen spec of sources, commands and a view. The
`panels` host owns every subscription, the stale marking and the teardown. Views never poll. See
[Writing a plugin](/docs/editor/guides/writing-a-plugin/).

## Plugin graph per core

A plugin requires the plugins on its left. No view depends on another view: a request from one
view to another is a global tools event.

| Core | Plugin | Requires |
|---|---|---|
| agent | `channel`, `perf` | `registry` |
| agent | `recorder` | `registry`, `perf` |
| agent | `overlay` | `registry`, `channel`, `perf`, `recorder` |
| agent | `bridge` (opt-in) | `registry`, `channel`, `recorder` |
| agent | `capture` (opt-in) | `registry` |
| server | `hub` | `files` |
| server | `connect` | `hub` |
| server | `collector` | `files`, `hub`, `connect` |
| server | `pages` | `files`, `hub`, `collector` |
| tools | `activeSource` | `link` |
| tools | `workspace` | `link`, `activeSource` |
| tools | `panels` | `link`, `workspace` |
| tools | the six views | `link`, `panels`, `workspace`; only `renderView` also needs `activeSource`; `stateView` does not need `workspace` |

A custom composition keeps this order. `connectPlugin` goes between `hubPlugin` and
`collectorPlugin`. `activeSourcePlugin` goes right after `linkPlugin`.

## The wire

JSON-RPC 2.0 text frames. Each frame has a `channel`, `game`, `files` or `editor`, and forwarded
game traffic has a `session`. The root entry exports the helpers: `encode`, `decode`, `request`,
`notification`, `success`, `failure`, `checkInput`, `toWireValue`, `wireError`, `isRetryable`,
`bareMessage` and the types.

Every error message starts with `[moku-editor] ` (`ERROR_PREFIX`). No stack ever crosses the wire.

| Code | `errorCode` key | `data.reason` | Retryable |
|---|---|---|---|
| -32600 | `invalidRequest` | none | no |
| -32601 | `unknownMethod` | `unknown_id` for an unknown source or command | no |
| -32602 | `invalidInput` | `invalid_input`; `data.field` names the field | no |
| -32000 | `commandFailed` | `command_failed` | no |
| -32001 | `gameReloaded` | `game_reloaded` | yes |
| -32002 | `timeout` | `timeout`, or `link_closed` on the tools side | yes |
| -32003 | `noSession` | `no_session`, `choose_session` | no |
| -32004 | `forbiddenPath` | `forbidden_path` | no |
| -32005 | `versionConflict` | `version_conflict` | no |
| -32006 | `notJson` | `not_json` | no |
| -32007 | `unauthorized` | `unauthorized` | no |
| -32008 | `notInstalled` | `not_installed`: the game does not have the source | no |
| -32009 | `readOnly`, `devOnly` | `read_only`: the build refuses the command; `dev_only`: a page with neither the dev nor the debug flag | no |

A source the game does not have, such as effects in a game without `effectsPlugin`, is listed in
the manifest with `available: false` and a `reason`. Its reads answer -32008. The link neither logs
nor retries them.

**The manifest of a build.** `Manifest.build` is `{ profile, id?, engine? }`, with `profile` one of
`dev`, `full`, `read` or `none`. Every command descriptor carries `allowed`, a `reason`
(`"read-only"` or `"dev-only"`) when the page refuses it, and `overlay` (`"toggle"` or
`"button"`) when the game lists it in the overlay.

**Who ran a command.** The hub stamps each forwarded `run` with `from`: `page` for the tools page,
`mcp` for an agent's MCP bridge, with the client's name. The bridge turns it into the registry's
`via`, so the device log says who ran each command.

## Safe by construction

- **Loopback only.** The server binds `127.0.0.1` and checks Host, Origin and a per-start token before any websocket upgrade.
- **One root.** `files` reads and writes only inside the project root, through an allowlist and a denylist of globs.
- **No shell.** The server spawns `adb` only while device mode runs or the Connect panel lists phones.
- **Phones pair.** The device listener takes only the sockets of paired phones. On the network a phone pairs with a four-digit code.
- **The bridge cleans up.** The MCP bridge starts the bin when none runs, and stops only the one it started.

## Next

- [Events](/docs/editor/events/): every event of the three cores.
- [Plugins](/docs/editor/plugins/agent/): each core's plugins, their APIs and commands.
- [API reference](/docs/editor/api/): the wire helpers and every entry.
