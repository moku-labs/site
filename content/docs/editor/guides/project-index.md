---
title: Project index
description: "The editor never guesses where game code lives: every view asks the game's project index for a key."
section: Guides
order: 11
---

## How it works

The editor does not guess where game code lives. It asks the game's **project index**,
`@moku-labs/game/project`. The server's `files` plugin opens the index of its root on start
(`openProject({ root })`, not awaited) and keeps it fresh with the index's watch. The bin prints
`files:project-on { files, keys, ms }` once it is open.

The index needs `typescript` in the game repository. It needs no `bunfig.toml`: that file only
loads the hot swap plugin.

## Two ways to read it

| Way | Call | What it gives |
|---|---|---|
| Lines | the files request `find { key }`, `link.files.find(key)` | The path, the line and range read from disk at the call, and the `hash` of the bytes, which equals the files `version`. |
| Key maps | the published state `editor.project`, `link.project()`, the event `link:project` | On or off, the revision, the manifest path, key → def paths, key → use paths, broken files, the last change. |

JSX keys never ride the published state. Only `find` reaches them.

## Keys per view

Every view asks the index first and only the index.

| View | Keys |
|---|---|
| Flow | `node:<flow>/<node>`: the Code tab, the file of a node |
| Game | `jsx:<key>` (the picked element), `style:` (its style block), `projection:` (an entity), `textStyle:`, `component:` (the area card) |
| Files | `flow:` and `node:` definitions and their uses (Used by) |
| Game, Render | `ProjectState.manifest`, the asset manifest |

From Claude Code, `moku_files_find` answers one key and `moku_project` lists keys per kind, per
prefix or per file. See [Claude Code](/docs/editor/guides/claude-code/).

## Moves and edits are followed

An agent may move and edit files while the editor is open. A watch batch names the changed,
moved and removed files. Open Files tabs follow a move ("Moved from nodes/catch-up.ts"), Used by
and the Code tab read again, and the views drop the caches the batch names.

## What a view says

| Message | Why |
|---|---|
| `Project index is off: <reason>` | The index could not open: no `typescript`, a game without the index, or `pluginConfigs.files.project: false` (reason `disabled`). The server logs `files:project-off { reason }`. MCP and the game keep working. |
| `Not in the project index: <key>` | The index has no answer for that key. No crawl, no guess. |
| `The file does not parse now · fix it, then edit` | A style edit on a file the index marks broken writes nothing. |

## The version check

A write with a `version` compares it right before the rename, after the temp file is written. A
conflict answers -32005 and keeps the other bytes. An external write that lands between that check
and the rename is still overwritten: the window is narrowed, not closed.

:::gotchas
- **A key built in a loop answers the line of the element that builds it.** `card0`, `card1` and the rest share that one line.
- **Turn it off with `files: { project: false }`.** Every view that needs a code location then says the index is off.
:::

## Related

- [server plugins](/docs/editor/plugins/server/): `files` and its `find`, `project` API.
- [The tools page](/docs/editor/guides/tools-page/): the Code section of the Element tab.
