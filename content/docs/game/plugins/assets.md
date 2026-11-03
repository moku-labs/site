---
title: assets
description: "Screen. The manifest, five load tiers, graph-driven preload, a texture budget with LRU unload, typed keys and bundles per feature."
section: Plugins
order: 28
---

## What it does

`assets` loads what the game draws and plays. A manifest lists the bundles. Each bundle has a load
tier: `boot`, `core`, `scene`, `feature` or `lazy`. The graph drives the preload: at a rest node
it looks `preloadDepth` edges ahead. Textures live under a budget; the least recently used bundle
leaves first.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| screen, in `screen` | Complex | `flow`, `renderer` | `assets:bundle-loaded`, `assets:bundle-progress`, `assets:bundle-unloaded`, `assets:replaced` |

**Keys.** An asset key is the feature name, a dot, and the path inside `assets/`. A sub-feature
gets its own bundles, named like its folder. `moku-game keys` writes the typed keys to
`generated/assets.ts`, so a texture the game does not have does not compile. Audio is `.mp3` or
`.m4a`.

**Bundles.** A feature's `assets.ts` describes its bundles with `defineBundles`.
`release: "leave"` also unloads the bundle at the next rest once nothing holds it. The default,
`"budget"`, leaves only under the texture budget. `mipmaps` uploads textures with their full
chain.

**Effects.** `load(bundle)` loads and resolves `Assets.LoadResult | undefined`. `ready(bundle)`
lets a node rest on a load and stay answerable: it resolves `true` when everything is loaded and
warmed, otherwise starts the warm, resolves `false`, and posts `{ type: "ready" }` into the
inbox once all of it settled. Headless every bundle counts as loaded.

The asset tools (scanner, packer, string compiler) are the `@moku-labs/game/assets` entry. See
[Assets](/docs/game/guides/assets/).

## Config

`pluginConfigs.assets`.

| Option | Type | Default | Description |
|---|---|---|---|
| `manifest` | `string \| Manifest \| undefined` | `undefined` | URL of `manifest.json`, or the parsed manifest in a test. `undefined`: an empty manifest. |
| `textureBudgetMb` | `number` | `192` | Texture memory budget for the LRU unload. |
| `preloadDepth` | `number` | `2` | Edges walked ahead of a rest node. `0` turns preload off. |
| `baseUrl` | `string \| undefined` | `undefined` | Prefix of every file URL, the CDN seam. `undefined`: the folder of the manifest URL. |
| `io` | `AssetsIo \| undefined` | `undefined` | Fetch, decode and texture seam. Tests replace it. |

In a game made with `defineGameApp`, `manifest` and `io` belong to the shell.

## API

Mounted at `app.assets`, reachable with `ctx.require(assetsPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `load` | `(bundle: string) => Promise<void>` | Loads every file of a bundle. A loading bundle joins the running load. |
| `warm` | `(bundle: string) => Promise<void>` | Loads, then puts the textures on the GPU before a scene shows them. |
| `unload` | `(bundle: string) => void` | Destroys the textures. A pinned bundle and the tiers `boot` and `core` are refused. |
| `isLoaded` | `(bundle: string) => boolean` | Whether every texture of the bundle exists. |
| `has` | `(bundle: string) => boolean` | Whether the manifest carries the bundle, loaded or not. |
| `texture` | `(key: string) => Texture \| undefined` | The texture of a loaded key. A key of an unloaded bundle starts a background load. |
| `font` | `(key: string) => FontAsset \| undefined` | The `.fnt` text and the first page of a font. |
| `audio` | `(key: string) => AudioAsset \| undefined` | The fetched bytes and the MIME type of a sound. |
| `usage` | `() => Usage` | What the loaded bundles cost, sorted by name. |
| `companions.add` | `(companion: { load(bundle); unload(bundle) }) => () => void` | What loads and unloads with every bundle. `i18n` adds the strings of a sub-feature this way. |

`sceneBundles` and `sceneComing` are for `scenes`.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `assets:bundle-loaded` | `{ bundle, tier, mb, reason }` | A bundle entered memory. |
| `assets:bundle-progress` | `{ bundle, loaded, total }` | Files of a loading bundle arrived. |
| `assets:bundle-unloaded` | `{ bundle, tier, mb, reason: "budget" \| "request" \| "leave", keys }` | A bundle left memory. |
| `assets:replaced` | `{ bundle, keys }` | Dev only: a hot swap replaced files of a loaded bundle. |

### Listens to

The global `ui:hot-swap`, for the asset stamp of `moku-game dev`.

## Example

```ts file="ep01.ts" check
import { createApp, defineBundles, defineGame, screen, type } from "@moku-labs/game";

// features/ep01/assets.ts: how the bundle of the feature loads and leaves.
export const bundles = defineBundles({
  ep01: { tier: "feature", release: "leave", mipmaps: ["items/**"] }
});

const { defineNode, ready } = defineGame<{
  player: { coins: number };
  session: { episode: string };
  assets: string;
  strings: Record<string, unknown>;
}>();

// A transit node rests on a load and stays answerable.
export const prepare = defineNode({
  outcomes: { done: type(), wait: type() },
  run: async ({ fx, out }) => ((await fx(ready(["ep01"]))) === false ? out.wait() : out.done())
});

const app = createApp({
  plugins: [...screen],
  pluginConfigs: { assets: { manifest: "/assets/manifest.json", textureBudgetMb: 192 } }
});
await app.start();
await app.assets.load("ep01");
app.assets.usage().textureMb;
```

:::gotchas
- **Compare `ready` with `=== false`.** It resolves `undefined` without `assets`, as in `game.headless()`.
- **A bundle the scene does not name is not warmed.** Name it in the scene's `bundles`, or call `app.assets.warm`.
- **A node pins its bundle.** `release: "leave"` waits until no node of the feature is on the stack.
:::

## Related

- [Assets](/docs/game/guides/assets/): keys, the manifest, the pack.
- [scenes](/docs/game/plugins/scenes/): bundles a scene names.
- [i18n](/docs/game/plugins/i18n/): strings that travel with a bundle.
