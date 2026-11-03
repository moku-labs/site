---
title: Assets
description: "Files in features/<f>/assets/ become typed keys, bundles load by tier, and moku-game pack writes the production build."
section: Guides
order: 13
---

## Files become keys

A game keeps its textures, fonts and sounds in the `assets/` folder of a feature. The scanner of
`@moku-labs/game/assets` turns every file into a typed key: the feature name, a dot, then the path
inside `assets/`.

| File | Key | Bundle |
|---|---|---|
| `features/board/assets/items/coin.png` | `board.items.coin` | `board` |
| `features/ui/assets/font-body.fnt` | `ui.font-body` | `ui` |
| `features/episodes/ep01/assets/ward/room.png` | `ep01.ward.room` | `ep01`, a sub-feature's own |
| `shared/assets/button/primary.png` with the layer `{ shared: "ui" }` | `ui.button.primary` | `ui` |

Textures are `.png` or `.webp`, bitmap fonts `.fnt` with their page, sounds `.mp3` or `.m4a`. A
sub-feature with resources gets its own bundle, named like its folder; a code-only one has none.

## moku-game keys

`moku-game keys` runs the scanner on the game folder. `moku-game dev` runs the same scan at start
and again on every save of an asset or a strings file, so a game needs no `keys` by hand while it
develops.

| Writes | Holds |
|---|---|
| `generated/assets.ts` | The types `AssetKey`, `FontKey`, `AudioKey`, `BundleKey` and the `nineSlice` table. |
| `generated/strings.ts` | The `Strings` type for `defineGame`. |
| `generated/strings.<locale>.ts` | The compiled messages of the top-level features and the layers, one file per locale. |
| `generated/manifest.json` | The dev manifest: bundles, files, tiers. |

```sh terminal title="keys"
$ bunx moku-game keys            # write generated/
$ bunx moku-game keys --check    # fail when an output is out of date, for CI
$ bunx moku-game pack            # the production build in dist/assets
```

A game on the layered layout names its layers in `config.ts`: `assets: { layers: { shared: "ui" } }`
becomes `--layer shared=ui`, so `shared/assets/*` keeps the `ui.*` keys.

## Type the kit with the keys

Bind the generated types into the kit. Then a texture key the game does not have, a bundle it did
not declare or a string key it does not know does not compile.

```ts file="state.ts" check
import { defineGame } from "@moku-labs/game";
import type { AssetKey, BundleKey } from "./generated/assets";
import type { Strings } from "./generated/strings";

export type Player = { coins: number; lastRoll: number };
export type Session = { rolls: number };

export const { defineNode, defineFlow, defineFeature, defineBundles, ready, sprite } = defineGame<{
  player: Player;
  session: Session;
  assets: AssetKey; // [!note] Every texture, font and sound key of the game.
  bundles: BundleKey; // [!note] The bundle names: one per feature owner and layer, plus the ones `assets.ts` splits off.
  strings: Strings;
}>();
```

## Bundles

A feature's `assets.ts` splits and tunes its bundles with `defineBundles`. The feature lists the
result under its `assets` key.

```ts file="features/board/assets.ts" check
import { defineBundles } from "../../state";

export const boardAssets = defineBundles({
  board: { tier: "scene", release: "leave", mipmaps: ["items/**"] } // [!note] `release: "leave"` unloads the bundle at the next rest once nothing holds it.
});
```

| Key | Default | What |
|---|---|---|
| `tier` | | When the bundle loads: `"boot"`, `"core"`, `"scene"`, `"feature"` or `"lazy"`. |
| `files` | | Globs of the files this bundle takes, `["chains/*.png"]`, so one folder splits into several bundles. |
| `release` | `"budget"` | `"budget"` leaves only under the texture budget. `"leave"` also unloads it once no node, scene or feature on the stack holds it. |
| `mipmaps` | off | `true` or globs: upload those textures with their full mip chain. Such a texture stays loose in a pack. |

A scene names the bundle it needs, `bundle: "board"`, and more from the committed state with
`bundles: ({ session }) => [session.episode]`. Every way into the scene waits for them.

## Wait for a bundle

The effect `ready(bundle)` lets a node rest on a load and stay answerable. It answers `true` when
every bundle is loaded and on the GPU, `false` while it warms them, and then posts `{ type: "ready" }`
into the inbox. Headless it answers `true`.

```ts file="features/board/loading.ts" check
import { type } from "@moku-labs/game";
import { defineNode, ready } from "../../state";

export const openBoard = defineNode({
  outcomes: { open: type(), wait: type() },
  run: async ({ fx, out }) => {
    if ((await fx(ready("board"))) === false) return out.wait(); // [!note] `undefined` without `assets`, as in `game.headless()`: compare with `=== false`.
    return out.open();
  }
});

export const loading = defineNode({
  outcomes: { ready: type(), back: type() },
  rest: true,
  inbox: ["ready"] // [!note] The `ready` event of `assets` ends the wait; the player can still answer `back`.
});
```

`load(bundle)` is the plain form: it resolves when the bundle is loaded, or `undefined` without
`assets`.

## The assets plugin

| Member | What |
|---|---|
| `load(bundle)`, `unload(bundle)` | Load or drop a bundle. |
| `warm(bundle)` | Load it if needed, then put its textures on the GPU. |
| `isLoaded(bundle)`, `has(bundle)` | Loaded now; carried by the manifest at all. |
| `texture(key)`, `font(key)`, `audio(key)` | The loaded object of a key. |
| `usage()` | `{ textureMb, budgetMb, bundles }`. |

The texture budget is `textureBudgetMb`, 192 by default; under it the plugin unloads by least
recent use. At a rest node it preloads along the graph, `preloadDepth` edges ahead, 2 by default.
Events: `assets:bundle-loaded`, `assets:bundle-progress`, `assets:bundle-unloaded` with a `reason`
of `"budget"`, `"request"` or `"leave"`. The [assets plugin](/docs/game/plugins/assets/) page has
the full API.

## The body font

The package ships one MSDF body font, Pangolin Regular, under the SIL Open Font License 1.1. Copy
it into the game; a path in `node_modules` is not an asset key. The licence goes next to `assets/`,
not inside it.

```sh terminal title="font"
$ mkdir -p features/ui/assets
$ cp node_modules/@moku-labs/game/fonts/font-body.* features/ui/assets/
$ cp node_modules/@moku-labs/game/fonts/LICENSE.txt features/ui/LICENSE-fonts.txt
$ bunx moku-game keys
```

The font gets the key `ui.font-body`, the default of the `text` config `fonts.body`, so the
built-in style `body` works with no config. No `digits` font ships: a game that uses the style
`digits` brings `ui.font-digits` itself.

## Strings

Strings live next to the assets: `strings/<locale>.json` of a feature, a sub-feature or a layer.
The same scan compiles them. A sub-feature's keys start with its name and go into
`generated/strings.<feature>.<locale>.ts`, loaded and unloaded with its bundle.

| Flag of `moku-game-assets` | Does |
|---|---|
| `--pseudo` | Also writes the pseudo-locale `en-XA`. |
| `--export <dir>`, `--import <dir>` | Exchange strings with translators. |
| `--source <locale>` | The locale they read from, `"en"` by default. |

## The production pack

`moku-game pack` writes `dist/assets`: WebP atlas pages, content-hashed names and a manifest.
`moku-game build` packs first, then copies the pack beside the page with `manifest.json` next to
`index.html`. `--no-cache` packs cold. The pack needs the optional peer `sharp`.

A game without `config.ts` runs the scanner through its own bin, `moku-game-assets`, with the same
flags: `--root`, `--keys`, `--manifest`, `--layer`, `--check`, `--pack <dir>`.

:::gotchas
- **Copy the font, do not reference it.** The scanner reads keys only from the `assets/` of every feature owner and of the layers.
- **A new or renamed asset file reloads the dev page.** A file saved with new bytes swaps in place; see [Hot swap](/docs/game/guides/hot-swap/).
- **A changed layer in `config.ts` needs a restart** of `moku-game dev`. The config is read once, at start.
- **`ready` and `load` answer `undefined` without `assets`.** Compare with `=== false`, never with a falsy check.
:::

## Related

- [assets plugin](/docs/game/plugins/assets/): tiers, the budget, `warm`, companions.
- [Screens](/docs/game/guides/screens/): scenes name bundles, views name keys.
- [The game shell](/docs/game/guides/game-shell/): `keys`, `pack` and `build` in the command table.
