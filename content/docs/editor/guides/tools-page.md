---
title: The tools page
description: "The top bar, the element picker, the reference line and card, the Game workspace and hot reload."
section: Guides
order: 12
---

## How the page is laid out

The tools page is served by the server at `{path}/`, `/__editor/` by default. A top bar, a rail
with six workspaces, and one game frame. Game is the default workspace.

| Key | Does |
|---|---|
| ⌘1 to ⌘6 | Game, Flow, Render, State, Files, Console |
| ⇧⌘C or I | The element picker |
| G | Game preview |
| O | Overlay in game |
| H | Hot reload |
| M | Sound, in Game |

## The top bar

The bar picks its layout from the window width.

| Width | The bar shows |
|---|---|
| 900 px and wider | The game mark, the game name, the source pill, the session chip, the computer's engine fingerprint (from 1100 px), the link pill, Pause, Step, the search box, the switches Preview, Overlay and Hot reload, Registry and the theme. |
| Below 900 px | The game mark, the game name, the source pill, the link pill, Pause and Step as icons, the Hot reload icon, a search icon and **⋯**. |
| 560 px and narrower | As below 900 px, without the game name. |

The **game mark** is the initials of the game name on a tile coloured from the name, so two games
in two panes are told apart at a glance. The **⋯** menu holds Game preview, Overlay in game, Hot
reload, Registry, Density and Theme. The **source pill** names the page's one source: the local
preview or a phone. See [The Render workspace](/docs/editor/guides/render-workspace/).

## Pick an element

The element picker is the one way to pick: the Select button of the Game toolbar, ⇧⌘C or I.
While it is on, the cursor over the game is a crosshair.

| Copy Ref | A click of the picker | A drag of the picker |
|---|---|---|
| On (default) | Selects the element, saves the pictures and the card, copies the reference line. | Picks an area. |
| Off | Only selects the element for the Element tab. No file, no clipboard. | Picks nothing. |

Copy Ref is a switch of the Game toolbar, the preference "Copy reference on select". With it off,
**Copy reference** in the Element tab still writes the card and copies its line on demand.

### The reference line and card

A pick bookmarks the game (`game.bookmark`), saves the element and the whole frame as JPEGs in
today's folder `<capturesDir>/<yyyy-mm-dd>/`, writes a card file next to them, and puts one line
on the clipboard. Paste the line into the chat:

```text
@moku settingsBoard panel · settingsPopup/open · features/settings/settings.tsx:290 · ref 65,641 950×1060 · .moku/captures/2026-10-05/settingsBoard-f212.md
```

The line names the element, its flow node, its code, its place and the card. The card
`<key>-f<frame>.md` is Markdown: a title, the full reference block, the JSX and the style block
with their `file:line`, and the two pictures.

| Line of the block | Says |
|---|---|
| `@moku` | Name, type, the flow and node of the game position, the frame. |
| `path` | The ui path, or `entity #<id>` with up to 5 components. |
| `source` | `file:line` of the key from the project index, the style identifier with its `file:line`, the nine-slice or texture. |
| `layout` | Up to 3 ui parents, nearest first: direction, padding and margin as `t/r/b/l`, gap. |
| `bounds` | The rect in device px, then in the game's reference units (`ref`). |
| `state` | Visible or hidden, the true flags, the text, alpha. |
| `flow` | The position stack, and the last edge with its frame. |
| `game` | Name and version, session, frame, time, live or paused, clean or tainted. |
| `device` | Preset, size, orientation, pixel ratio, safe insets. |
| `restore` | The bookmark id. `gameView.bookmarks()` keeps the last 20. |
| `shot` | The crop, the element plus 8 px, and the full frame in the day folder. |

A line that is not known is left out. Run `game.restore` with the bookmark to go back to that
moment.

### An area

With the picker on, a press that moves 4 px or more drags a marquee. The release picks the
elements fully inside it, else the ones it covers by at least half, group roots only, at most 40.
The card lists one line per element with its child tree, the `layout:` chains, the
`partly in the area:` line and the code of every element. Esc during the drag cancels it.

## The Game workspace

| Control | What it does |
|---|---|
| **Sound** (M) | Runs `game.mute { muted }` when the game lists it, and keeps the flag with your preferences, so it survives a hot reload. |
| **Copy Ref** | The preference "Copy reference on select". On by default. |
| **Select** (⇧⌘C or I) | The element picker. Lit while it is on. |
| **Styles** | Every value of the element's style as a field. A change is a pending edit, not a write. |
| **Text style** | The fields of the text's style key. An edit applies to every text with that key. |
| **Code** | The JSX of the picked element and its `defineStyle` block, each with `file:line` and "Open in Files". |
| **Capture card** | After a Shot, a pick or a Series: a thumbnail, the path, Copy link, Open. |

### Style edits for the agent

The editor does not write a style file, and the game does not change until the source is edited.
An edited row shows the old value struck through. The edits bar counts them and has **Copy for
agent** and **Clear**. Copy for agent puts one block per element on the clipboard:

```text
@moku homePlay · features/stage/views/home-screen.tsx:199
minWidth: 556 -> 600
padding.top: 25 -> 30
```

The same edits reach Claude through `moku_selection`. An edit leaves by itself once the game shows
its new value: the agent wrote the code and hot reload brought it in. From code:
`gameView.editStyle(path, to)`, `clearEdits(scope?)`, `edits()` and `copyEdits()`.

## Hot reload

The bin serves the game with Bun hot reload on. A save of a game source, by the editor or by an
agent, goes like this:

:::steps
1. Bun tells the page it will reload. The bridge takes a `game.bookmark` and keeps it in `sessionStorage`.
2. The new page restores the bookmark, then says hello with `manifest.restored`.
3. The tools page toasts "Game reloaded · state restored". It does not reload a second time.
:::

**Hot swap.** A game that lists the engine's Bun plugin in the `bunfig.toml` of its root swaps a
saved view module in place, with no reload. The toast says "Game updated".

```toml file="bunfig.toml"
[serve.static]
plugins = ["@moku-labs/game/hot"]
```

A view module is a `.tsx` file, a `styles.ts`, a `view.ts`, an `animations.ts`, an `effects.ts`,
a generated `generated/strings.<locale>.ts`, or a `.ts` directly in `styles/`, `motion/`,
`effects/`, `views/`, `world/projections/` or `world/layout/`. A logic module (rules, nodes, flows,
state) still reloads the page and restores the bookmark.

**The editor stands still.** During a reload the top bar keeps the game name and the session, the
panels keep their data, and one spinner on the game frame shows the reload. Only when the game has
not come back within `link.reloadGraceMs` does the red bar show.

**The Hot reload switch** (H) turns it off and on while the bin runs. Bun cannot switch HMR on a
running server, so the bin restarts its server on the same port and keeps its token. Every socket
drops for about a second, and the game comes back with its state. A game that serves itself with
its own `Bun.serve` owns the setting: the switch is inert there. Without hot reload, a save in the
editor still keeps the state: the editor bookmarks, reloads the frame and restores.

## Compose your own tools page

The tools page is itself a Moku app. Start the tools core and mount the shell:

```ts file="src/tools.ts" check
import { createApp } from "@moku-labs/editor/tools";

const tools = createApp({ pluginConfigs: { workspace: { defaultWorkspace: "flow" } } });
await tools.start();

const root = document.querySelector<HTMLElement>("[data-editor-root]");
if (root) tools.workspace.mount(root);
```

:::gotchas
- **The picker is the one way to pick.** There is no reference mode and no key R.
- **Style edits are never written by the editor.** Claude or you edit the source; the edit then leaves by itself.
- **`gameView.capturesDir` must be `.moku/captures` or a folder under it.**
- **Hot swap needs the `bunfig.toml` line in the game root.** Without it every save reloads the page.
:::

## Related

- [Claude Code](/docs/editor/guides/claude-code/): `moku_selection` and `moku_select`.
- [Project index](/docs/editor/guides/project-index/): where the Code section gets its lines.
- [tools plugins](/docs/editor/plugins/tools/): `workspace`, `gameView` and their APIs.
