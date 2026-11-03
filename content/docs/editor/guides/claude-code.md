---
title: Claude Code
description: "moku-editor mcp: a stdio MCP server that lets Claude read the game, run its commands, take screenshots and edit files."
section: Guides
order: 10
---

## How it works

`moku-editor mcp` is a stdio MCP server. Claude Code starts it. It uses the running editor, or
starts one. It gives Claude 22 generic `moku_*` tools, and on top of them one tool per command
door of the connected game.

## Register it

:::steps
1. **Add the server** from the game folder. A moku-game folder needs no HTML file.

   ```sh terminal
   $ claude mcp add moku-editor -- bunx moku-editor mcp
   ```

   A game with its own page names the file and the port: `claude mcp add moku-editor -- bunx moku-editor mcp web/index.html --port 3000`.

2. **Or commit a project `.mcp.json`.** `bunx moku-editor mcp-config web/index.html --port 3000` prints it.

   ```json file=".mcp.json"
   {
     "mcpServers": {
       "moku-editor": {
         "type": "stdio",
         "command": "bunx",
         "args": ["moku-editor", "mcp", "web/index.html", "--port", "3000"]
       }
     }
   }
   ```

3. **Ignore the editor's files.** Add `.moku/` to `.gitignore`. The bin writes `.moku/editor.json` with its port and the per-start token. A bin the bridge starts logs to `.moku/editor.log`.

4. **Keep the game page visible.** Open the game or the tools page in a browser, or in Claude's browser pane. A paused game or a hidden tab answers "game paused or hidden at frame N", not a timeout.
:::

`claude mcp list` then shows `moku-editor` as connected.

## Which editor the bridge uses

- **A running bin wins.** The bridge finds it through `.moku/editor.json` under `--root`, by default the working directory.
- **No bin runs.** The bridge starts `moku-editor <html> --port <port>` itself. In a moku-game folder it starts the engine page.
- **Claude Code closes.** The bridge stops the bin it started. A bin you started yourself keeps running.

## The tools

Call `moku_status` first. Every game tool takes an optional `session`.

| Tool | What it does |
|---|---|
| `moku_status` | Is the editor running, did the bridge start it, URLs, hot reload, sessions. |
| `moku_sessions` | The connected games, each with `heartbeat { frame, paused, silent }`. |
| `moku_manifest` | The game's sources and commands: ids, inputs, effects. |
| `moku_read` | Reads a source, such as `game.position`. |
| `moku_wait` | Waits until a source equals a value, leaves a value, or changes. At most 25 s. |
| `moku_run` | Runs a command, such as `game.pause`. The answer starts with its effect. |
| `moku_screenshot` | A JPEG of the game, at most 1080 px wide by default. `key` crops it to one ui element; `format: "png"` keeps it lossless. |
| `moku_series` | A contact sheet: 2 to 12 frames, `everyMs` of game time apart, on one JPEG. |
| `moku_reference` | The newest or a named reference card with its crop. |
| `moku_selection` | What is selected in the tools page: key, name, type, `file:line`, rect, card, crop, the reference line and the pending style `edits`. |
| `moku_select` | Selects an element by `key`, an area by `rect`, or a flow node by `node`. Needs the tools page open. |
| `moku_device` | Reads or sets the device of the tools page: `preset`, `orientation`, `folded`. Needs the tools page open. |
| `moku_show` | Switches the tools page to `flow`, `game`, `render`, `state`, `files` or `console`. Needs the tools page open. |
| `moku_files_list` | Lists project files. |
| `moku_files_read` | Reads a file and its version. |
| `moku_files_write` | Writes a file, with an optional version check. |
| `moku_files_find` | Where a key of the project index lives, such as `node:board/merge` or `jsx:coins`. |
| `moku_project` | The project index: key counts per kind, the keys of a `prefix`, or what one file defines and uses. |
| `moku_reload` | Reloads the game page and restores its state. |
| `moku_hot_reload` | Switches Bun hot reload on or off. The server restarts; the call returns once it is back. Call `moku_reload` after it. |
| `moku_start` | Starts the editor when it does not run. |
| `moku_stop` | Stops the editor, only when the bridge started it. |

The file tools stay in the files sandbox. They never show or touch `.moku/editor.json` or
`.moku/editor.log`. The bridge never prints the token.

## Door tools

After the generic tools, the list holds one tool per command door of the selected session. Each
has a typed input schema, so Claude does not guess the `input` of `moku_run`. Sources stay behind
`moku_read`.

| Rule | What it means |
|---|---|
| Name | The door id with `.` as `_`: `game.tap` is `game_tap`. Cheat and raw doors carry the effect first: `cheat_game_fill`, `raw_game_restore`. |
| Input | One property per door field (`string`, `number`, `boolean`, `json`). Fields without `?` are required. `_session` picks another session. |
| Answer | The same as `moku_run`: `effect: <effect>`, then `{ value, frame, state }`. |
| Session | The one `moku_run` uses without `session`: the only one, else the embedded one. Several sessions and none embedded: no door tools. |
| Change | The bridge rebuilds the list, and sends `notifications/tools/list_changed`, only when the hash of the game's commands moves. A hot reload of the same game keeps the list. |

Screenshots go only through `moku_screenshot`, so `game.capture` and the `editor.*` capture
commands get no door tool. A name longer than 40 characters or one that starts with `moku_` gets
none either. `moku_run` still runs every door.

Deny the cheat and raw doors in the Claude Code settings:

```json
{ "permissions": { "deny": ["mcp__moku-editor__cheat_*", "mcp__moku-editor__raw_*"] } }
```

## Pick an element, fix it in code

The tools page publishes what is selected. Claude reads it with `moku_selection`.

:::flow
- pick in Game
- reference line
- **moku_selection**
- edit the source
- hot reload
:::

A pick with the element picker copies one [reference line](/docs/editor/guides/tools-page/) for
the chat and writes a card file next to the captures. Style changes you make in the Element tab
stay pending: the editor does not write the file. They reach Claude in `moku_selection` as
`edits`, each `{ path, from, to }`. A text style edit has the path `textStyle:<key>#<field>`. An
edit leaves by itself once the game shows the new value.

`moku_select { key }` or `moku_select { rect }` selects from the chat. The tools page picks it
like a click, without the clipboard, and answers the selection.

:::gotchas
- **Screenshots need the page on screen.** A hidden tab answers with the frame it stopped at.
- **`moku_select`, `moku_device` and `moku_show` need the tools page open.** The game page alone does not answer them.
- **A client that ignores `list_changed` keeps old door tools.** A door that is gone answers `isError`. `moku_run` always works.
- **`moku_hot_reload` restarts the server.** Every socket drops for about a second. Call `moku_reload` after it.
:::

## Related

- [The tools page](/docs/editor/guides/tools-page/): the picker, the card, the style edits.
- [Project index](/docs/editor/guides/project-index/): what `moku_files_find` and `moku_project` read.
- [On a phone](/docs/editor/guides/on-a-phone/): `editor.record` from an agent.
