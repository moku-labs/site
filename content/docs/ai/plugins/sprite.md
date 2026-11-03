---
title: sprite
description: "Task plugin for game sprites. Cuts a stored image into a transparent PNG, with the one-off facade app.sprite.*."
section: Tasks
order: 27
---

## What it does

`sprite` is the task plugin for game sprites. A sprite item takes an existing image by `$ref` or
`$file` and returns a transparent RGBA PNG. The steps are background removal with the provider's
matte model, a trim to the alpha bounds, an optional resize and optional padding. A target size
includes the padding.

The plugin owns the contract every sprite provider implements: `SpriteFile`, `SpriteRequest`,
`SpriteResult` and `SpriteHandler`. It exposes a small typed facade, `app.sprite.*`, for one-off
cuts, cost estimates and provider discovery.

A sprite takes two build items. An `image` item makes the raw picture. A `sprite` item takes it
by `$ref` and cuts it. Changing the sprite options re-cuts the stored image and never generates
it again.

Providers that serve this task today:

| Provider | Plugin |
|---|---|
| `fal` | [fal](/docs/ai/plugins/fal/) |

## How it works

A handler has `estimate` and `execute`. There is no submit/poll form. `estimate` reads `model`
only: the runner estimates before `source` is resolved.

A handler runs its matte model, then the pixel step. The model `"none"` skips the matte: the
source is already transparent. The pixel step, in order:

1. Input checks run before any work. `size` must be whole pixels of at least 1, `padding` a whole number of 0 or more, `alphaThreshold` in 0 to 255, `fit` one of the three values. With `size`, `2 * padding` must be less than both `width` and `height`.
2. The image is decoded to raw RGBA. An alpha channel is added when missing.
3. The bounding box of pixels with alpha above `alphaThreshold` is found. An image with no such pixel throws, with `trim: false` too.
4. Unless `trim` is `false`, the image is cut to that box. `meta.trimBox` is the box kept.
5. `size` resizes the trimmed image to `size - 2 * padding` on each axis. `contain` letterboxes with transparent pixels. The kernel is `nearest` with `pixelArt`, else `lanczos3`.
6. `padding` adds transparent pixels on every side, last. With `size`, the output is exactly `size` and the border is exactly `padding` px. Without `size`, the output is the trimmed size plus `2 * padding`.
7. The output is an RGBA PNG.

The two errors of the pixel step:

```text
[ai] Sprite padding <p> leaves no room inside <w>x<h>.
  Lower padding or raise size.
```

```text
[ai] Sprite is empty after background removal.
  Check the source image or lower alphaThreshold.
```

The registry carries handlers as `unknown`. This plugin narrows them with the runtime guard
`isSpriteHandler`. The plugin is stateless. No lifecycle hooks, no events.

## Config

`pluginConfigs.sprite`.

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultProvider` | `string` | `"fal"` | Provider the facade uses when a call names none. |

```ts check
import { createApp } from "@moku-labs/ai";

const app = createApp({ pluginConfigs: { sprite: { defaultProvider: "fal" } } });
```

## API

Mounted at `app.sprite`, reachable with `ctx.require(spritePlugin)`.

| Method | Signature | Description |
|---|---|---|
| `generate` | `(request: SpriteRequest, opts?: { provider?: string; signal?: AbortSignal }) => Promise<SpriteResult>` | One-off cut. Calls `execute` once. Direct, not journaled. `source` must already be a file. |
| `estimate` | `(request: SpriteRequest, opts?: { provider?: string }) => { usd: number }` | Cost estimate without a call. The same handler `estimate()` the runner's budget gate uses. |
| `providers` | `() => string[]` | Registered sprite providers, in registration order. |

An unknown provider, or a registered value that fails the shape check, throws:

```text
[ai] No sprite provider named "<name>" is registered.
  Available: <comma list or "none">.
```

### `SpriteRequest`

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `source` | `SpriteFile` | yes | | The source image. The runner resolves `{ $ref: id }` and `{ $file: path }` into `{ path, mimeType, hash }`. |
| `model` | `string` | yes | | Matte model alias, e.g. `"birefnet"`. `"none"` means the source is already transparent. |
| `trim` | `boolean` | no | `true` | Trim to the alpha bounding box. |
| `padding` | `number` | no | `0` | Transparent border around the trimmed box, px. With `size`, it sits inside `size`. |
| `size` | `{ width, height }` | no | size after trim | Target size, px. |
| `fit` | `"contain" \| "cover" \| "fill"` | no | `"contain"` | How the image fits `size`. |
| `pixelArt` | `boolean` | no | `false` | Nearest-neighbour resize. Otherwise lanczos3. |
| `alphaThreshold` | `number` | no | `8` | Alpha at or below this value counts as empty, 0 to 255. |
| `params` | `Record<string, unknown>` | no | | Provider params. Each provider documents the keys it reads. |

### `SpriteResult`

| Field | Type | Description |
|---|---|---|
| `image` | `Uint8Array` | The RGBA PNG bytes. |
| `mimeType` | `"image/png"` | Always a PNG. The runner exports it as `<label>.png`. |
| `costUsd` | `number` | Actual cost of this cut, USD. |
| `meta` | `Record<string, unknown>?` | `width`, `height`, `trimBox`, `model`. Metadata only. |

## Example

The durable path is a build file. A nine-slice hint lives in the item id, so in the file name:
`btn{nine=12,12,12,12}` exports `btn{nine=12,12,12,12}.png`. `buildfile` validates the hint
syntax; this plugin does not read it.

```yaml file="ui.moku.yaml"
version: 1
name: ui
items:
  - id: btn-raw
    task: image
    input: { prompt: "wooden game UI button, flat colour background", aspect: "1:1" }
  - id: "btn{nine=12,12,12,12}"
    task: sprite
    input: { source: { $ref: btn-raw }, model: birefnet, size: { width: 128, height: 64 }, padding: 2 }
```

The facade is the direct path. Nothing is journaled, and `source` must be a resolved file:

```ts file="cut.ts" check
import { app } from "./app";

await app.start();

const iconFile = { path: "art/icon.png", mimeType: "image/png", hash: "a".repeat(64) };

console.log(app.sprite.estimate({ source: iconFile, model: "none" })); // [!note] { usd: 0 } with fal: no matte call.

const sprite = await app.sprite.generate({
  source: iconFile,
  model: "none",
  size: { width: 64, height: 64 },
  pixelArt: true
});
await Bun.write("icon.png", sprite.image);
console.log(sprite.meta?.trimBox);

console.log(app.sprite.providers()); // ["fal"]
await app.stop();
```

:::gotchas
- **`generate` is not journaled.** Build files go through [runner](/docs/ai/plugins/runner/).
- **`model` is required.** The runner hashes the item's input as written. A model defaulted inside a provider would not be part of the artifact key.
- **The facade does not resolve `$ref`.** Pass `{ path, mimeType, hash }`. In a build file the runner does it.
- **`padding` is inside `size`.** `size: 16x16, padding: 2` gives a 12x12 picture in a 2 px border.
:::

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): `resolve("sprite", provider)` and `providers("sprite")`.

## Related

- [image](/docs/ai/plugins/image/): the item a sprite usually cuts.
- [runner](/docs/ai/plugins/runner/): the durable path for the same handlers.
- [fal](/docs/ai/plugins/fal/): the provider.
