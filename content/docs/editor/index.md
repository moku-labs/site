---
title: "@moku-labs/editor"
description: "Devtools for a running @moku-labs/game: see the flow, the state, the render and the files of the live game, and change them."
section: Get started
order: 1
---

## What it is

`@moku-labs/editor` is the devtools for a running `@moku-labs/game`. One tools page shows the
flow, the state, the render and the files of the live game, and lets you change them. Claude Code
reaches the same game through an MCP server.

It is a dev dependency, not a runtime. Nothing of it ships in a release build.

:::callout{tone="warn"}
**Status: early.** The API can change between minor versions.
:::

### Seven things it does

- **[One registry, every surface](/docs/editor/how-it-works/).** A source or a command is declared
  once. The in-game overlay, the tools page, MCP and a test all read it the same way.
- **[Doors, not hooks](/docs/editor/how-it-works/).** The editor touches the game only through
  `@moku-labs/game/inspect`, `@moku-labs/game/control` and the game's own `.dev` modules. If the
  engine does not expose it, the editor does not see it.
- **[Claude Code sees the game](/docs/editor/guides/claude-code/).** `moku-editor mcp` gives Claude
  tools to read the game, run commands, take screenshots and read what you picked.
- **[Edits keep the game state](/docs/editor/guides/tools-page/).** A save of a game source reloads
  the game page and restores the state it had. A save of a view module swaps in place.
- **[A cockpit on the phone](/docs/editor/guides/on-a-phone/).** A debug build carries the agent:
  a frame graph that names the cause of each spike, and a log on the device.
- **[Mission control](/docs/editor/guides/render-workspace/).** The Render workspace reads one
  source at a time: the local preview, or a phone you connect by wire or on the network.
- **[Loopback and sandboxed](/docs/editor/how-it-works/).** The server binds `127.0.0.1`
  only and checks Host, Origin and a per-start token. It reads and writes files only inside the
  project root.

## Install

```sh terminal
$ bun add -d @moku-labs/editor @moku-labs/game typescript
```

`@moku-labs/game` and `typescript` are required peer dependencies. The editor finds game code
through the game's [project index](/docs/editor/guides/project-index/), which parses the sources
with `typescript`. The server and the `moku-editor` bin run on Bun. The package is ESM only.

## Quick start

:::steps
1. **Install** the editor as a dev dependency in a moku-game folder, the one with `index.ts` and `config.ts`.
2. **Run** `bunx moku-editor --root .` in that folder. The game needs no HTML file and no dev entry.
3. **Open the tools page** at `http://127.0.0.1:3000/__editor/`. The link pill goes from `connecting` to `live · frame N`.
4. **Register the MCP server** with `claude mcp add moku-editor -- bunx moku-editor mcp`.
:::

The [quick start](/docs/editor/quick-start/) covers a game with its own HTML page too.

## Three cores in one package

The game page, the Bun server and the tools page each get their own Moku core. Bun code never
reaches the browser. Preact never reaches the server.

| Entry | Core | Runs on | What it is |
|---|---|---|---|
| `@moku-labs/editor/agent` | `editor-agent` | the game page | The registry of sources and commands, the overlay, perf and the log. |
| `@moku-labs/editor/server` | `editor-server` | Bun | The files sandbox, the websocket hub, device logs, the tools page. |
| `@moku-labs/editor/tools` | `editor-tools` | the tools page | The link to the server and the six workspaces. |
| `@moku-labs/editor` | none | anywhere | The wire protocol and `definePanel`. No runtime. |
| `@moku-labs/editor/agent/page` | `editor-agent` | the engine's page | The page agent the engine puts on the dev page and on debug builds. |

See [How it works](/docs/editor/how-it-works/) and the plugin pages:
[agent](/docs/editor/plugins/agent/), [server](/docs/editor/plugins/server/),
[tools](/docs/editor/plugins/tools/).

## Start with Claude

Register the editor's MCP server, keep the game page open, and ask Claude in plain words. It
reads the game, runs its commands and edits its files through the editor.

```text prompt
Inspect the running game and tell me which flow node it waits in
```

```text prompt
Record a perf log on my phone in the boss fight and summarize it
```

```text prompt
Apply the style edits of the element I picked in the editor
```

```text prompt
Take a contact sheet of the win animation and check its timing
```

## Where to next

- [Quick start](/docs/editor/quick-start/): from install to a live tools page.
- [How it works](/docs/editor/how-it-works/): the three cores, the wire, the events.
- [Claude Code](/docs/editor/guides/claude-code/): the MCP server and its tools.
- [On a phone](/docs/editor/guides/on-a-phone/): debug builds, the overlay, `moku-editor perf`.
- [API reference](/docs/editor/api/): every export of every entry.
