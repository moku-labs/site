---
title: music
description: "Task plugin for music tracks. Owns the music contract, sync or async providers, and the one-off facade app.music.*."
section: Tasks
order: 25
---

## What it does

`music` is the task plugin for music tracks. It owns the contract every music provider implements:
`MusicChunk`, `MusicRequest`, `MusicResult`, `MusicJobPoll` and `MusicHandler`. It exposes a small
typed facade, `app.music.*`, for one-off generation, cost estimates and provider discovery.

Providers that serve this task today:

| Provider | Plugin |
|---|---|
| `elevenlabs` | [elevenlabs](/docs/ai/plugins/elevenlabs/) |
| `fal` | [fal](/docs/ai/plugins/fal/) |

## How it works

A handler has `estimate`, plus either `execute` (one call) or the async pair `submit` + `poll`, or
both. The runner prefers `submit` + `poll` and journals the job id, so an aborted run resumes by
polling, never by submitting again. The facade `generate` prefers `execute` and runs its own
in-memory submit/poll loop when the provider has no `execute`.

In the facade loop, `done` returns the result without the `state` field, `failed` throws the
poll's `error` as it is, and an abort during the wait rejects at once with the signal's reason.

The registry carries handlers as `unknown`. This plugin narrows them with the runtime guard
`isMusicHandler`. A malformed registration fails with a clear error, never a crash.

The result shape matches `VoiceoverResult`. The runner stores `audio` and maps `audio/mpeg` to
`.mp3`.

## Config

`pluginConfigs.music`.

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultProvider` | `string` | `"fal"` | Provider the facade uses when a call names none. |
| `pollIntervalMs` | `number` | `5000` | Delay between polls in the facade's submit/poll loop, ms. |

```ts check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: { music: { defaultProvider: "fal", pollIntervalMs: 2000 } }
});
```

:::callout{tone="warn"}
The two paths have different defaults. The facade uses `config.defaultProvider`, `fal`. A build
file item with no `provider` runs on the build file's `defaults.provider`, else the task's first
registered provider, which is `elevenlabs`. Name the provider on the item.
:::

## API

Mounted at `app.music`, reachable with `ctx.require(musicPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `generate` | `(request: MusicRequest, opts?: { provider?: string; signal?: AbortSignal }) => Promise<MusicResult>` | One-off generation. Direct, not journaled. `signal` cancels the provider call or the poll wait. |
| `estimate` | `(request: MusicRequest, opts?: { provider?: string }) => { usd: number }` | Cost estimate without a call. The same handler `estimate()` the runner's budget gate uses. |
| `providers` | `() => string[]` | Registered music providers, in registration order. |

An unknown provider, or a registered value that fails the shape check, throws:

```text
[ai] No music provider named "<name>" is registered.
  Available: <comma list or "none">.
```

### `MusicRequest`

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | `string` | yes | Overall music prompt. |
| `model` | `string` | yes | Provider-scoped model alias, e.g. `"elevenlabs-music-v2.5"`. Price, endpoint and output depend on it. |
| `lengthMs` | `number` | yes | Track length, ms. |
| `chunks` | `MusicChunk[]` | no | Composition plan. A model without plans rejects it, never drops it silently. |
| `seed` | `number` | no | Seed, when the model takes one. |
| `params` | `Record<string, unknown>` | no | Provider params. Each provider documents the keys it reads. |

### `MusicChunk`

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | `string` | yes | Lyrics or section description. |
| `durationMs` | `number` | yes | Section length, ms. |
| `styles` | `string[]` | yes | Positive style tags. |
| `avoid` | `string[]` | no | Negative style tags. |

### `MusicResult`

| Field | Type | Description |
|---|---|---|
| `audio` | `Uint8Array` | The audio bytes. |
| `mimeType` | `string` | MIME type of `audio`, e.g. `audio/mpeg`. |
| `costUsd` | `number` | Actual cost, USD. |
| `meta` | `Record<string, unknown>?` | Metadata only. |

### `MusicJobPoll`

`{ state: "pending" }`, `{ state: "done" } & MusicResult`, or `{ state: "failed"; error: unknown }`.

## Example

The durable path is a build file item:

```yaml file="score.moku.yaml"
version: 1
name: score
items:
  - id: teaser-score
    task: music
    provider: fal
    input:
      model: "elevenlabs-music-v2.5"
      prompt: "Tense synth pulse, rising."
      lengthMs: 30000
```

The facade is the direct path. Nothing is journaled:

```ts file="score.ts" check
import { app } from "./app";

await app.start();

const { usd } = app.music.estimate({ prompt: "tense synth", model: "stable-audio-2.5", lengthMs: 30_000 });
console.log(usd);

const track = await app.music.generate({
  prompt: "tense synth",
  model: "elevenlabs-music-v2.5",
  lengthMs: 60_000,
  chunks: [
    { text: "intro", durationMs: 20_000, styles: ["ambient"] },
    { text: "build", durationMs: 40_000, styles: ["synthwave", "driving"], avoid: ["vocals"] }
  ]
});
await Bun.write("teaser.mp3", track.audio);

console.log(app.music.providers()); // ["elevenlabs", "fal"]
await app.stop();
```

A custom provider registers a `MusicHandler` under `"music"`:

```ts file="acme-music.ts" check
import { createPlugin, registryPlugin } from "@moku-labs/ai";
import type { Music } from "@moku-labs/ai";

declare function startJob(request: Music.MusicRequest): Promise<string>;
declare function checkJob(jobId: string): Promise<Music.MusicJobPoll>;

const handler: Music.MusicHandler = {
  estimate: request => ({ usd: Math.ceil(request.lengthMs / 60_000) * 0.8 }),
  submit: async request => ({ jobId: await startJob(request) }),
  poll: async jobId => checkJob(jobId)
};

export const acmeMusicPlugin = createPlugin("acmeMusic", {
  depends: [registryPlugin],
  onInit: ctx => {
    ctx.require(registryPlugin).register("music", "acme", handler);
  }
});
```

:::gotchas
- **`generate` is not journaled.** A crash in the facade's poll loop loses the job. Build files go through [runner](/docs/ai/plugins/runner/).
- **`model` is required.** The runner hashes the item's input as written. A model defaulted inside a provider would not be part of the artifact key, and a changed default would reuse another model's audio.
- **No automatic fallback.** There is no second model and no second provider. Name both on the item.
:::

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): `resolve("music", provider)` and `providers("music")`.

## Related

- [sfx](/docs/ai/plugins/sfx/): short sound effects, always mp3.
- [runner](/docs/ai/plugins/runner/): the durable path for the same handlers.
- [elevenlabs](/docs/ai/plugins/elevenlabs/), [fal](/docs/ai/plugins/fal/): the providers.
