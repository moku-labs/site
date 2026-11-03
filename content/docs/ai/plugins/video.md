---
title: video
description: "Task plugin for video clips. Owns the video contract, sync or async providers, and the one-off facade app.video.*."
section: Tasks
order: 24
---

## What it does

`video` is the task plugin for video clips. It owns the contract every video provider implements:
`VideoRequest`, `VideoResult`, `VideoJobPoll` and `VideoHandler`. It exposes a small typed facade,
`app.video.*`, for one-off generation, cost estimates and provider discovery.

Providers that serve this task today:

| Provider | Plugin |
|---|---|
| `fal` | [fal](/docs/ai/plugins/fal/) |
| `apimodels` | [apimodels](/docs/ai/plugins/apimodels/) |
| `ark` | [ark](/docs/ai/plugins/ark/) |

## How it works

Video providers run long jobs, so a handler has two forms. It has `estimate`, plus either
`execute` (one call) or the async pair `submit` + `poll`, or both. A value is a valid handler when
`estimate` is a function and either `execute` is a function or both `submit` and `poll` are.

The two paths use the forms differently:

| Path | Prefers | On a crash |
|---|---|---|
| `runner` | `submit` + `poll`. The job id is journaled. | Resumes by polling the live job. Never submits again. |
| `app.video.generate` | `execute`. Without it, an in-memory `submit` then `poll` loop every `config.pollIntervalMs`. | Nothing is journaled. The job is lost. |

In the facade loop, `done` returns the result without the `state` field, `failed` throws the
poll's `error` as it is, and an abort during the wait rejects at once with the signal's reason.

`estimate` runs at plan time, before the runner resolves build-file references. So a handler's
`estimate` takes an `EstimateRequest`: a `VideoRequest` whose `image`, `endImage`, `refs` and
`fromDraft` may still be `{ $ref }` or `{ $file }`.

The plugin is stateless. No lifecycle hooks, no events.

## Config

`pluginConfigs.video`.

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultProvider` | `string` | `"fal"` | Provider the facade uses when a call names none. |
| `pollIntervalMs` | `number` | `5000` | Delay between polls in the facade's submit/poll loop, ms. |

```ts check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: { video: { defaultProvider: "fal", pollIntervalMs: 2000 } }
});
```

:::callout{tone="warn"}
The runner does not read this config. A build file item with no `provider` runs on the build
file's `defaults.provider`, else the task's first registered provider. The runner polls every
`runner.pollIntervalMs`.
:::

## API

Mounted at `app.video`, reachable with `ctx.require(videoPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `generate` | `(request: VideoRequest, opts?: { provider?: string; signal?: AbortSignal }) => Promise<VideoResult>` | One-off generation. Direct, not journaled. `signal` cancels the provider call or the poll wait. |
| `estimate` | `(request: VideoRequest, opts?: { provider?: string }) => { usd: number }` | Cost estimate without a call. The same handler `estimate()` the runner's budget gate uses. |
| `providers` | `() => string[]` | Registered video providers, in registration order. |

An unknown provider, or a registered value that fails the shape check, throws:

```text
[ai] No video provider named "<name>" is registered.
  Available: <comma list or "none">.
```

### `VideoRequest`

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | `string` | yes | Provider-scoped model id or alias, e.g. `"minimax-h3"`. Price and endpoint depend on it. |
| `prompt` | `string` | yes | Motion and scene prompt. |
| `negative` | `string` | no | Things to avoid. Ignored by models without a negative prompt. |
| `image` | `VideoFile` | no | First frame or keyframe. |
| `endImage` | `VideoFile` | no | Last frame. A model without an end frame rejects the request before any upload or charge. |
| `refs` | `VideoFile[]` | no | Extra references: images, audio or video files, told apart by MIME type. |
| `seconds` | `number` | no | Clip length. Default 5. |
| `aspect` | `string` | no | Aspect ratio. Default `"9:16"`. |
| `resolution` | `string` | no | Model-specific, e.g. `"720p"`, `"768P"`. |
| `audio` | `boolean` | no | Generate native audio when the model can. Default false. |
| `params` | `Record<string, unknown>` | no | Provider params, merged last into the provider body. |
| `fromDraft` | `VideoFile` | no | The draft clip this request renders at full quality. Providers without a draft mode refuse it. |

`VideoFile` is `{ path: string; mimeType: string; hash: string }`.

### `VideoResult`

| Field | Type | Description |
|---|---|---|
| `video` | `Uint8Array` | The clip bytes. |
| `mimeType` | `string` | MIME type of `video`, e.g. `video/mp4`. |
| `costUsd` | `number` | Actual cost, USD. |
| `meta` | `Record<string, unknown>?` | Metadata only. |

### `VideoJobPoll`

`{ state: "pending" }`, `{ state: "done" } & VideoResult`, or `{ state: "failed"; error: unknown }`.

## Example

The durable path is a build file. The runner journals the job id, so an aborted run resumes by
polling:

```yaml file="shots.moku.yaml"
version: 1
name: shots
items:
  - id: s01-frame
    task: image
    provider: fal
    input:
      prompt: "a courier at a patisserie at night"
      aspect: "9:16"
  - id: s01
    task: video
    provider: fal
    input:
      model: minimax-h3
      prompt: "slow push-in on the courier"
      image: { $ref: s01-frame }
      seconds: 5
```

### Draft, then final

A draft is a cheap preview clip. A final re-renders that draft at full quality. Today only `ark`
supports it. The draft item sets `params.draft: true`. The final item sets
`fromDraft: { $ref: <draft item> }` and may omit `prompt`. The final renders at `1080p` only.
Draft ids expire after 7 days.

```yaml file="draft.moku.yaml"
version: 1
name: draft
items:
  - id: s01.draft
    task: video
    provider: ark
    input: { model: dreamina-seedance-2-5-260628, prompt: "slow push-in" }
    params: { draft: true }
  - id: s01.final
    task: video
    provider: ark
    input: { model: dreamina-seedance-2-5-260628, fromDraft: { $ref: s01.draft }, resolution: 1080p }
```

The facade is the direct path. Nothing is journaled:

```ts file="clip.ts" check
import { app } from "./app";

await app.start();

const frame = { path: "frames/s01.png", mimeType: "image/png", hash: "a".repeat(64) };

const { usd } = app.video.estimate({ model: "minimax-h3", prompt: "slow push-in", image: frame, seconds: 5 });
console.log(usd);

const clip = await app.video.generate({ model: "minimax-h3", prompt: "slow push-in", image: frame, seconds: 5 });
await Bun.write("clip.mp4", clip.video);

console.log(app.video.providers()); // ["fal", "apimodels", "ark"]
await app.stop();
```

A custom provider registers a `VideoHandler` under `"video"`. The async pair is enough:

```ts file="acme-video.ts" check
import { createPlugin, registryPlugin } from "@moku-labs/ai";
import type { Video } from "@moku-labs/ai";

declare function startJob(request: Video.VideoRequest): Promise<string>;
declare function checkJob(jobId: string): Promise<Video.VideoJobPoll>;

const handler: Video.VideoHandler = {
  estimate: request => ({ usd: (request.seconds ?? 5) * 0.05 }),
  submit: async request => ({ jobId: await startJob(request) }),
  poll: async jobId => checkJob(jobId)
};

export const acmeVideoPlugin = createPlugin("acmeVideo", {
  depends: [registryPlugin],
  onInit: ctx => {
    ctx.require(registryPlugin).register("video", "acme", handler);
  }
});
```

:::gotchas
- **`generate` is not journaled.** A crash in the facade's poll loop loses the job. Build files go through [runner](/docs/ai/plugins/runner/), which resumes by polling.
- **`model` is required.** The runner hashes the item's input as written. A model defaulted inside a provider would not be part of the artifact key.
- **Files must be resolved.** The facade does not resolve `$ref` or `$file`. Pass `{ path, mimeType, hash }`.
- **`pollIntervalMs` is for the facade only.** The runner uses its own `pollIntervalMs`.
:::

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): `resolve("video", provider)` and `providers("video")`.

## Related

- [asset](/docs/ai/plugins/asset/): register a face before a video item uses it.
- [runner](/docs/ai/plugins/runner/): the durable path for the same handlers.
- [fal](/docs/ai/plugins/fal/), [apimodels](/docs/ai/plugins/apimodels/), [ark](/docs/ai/plugins/ark/): the providers.
