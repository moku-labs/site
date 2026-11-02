---
title: "@moku-labs/editor"
description: "Devtools for a running game: flow, state, render."
section: Get started
---

## Overview

`@moku-labs/editor` is the devtools for a running `@moku-labs/game`. One tools page shows the
flow, the state, the render and the files of the live game, and lets you change them. It is a dev
dependency: nothing of it ships in a release build.

- **One shared command registry.** The overlay, the tools page, MCP and a test read the same
  sources and commands.
- **Public interfaces only.** The editor touches the game only through `@moku-labs/game/inspect` and
  `@moku-labs/game/control`. No private hooks, no engine fork.
- **Edits keep the game state.** A save reloads the game page and restores the bookmark taken
  before the save.

## Install

```sh terminal
bun add -d @moku-labs/editor @moku-labs/game typescript
```

## Quick start

In a moku-game folder, the one with `index.ts` and `config.ts`, run the editor:

```sh terminal
bunx moku-editor --root .
```

It prints the two pages:

```text
Game   http://127.0.0.1:3000/
Tools  http://127.0.0.1:3000/__editor/
Root   /home/dev/timber
```

The engine writes the dev page with the editor's agent on it, so the game needs no HTML file and
no dev entry.

| Flag | Default | What it does |
| --- | --- | --- |
| `--root`, `-r` | `.` | The game folder. |
| `--port`, `-p` | `3000` | Port on `127.0.0.1`. `0` picks a free port. |
| `--no-hmr` | hot reload on | Serves the game without hot reload. |
| `--packed` | loose files | Serves the packed assets of `moku-game pack`. |

:::callout
The server binds `127.0.0.1` only and checks Host, Origin and a per-start token. It reads and
writes files only inside the project root.
:::

## Use with Claude Code

`moku-editor mcp` is a stdio MCP server. Register it from the game folder, and Claude can read the
game, run commands and take screenshots:

```sh terminal
claude mcp add moku-editor -- bunx moku-editor mcp
```

## Start with Claude

```text prompt
Build a blog with tags and an RSS feed on @moku-labs/web
```

```text prompt
Add a D1-backed comments API with @moku-labs/worker
```

```text prompt
Make a couch quiz game: TV shows questions, phones answer
```

```text prompt
Ship this app to macOS and iOS
```
