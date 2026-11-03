---
title: Hot swap
description: "Save a view file and see it in the running page: same state, same node, no reload."
section: Guides
order: 18
---

## What it does

A save of a view file swaps the module in the running page. Same state, same node, no reload.
You open the Settings popup over Home, change its styles and save: the popup repaints on the next
frame. The flow, the model and the `local` state of every component stay as they were.

It is dev only. `ui` installs the swap handler only when `__MOKU_GAME_DEV__` is `true`, and
`moku-game build` bundles without the plugin.

## Setup

None. `moku-game dev` writes `.moku/bunfig.toml` with the engine's hot plugin first, and runs the
dev server under it in the game folder. The game keeps no `bunfig.toml` and never writes
`import.meta.hot`: the plugin appends a short footer to every view module it loads.

A game with a page and a Bun server of its own lists the plugin itself:

```toml file="bunfig.toml"
[serve.static]
plugins = ["@moku-labs/game/hot"]
```

## What swaps and what reloads

A view module is a `.tsx` file, `styles.ts`, `view.ts`, `animations.ts`, `effects.ts` or a
generated `generated/strings.<locale>.ts`. On the layered layout it is also any `.ts` directly in a
kind folder: `styles/`, `motion/`, `effects/`, `views/`, `world/projections/`, `world/layout/`.

| Saved | What happens |
|---|---|
| Styles, tokens, motions, plain functions | Swap. Every ui root lays out again. |
| Components (`defineComponent`) | Swap. An open instance keeps its `local`. |
| Projections of a registered name | Swap. A mounted one runs its new `view` for every item. |
| Animations | Swap. The next `play` builds the new tree; a running timeline keeps its own. |
| Text styles | Swap. Every label is redrawn with the new style. |
| Emitters | Swap. Live particles keep their old config. |
| A string in `strings/<locale>.json`, a new key too | Swap, through the compiled `generated/strings.<locale>.ts`. |
| An asset file saved with new bytes | Swap. The bundles that hold it read the file again, same key. |
| Logic: `rules/`, `nodes/`, `flows/`, `state.ts`, `tables.ts`, `kit.ts`, a feature `index.ts`, `world/components/`, `world/systems/` | Reload and restore. |
| Scenes, systems, ECS components, filters, features, flows, nodes, plugins | Reload and restore. They are registered by value at start. |
| A new projection or a new animation | Reload and restore. |
| A new, removed or renamed asset file | Reload and restore. The manifest the page booted with is not true any more. |

Anything under `node_modules/`, `web/`, `generated/`, `__tests__/` or `tests/`, and `.test` or
`.spec` files, never swap. The generated strings are the one exception in `generated/`.

## Assets

A texture, a bitmap font or a sound saved with new bytes travels in three steps. The keys watch of
`moku-game dev` writes `.moku/assets-stamp.ts`, which `main.ts` imports. The page accepts the new
stamp with no reload. `assets` reads the changed files of the loaded bundles again and emits
`assets:replaced` `{ bundle, keys }`, once per bundle; `text`, `effects` and `audio` follow it.

- A bundle that is not loaded gets nothing. Its next load reads the new bytes.
- A failed replace keeps the old asset and logs `assets:replace-failed`. The next good save swaps.
- A sound that is playing plays on. A running particle effect of a replaced texture starts again.
- `--packed` watches nothing, and a built game has no hot plugin.

A game plugin that built something from an asset key hooks `assets:replaced` with
`depends: [assetsPlugin]` and builds it again.

## A refusal

A view module that exports something from the reload rows is refused. `ui` logs `ui:hot-refused`
with `{ file, reason }` and throws `[game] Hot swap refused for <file>: <reason>.`; Bun turns the
throw into a full page reload. In the editor, its checkpoint then restores the game where it stood.

A swap that worked logs `ui:hot-swap` and emits the global event `ui:hot-swap` `{ file, module }`
with the new exports. A game plugin can hook it with no `depends`.

## Keep view helpers next to their projection

Bun swaps bindings, not values another module already copied. A function that another module
stored into an object at load time keeps the old version.

```tsx file="features/dice/face.tsx" group="helper" check
/** @jsxImportSource @moku-labs/game */
export const faceView = (face: { roll: number }) => <text key="face" content={String(face.roll)} />;
```

```ts file="features/dice/view.ts" group="helper" check
import { projection } from "../../state";
import { faceView } from "./face";

export const face = projection({
  name: "dice.face",
  layer: "ui",
  from: player => ({ roll: player.lastRoll }),
  view: faceView // [!note] `face` holds the `faceView` it was built with. A save of face.tsx alone swaps nothing on screen.
});
```

Keep a view helper in the same module as the projection that uses it. A save of that module then
builds a new projection spec, and the swap takes it.

## Another folder layout

The default filters fit `features/<name>/view.tsx` and the kind folders of the layered layout. A
game that keeps its views elsewhere exports its own plugin and lists it in a `bunfig.toml` of its
own, on a server of its own: `moku-game dev` always lists the default.

```ts file="hot.ts" check
import { hot } from "@moku-labs/game/hot";

export default hot({ include: /\/look\/.*\.ts$/ }); // [!note] `include` is tested on the absolute path. Do not anchor it at the start.
```

| Option | Default | Tested on |
|---|---|---|
| `include` | `.tsx`, `styles.ts`, `view.ts`, `animations.ts`, `effects.ts`, the generated strings, and any `.ts` directly in the kind folders | The absolute path. |
| `exclude` | `node_modules/`, `web/`, `generated/`, `__tests__/`, `tests/`, `.test` and `.spec` files | The path relative to the game root, with a leading `/`. |

:::gotchas
- **The dev server runs in the game root.** The plugin reads paths relative to the working directory; a file outside it loads unchanged.
- **A style object changed in place is not seen.** Build a new one: ui compares descriptions by value.
- **A view module may import `@moku-labs/game`.** The package marks only its root entry as having side effects, so the root is not sent again with every update.
- **A changed layer in `config.ts` needs a restart.** The config is read once.
:::

## Related

- [ui plugin](/docs/game/plugins/ui/): how a swap is sorted and applied.
- [Assets](/docs/game/guides/assets/): the keys watch and the stamp.
- [The game shell](/docs/game/guides/game-shell/): what `moku-game dev` writes.
