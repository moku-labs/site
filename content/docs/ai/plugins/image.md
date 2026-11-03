---
title: image
description: "Task plugin for still images. Owns the image contract and the one-off facade app.image.*."
section: Tasks
order: 23
---

## What it does

`image` is the task plugin for still images. It owns the contract every image provider implements:
`ImageFile`, `ImageRequest`, `ImageResult`, `ImageOutput` and `ImageHandler`. It exposes a small
typed facade, `app.image.*`, for one-off generation, cost estimates and provider discovery.

The plugin talks to no AI service. Provider plugins register a handler with `registry` under the
task `"image"`. The facade resolves the handler by name and calls it. The request is passed
through unchanged.

Providers that serve this task today:

| Provider | Plugin |
|---|---|
| `codex` | [codex](/docs/ai/plugins/codex/) |
| `fal` | [fal](/docs/ai/plugins/fal/) |
| `ark` | [ark](/docs/ai/plugins/ark/) |

## How it works

The registry carries handlers as `unknown`. This plugin checks the shape at run time and casts
once, at its own resolve site. A malformed registration fails with a clear error, never a crash.

**Groups.** A provider that makes several consistent images in one call returns all of them in
`images`, each an `ImageOutput` `{ image, mimeType }`, and the first one again as `image` and
`mimeType`. Single-image code keeps reading `image`. The runner stores every entry of `images` as
the item's ordered outputs. Export writes `<label>.<ext>`, `<label>-2.<ext>` and so on. A `$ref` to
the item is the first image. `app.image.generate()` passes the result through unchanged.

The plugin is stateless. No lifecycle hooks, no events, no packs.

## Config

`pluginConfigs.image`.

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultProvider` | `string` | `"codex"` | Provider the facade uses when a call names none. |

```ts check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: { image: { defaultProvider: "fal" } }
});
```

:::callout{tone="warn"}
`defaultProvider` applies to the facade only. A build file item with no `provider` runs on the
build file's `defaults.provider`, else the task's first registered provider.
:::

## API

Mounted at `app.image`, reachable with `ctx.require(imagePlugin)`.

| Method | Signature | Description |
|---|---|---|
| `generate` | `(request: ImageRequest, opts?: { provider?: string; signal?: AbortSignal }) => Promise<ImageResult>` | One-off generation. Direct, not journaled. |
| `estimate` | `(request: ImageRequest, opts?: { provider?: string }) => { usd: number }` | Cost estimate without a call. Synchronous. |
| `providers` | `() => string[]` | Registered image providers, in registration order. |

An unknown provider, or a registered value that fails the shape check, throws:

```text
[ai] No image provider named "<name>" is registered.
  Available: <comma list or "none">.
```

### `ImageRequest`

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | `string` | yes | What to draw. |
| `negative` | `string` | no | Things to avoid. |
| `model` | `string` | no | Provider-scoped model id. |
| `aspect` | `string` | no | Aspect ratio, e.g. `"9:16"`. Providers default to `"9:16"`. |
| `refs` | `ImageFile[]` | no | Reference images: a character sheet, a location plate, an earlier keyframe. |
| `params` | `Record<string, unknown>` | no | Provider params, passed through. |

`ImageFile` is `{ path: string; mimeType: string; hash: string }`. In a build file the runner
resolves `{ $ref: id }` and `{ $file: path }` into that shape.

### `ImageResult`

| Field | Type | Description |
|---|---|---|
| `image` | `Uint8Array` | The image bytes. |
| `mimeType` | `string` | MIME type of `image`. |
| `images` | `ImageOutput[]?` | Every image of a group, in order. `images[0]` is `image`. Absent for a single image. |
| `costUsd` | `number` | Actual cost, USD. |
| `meta` | `Record<string, unknown>?` | Metadata only. |

## Example

The durable path is a build file. The second item takes the first as a reference:

```yaml file="keyframes.moku.yaml"
version: 1
name: keyframes
items:
  - id: hero-sheet
    task: image
    provider: fal
    input:
      prompt: "character sheet, young courier, three views"
      aspect: "1:1"
  - id: s01-frame
    task: image
    provider: fal
    input:
      prompt: "the courier at a patisserie at night"
      aspect: "9:16"
      refs: [{ $ref: hero-sheet }]
```

The facade is the direct path. Nothing is journaled:

```ts file="draw.ts" check
import { app } from "./app";

await app.start();

const sheet = { path: "art/hero-sheet.png", mimeType: "image/png", hash: "a".repeat(64) };

console.log(app.image.estimate({ prompt: "a patisserie at night" }, { provider: "fal" }));

const { image, images, costUsd } = await app.image.generate(
  { prompt: "the courier at a patisserie at night", aspect: "9:16", refs: [sheet] },
  { provider: "fal" }
);
await Bun.write("patisserie.png", image);
console.log(costUsd, images?.length ?? 1);

console.log(app.image.providers()); // ["codex", "fal", "ark"]
await app.stop();
```

:::gotchas
- **`generate` is not journaled.** No resume, no cost ledger entry. Build files go through [runner](/docs/ai/plugins/runner/).
- **`refs` must be real files.** The facade does not resolve `$ref` or `$file`. Pass `{ path, mimeType, hash }`.
- **A group is still one `image`.** Read `images` when a provider returns several; `image` is always the first.
:::

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): `resolve("image", provider)` and `providers("image")`.

## Related

- [sprite](/docs/ai/plugins/sprite/): cuts a stored image into a transparent sprite.
- [runner](/docs/ai/plugins/runner/): the durable path for the same handlers.
- [codex](/docs/ai/plugins/codex/), [fal](/docs/ai/plugins/fal/), [ark](/docs/ai/plugins/ark/): the providers.
