---
title: sfx
description: "Task plugin for game sound effects. Short clips from a text prompt, always mp3, with the one-off facade app.sfx.*."
section: Tasks
order: 26
---

## What it does

`sfx` is the task plugin for game sound effects. It owns the contract every sfx provider
implements: `SfxRequest`, `SfxResult` and `SfxHandler`. It exposes a small typed facade,
`app.sfx.*`, for one-off generation, cost estimates and provider discovery.

The output is always mp3, `audio/mpeg`. The game engine accepts mp3 only, so a handler never
returns another format and there is no transcoder. The runner exports each result as `<label>.mp3`.

Providers that serve this task today:

| Provider | Plugin |
|---|---|
| `elevenlabs` | [elevenlabs](/docs/ai/plugins/elevenlabs/) |
| `fal` | [fal](/docs/ai/plugins/fal/) |

## How it works

A handler has `estimate` and `execute`. There is no async `submit`/`poll` form: a sound effect is
a few seconds of audio and every provider returns it in one call.

The registry carries handlers as `unknown`. This plugin narrows them with the runtime guard
`isSfxHandler`. A malformed registration fails with a clear error, never a crash.

The plugin is stateless. No lifecycle hooks, no events.

## Config

`pluginConfigs.sfx`.

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultProvider` | `string` | `"elevenlabs"` | Provider the facade uses when a call names none. |

```ts check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: { sfx: { defaultProvider: "fal" } }
});
```

:::callout{tone="warn"}
`defaultProvider` applies to the facade only. A build file item with no `provider` runs on the
build file's `defaults.provider`, else the task's first registered provider. That is
`elevenlabs` too.
:::

## API

Mounted at `app.sfx`, reachable with `ctx.require(sfxPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `generate` | `(request: SfxRequest, opts?: { provider?: string; signal?: AbortSignal }) => Promise<SfxResult>` | One-off generation. Calls `execute` once. Direct, not journaled. |
| `estimate` | `(request: SfxRequest, opts?: { provider?: string }) => { usd: number }` | Cost estimate without a call. The same handler `estimate()` the runner's budget gate uses. |
| `providers` | `() => string[]` | Registered sfx providers, in registration order. |

A handler error is thrown as it is. An unknown provider, or a registered value that fails the
shape check, throws:

```text
[ai] No sfx provider named "<name>" is registered.
  Available: <comma list or "none">.
```

### `SfxRequest`

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | `string` | yes | What the sound is, e.g. `"coin pickup, bright 8-bit chime"`. |
| `model` | `string` | yes | Provider-scoped model alias, e.g. `"eleven_text_to_sound_v2"`. Part of the artifact key. |
| `durationMs` | `number` | no | Length, ms. Omitted means the provider picks the length. Each provider checks its own range. |
| `promptInfluence` | `number` | no | 0 to 1. How literally the prompt is followed. |
| `loop` | `boolean` | no | Ask for a seamless loop, when the model supports it. |
| `params` | `Record<string, unknown>` | no | Provider params. Each provider documents the keys it reads. |

### `SfxResult`

| Field | Type | Description |
|---|---|---|
| `audio` | `Uint8Array` | The mp3 bytes. |
| `mimeType` | `"audio/mpeg"` | Always mp3. |
| `costUsd` | `number` | Actual cost, USD. |
| `meta` | `Record<string, unknown>?` | Metadata only: model, endpoint, requestId, durationMs. |

## Example

The durable path is a build file. The second item is the same sound on the other provider:

```yaml file="sounds.moku.yaml"
version: 1
name: sounds
items:
  - id: coin-pickup
    task: sfx
    input: { prompt: "coin pickup, bright chime", model: eleven_text_to_sound_v2, durationMs: 600 }
  - id: coin-pickup-alt
    task: sfx
    provider: fal
    input: { prompt: "coin pickup, bright chime", model: elevenlabs-sfx-v2, durationMs: 600 }
```

The facade is the direct path. Nothing is journaled:

```ts file="hit.ts" check
import { app } from "./app";

await app.start();

const { usd } = app.sfx.estimate(
  { prompt: "coin pickup", model: "elevenlabs-sfx-v2", durationMs: 2000 },
  { provider: "fal" }
);
console.log(usd);

const hit = await app.sfx.generate({
  prompt: "sword hit, metallic",
  model: "eleven_text_to_sound_v2",
  durationMs: 800
});
await Bun.write("sword-hit.mp3", hit.audio);

console.log(app.sfx.providers()); // ["elevenlabs", "fal"]
await app.stop();
```

A custom provider registers an `SfxHandler` under `"sfx"`:

```ts file="acme-sfx.ts" check
import { createPlugin, registryPlugin } from "@moku-labs/ai";
import type { Sfx } from "@moku-labs/ai";

declare function callAcme(request: Sfx.SfxRequest, signal?: AbortSignal): Promise<Sfx.SfxResult>;

const handler: Sfx.SfxHandler = {
  estimate: request => ({ usd: Math.ceil((request.durationMs ?? 1000) / 1000) * 0.12 }),
  execute: async (request, { signal }) => callAcme(request, signal)
};

export const acmeSfxPlugin = createPlugin("acmeSfx", {
  depends: [registryPlugin],
  onInit: ctx => {
    ctx.require(registryPlugin).register("sfx", "acme", handler);
  }
});
```

:::gotchas
- **`generate` is not journaled.** Build files go through [runner](/docs/ai/plugins/runner/).
- **`model` is required.** The runner hashes the item's input as written. A model defaulted inside a provider would not be part of the artifact key.
- **Model aliases are per provider.** `eleven_text_to_sound_v2` is the elevenlabs alias; `elevenlabs-sfx-v2` is the fal alias for the same model.
- **No automatic failover.** "Fallback" means a second item with `provider: fal`.
:::

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): `resolve("sfx", provider)` and `providers("sfx")`.

## Related

- [music](/docs/ai/plugins/music/): full tracks, with a composition plan.
- [runner](/docs/ai/plugins/runner/): the durable path for the same handlers.
- [elevenlabs](/docs/ai/plugins/elevenlabs/), [fal](/docs/ai/plugins/fal/): the providers.
