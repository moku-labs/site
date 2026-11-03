---
title: fal
description: "Provider. Six tasks over one fal key: video, image, prompt-gen, music, sfx and sprite, with one upload cache and one price table."
section: Providers
order: 30
---

## What it does

**Provider.** `fal` serves six tasks through fal.ai. One key, one HTTP client, one upload cache
and one merged price table. It registers `("video", "fal")`, `("image", "fal")`,
`("prompt-gen", "fal")`, `("music", "fal")`, `("sfx", "fal")` and `("sprite", "fal")` with the
registry in `onInit`.

| Task | Contract | How a job runs |
|---|---|---|
| `video` | `submit` + `poll` | A job takes 2 to 10 minutes. The runner journals the fal request id before it waits, so a crash or Ctrl-C resumes the same job. |
| `image`, `music` | `estimate` + `execute` + `submit` + `poll` | The runner drives `submit` + `poll`. The one-off facades call `execute`, which waits in process every `pollIntervalMs`, at most `jobTimeoutMs`. |
| `prompt-gen` | `estimate` + `execute` | One sync POST to fal's OpenRouter router. |
| `sfx`, `sprite` | `estimate` + `execute` | Submit and wait in process. A sprite with model `none` makes no call. |

Every handler validates and prices a request before it reads the key, uploads or posts. A bad
request bills nothing. `fal` registers before `apimodels` and `ark`, so it is the default
provider of `video`, `music` and `sprite`.

## Setup

Export `FAL_KEY`, or put it in `.env.local` in the working directory. The shell wins over the
file. The key is read at request time: estimates, validation and `models()` never need it.

```ts file="app.ts" check
import { createApp } from "@moku-labs/ai";

export const app = createApp({
  pluginConfigs: {
    fal: {
      upload: "storage", // [!note] `data-uri` sends local files inline instead of uploading them to fal storage.
      requestLog: ".moku/fal-requests.jsonl" // [!note] One JSONL line per billable request. Off by default.
    }
  }
});
```

## Tasks it serves

Each task's request shape is on its own page. These are the fields `fal` reads.

```yaml file="shots.moku.yaml"
version: 1
name: shots
items:
  - id: s01.key
    task: image
    provider: fal
    input: { prompt: "patisserie counter at night", model: nano-banana-pro, aspect: "9:16" }
    params: { resolution: "2K" }
  - id: s01.clip
    task: video
    provider: fal
    input:
      model: kling-3-pro
      prompt: "slow push-in, she smiles"
      image: { $ref: s01.key }
      seconds: 5
      audio: true
  - id: s01.caption
    task: prompt-gen
    provider: fal
    input: { prompt: "Caption a sunset in five words.", model: anthropic/claude-sonnet-5 }
  - id: s01.score
    task: music
    provider: fal
    input: { prompt: "tense synth pulse", model: elevenlabs-music-v2.5, lengthMs: 60000 }
  - id: coin-pickup
    task: sfx
    provider: fal
    input: { prompt: "coin pickup, bright chime", model: elevenlabs-sfx-v2, durationMs: 600 }
  - id: "btn{nine=12,12,12,12}"
    task: sprite
    provider: fal
    input: { source: { $ref: s01.key }, model: birefnet, size: { width: 128, height: 64 }, padding: 2 }
```

- [video](/docs/ai/plugins/video/): `model` is a fal alias from the table below. `image` is the first frame, `endImage` the last frame, `refs` the image, audio and video references. `seconds` defaults to 5, `aspect` to `9:16`, `resolution` to `720p` (`768P` on MiniMax), `audio` to off. `params` is merged last into the body.
- [image](/docs/ai/plugins/image/): `model` defaults to `imageDefaultModel`. A request with `refs` goes to the model's edit endpoint. `params.resolution` is `1K`, `2K`, `4K` or `1080`.
- [prompt-gen](/docs/ai/plugins/prompt-gen/): `model` is an OpenRouter id, default `llmDefaultModel`. `params.reasoning`, `params.responseSchema`, `params.images` and `params.max_tokens` are read; tool calling works through `messages`, `tools` and `toolChoice`.
- [music](/docs/ai/plugins/music/): `model` is required. `lengthMs` must fit the model's range. `chunks` go out as a composition plan on ElevenLabs Music.
- [sfx](/docs/ai/plugins/sfx/): `model` is required. The output is always mp3. Without `durationMs` the estimate bills the 22 s cap.
- [sprite](/docs/ai/plugins/sprite/): `source` is a `$ref` or `$file`. `birefnet` removes the background on fal; `none` skips the call when the source is already transparent.

`music` and `sfx` have no default model. The runner hashes the input as written, so a default
would hide a provider choice in the artifact key.

## Models and prices

These are the bundled tables. `priceOverrides` changes a row or adds one, and a model with no price
fails the estimate instead of counting as $0. `app.fal.models(task)` prints the same list from the
running app, with each model's effective price.

### Video

`input.model` is one of these aliases. Any other value fails the item before any upload.

| Alias | fal endpoint | End frame | Image refs | Audio refs | Video refs | Duration |
|---|---|---|---|---|---|---|
| `seedance-2.5` | `bytedance/seedance-2.5/image-to-video` | yes | none | none | none | 4 to 30 |
| `seedance-2.5-ref` | `bytedance/seedance-2.5/reference-to-video` | no | 29 | 10 | 10 | 4 to 30 |
| `minimax-h3` | `minimax/h3/image-to-video` | yes | none | none | none | integer |
| `minimax-h3-max-ref` | `minimax/h3-max/reference-to-video` | no | 8 | 3 | 3 | 5 to 15 |
| `minimax-h3-max-i2v` | `minimax/h3-max/image-to-video` | yes | none | none | none | integer |
| `minimax-h3-ref` | `minimax/h3/reference-to-video` | no | 8 | 3 | 3 | 5 to 15 |
| `minimax-h3-max-extend` | `minimax/h3-max/extend-video` | no | none | none | none | 5 to 15, new footage only |
| `kling-3-pro` | `fal-ai/kling-video/v3/pro/image-to-video` | yes | none | none | none | 3 to 15 |
| `kling-o3-ref` | `fal-ai/kling-video/o3/pro/reference-to-video` | no | 4 | none | none | 3 to 15 |
| `kling-o3-v2v-ref` | `fal-ai/kling-video/o3/pro/video-to-video/reference` | no | 3 | none | 1 | 3 to 15 |
| `seedance-2.0-mini` | `bytedance/seedance-2.0/mini/image-to-video` | yes | none | none | none | string |
| `seedance-2.0-mini-ref` | `bytedance/seedance-2.0/mini/reference-to-video` | no | 8 | 3 | 3 | string |
| `seedance-2.0-ref` | `bytedance/seedance-2.0/reference-to-video` | no | 8 | 3 | 3 | string |
| `wan-3.0-ref` | `alibaba/wan-3.0/reference-to-video` | no | 9 | 5 | 5 | 2 to 30 |
| `veo-3.1-fast` | `fal-ai/veo3.1/fast/image-to-video` | no | none | none | none | 4, 6 or 8 |
| `vidu-q3` | `fal-ai/vidu/q3/image-to-video` | yes | none | none | none | integer |
| `vidu-q3-ref` | `fal-ai/vidu/q3/reference-to-video/mix` | no | 3 | none | none | integer |
| `gemini-omni-1.1-flash` | `google/gemini-omni-flash/v1.1/image-to-video` | yes | none | none | none | 3 to 10 |
| `gemini-omni-1.1-flash-ref` | `google/gemini-omni-flash/v1.1/reference-to-video` | no | 9 | none | 3 | 3 to 10 |

Image refs are the references after the first frame. A ref with an `audio/*` MIME type is an audio
ref, a `video/*` one is a video ref, every other ref is an image. Too many refs of one kind fail the
item before any upload. `minimax-h3-max-extend` continues a clip: put the source clip in `input.image`.

Video prices are USD per second of output. The lookup is `<alias>@<resolution>`, then
`<alias>+audio` when audio is on, then `<alias>`.

| Key | USD/s |
|---|---|
| `seedance-2.5@480p`, `seedance-2.5-ref@480p` | 0.2205 |
| `seedance-2.5@720p`, `seedance-2.5-ref@720p` | 0.473 |
| `minimax-h3@480P` / `@768P` / `@2K` / `@4K` | 0.05 / 0.06 / 0.13 / 0.16 |
| `minimax-h3-ref@480P` / `@768P` / `@2K` / `@4K` | 0.05 / 0.06 / 0.13 / 0.16 |
| `minimax-h3-max-ref@480P` / `@768P` / `@1080P` | 0.05 / 0.08 / 0.16 |
| `minimax-h3-max-i2v@480P` / `@768P` / `@1080P` | 0.05 / 0.08 / 0.16 |
| `minimax-h3-max-extend@480P` / `@768P` / `@1080P` / `@2K` | 0.05 / 0.08 / 0.16 / 0.32 |
| `kling-3-pro` / `kling-3-pro+audio` | 0.112 / 0.168 |
| `kling-o3-ref` / `kling-o3-ref+audio` | 0.112 / 0.14 |
| `kling-o3-v2v-ref` | 0.168 |
| `seedance-2.0-mini@480p` / `@720p`, same for `seedance-2.0-mini-ref` | 0.0721 / 0.1547 |
| `seedance-2.0-ref@480p` / `@720p` / `@1080p` | 0.092 / 0.3034 / 0.682 |
| `wan-3.0-ref@480p` / `@720p` / `@1080p` | 0.05 / 0.10 / 0.20 |
| `veo-3.1-fast` / `veo-3.1-fast+audio` / `veo-3.1-fast@4k` | 0.10 / 0.15 / 0.35 |
| `vidu-q3@360p` / `@540p` / `@720p` / `@1080p`, same for `vidu-q3-ref` | 0.07 / 0.07 / 0.154 / 0.154 |
| `gemini-omni-1.1-flash@360p` / `@720p` / `@1080p` / `@4k`, same for `gemini-omni-1.1-flash-ref` | 0.03 / 0.10 / 0.15 / 0.30 |

Cost is `seconds × USD/s` plus a reference surcharge on two models. `minimax-h3-max-ref` and
`minimax-h3-max-extend` include 4096 reference tokens and bill 0.02 USD per 1000 above that
(`<alias>#refTokensIncluded`, `<alias>#refTokenUsdPer1k`). `minimax-h3-ref` includes 5 images and
bills 0.08 USD per extra one (`minimax-h3-ref#refImagesIncluded`, `minimax-h3-ref#refImageUsd`).
Seedance 2.5 and 2.0 Mini have no bundled 1080p price: add `seedance-2.5@1080p` to
`priceOverrides` to use it.

### Image

| Alias | Text endpoint | Edit endpoint | Max refs | USD per image |
|---|---|---|---|---|
| `nano-banana-pro` | `fal-ai/nano-banana-pro` | `fal-ai/nano-banana-pro/edit` | 14 | 0.15 at `1K` and `2K`, 0.30 at `4K` |
| `nano-banana-2.1` | `fal-ai/nano-banana-2.1` | `fal-ai/nano-banana-2.1/edit` | 14 | 0.15 at `1K` and `2K`, 0.30 at `4K` |
| `seedream-4.5-edit` | `fal-ai/bytedance/seedream/v4.5/text-to-image` | `fal-ai/bytedance/seedream/v4.5/edit` | 10 | 0.04 |
| `gpt-image-2.5` (default) | `openai/gpt-image-2.5/sunburst/text-to-image` | `openai/gpt-image-2.5/sunburst/edit` | 16 | 0.05, 0.06 at `2K` |

Keys are `image:<alias>@<resolution>`, then `image:<alias>`. GPT Image rows are the `high`
quality price. `params.quality` `xhigh` multiplies the row by 1.78, `max` by 4. Nano Banana 2.1
has no fal list price: it uses Pro's as an upper bound.

### prompt-gen

`model` is any OpenRouter id, as long as it has a price. USD per million tokens.

| OpenRouter id | In | Out |
|---|---|---|
| `anthropic/claude-opus-5.5` (default) | 4 | 20 |
| `anthropic/claude-sonnet-5` | 2 | 10 |
| `openai/gpt-6-sol` | 2 | 10 |
| `openai/gpt-6-astra` | 10 | 50 |
| `google/gemini-3.8-flash` | 0.75 | 3.75 |
| `x-ai/grok-4.7` | 2 | 6 |

Keys are `llm:<id>#in` and `llm:<id>#out`. Also priced, not listed: `anthropic/claude-haiku-4.5`
(1 / 5) and `google/gemini-2.5-flash` (0.3 / 2.5). The actual cost is fal's `usage.cost` when fal
reports it, else the token counts at the table price.

### Music, sfx and sprite

| Task | Alias | Endpoint | Length | Price |
|---|---|---|---|---|
| `music` | `elevenlabs-music-v2.5` | `fal-ai/elevenlabs/music/v2.5` | 3 000 to 600 000 ms | 0.80 USD per started minute |
| `music` | `stable-audio-2.5` | `fal-ai/stable-audio-25/text-to-audio` | 1 000 to 190 000 ms | 0.20 USD per generation |
| `sfx` | `elevenlabs-sfx-v2` | `fal-ai/elevenlabs/sound-effects/v2` | 500 to 22 000 ms, optional | 0.002 USD per started second |
| `sprite` | `birefnet` | `fal-ai/birefnet/v2` | | 0.002 USD per image, an estimate |
| `sprite` | `none` | no call | | 0 |

Keys are `music:<alias>`, `sfx:<alias>` and `sprite:<alias>`.

## Config

`pluginConfigs.fal`. Flat keys, shallow merge.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKeyEnv` | `string` | `"FAL_KEY"` | Env var with the key, read through `ctx.env` per request. |
| `queueUrl` | `string` | `"https://queue.fal.run"` | Queue base URL. Submit is `POST <queueUrl>/<endpoint>` for video, image, music, sfx and sprite. |
| `uploadUrl` | `string` | fal storage initiate URL | `https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3`. |
| `upload` | `"storage" \| "data-uri"` | `"storage"` | How local files reach fal. `storage` falls back to a data URI when the upload fails. |
| `timeoutMs` | `number` | `60_000` | Timeout of one HTTP request: submit, status, result, download, chat POST. |
| `priceOverrides` | `Record<string, number>` | `{}` | One table for every task. Video keys are unprefixed, the other tasks carry `image:`, `music:`, `sfx:`, `sprite:` or `llm:`. Overrides win. |
| `runUrl` | `string` | `"https://fal.run"` | Sync endpoint base. prompt-gen posts to `<runUrl>/openrouter/router/openai/v1/chat/completions`. |
| `imageDefaultModel` | `string` | `"gpt-image-2.5"` | Image model when `ImageRequest.model` is omitted. |
| `llmDefaultModel` | `string` | `"anthropic/claude-opus-5.5"` | prompt-gen model when `model` is omitted or `"default"`. |
| `pollIntervalMs` | `number` | `2000` | Status-check cadence of the in-process wait of image, music, sfx and sprite `execute`. |
| `jobTimeoutMs` | `number` | `900_000` | The in-process wait gives up after this with a retryable `timeout`. The job keeps running on fal. |
| `requestLog` | `string` | `""` | JSONL request log path, relative to the working directory. `""` is off. Never the key or the prompt text. |

## API

Mounted at `app.fal`, reachable with `ctx.require(falPlugin)`. No method makes a network call
except `upload`.

| Method | Signature | Description |
|---|---|---|
| `info` | `() => FalInfo` | `{ provider: "fal", configured, models }`. `configured` is true when the key is set. `models` are the video aliases. |
| `models` | `(task: FalTask) => FalModelInfo[]` | One task's models in catalog order with the effective price: video and image at the default resolution, video with audio off and no refs. An unknown task throws. |
| `upload` | `(file: { path; mimeType }, opts?: { signal? }) => Promise<{ url }>` | Uploads a local file through fal storage, even with `upload: "data-uri"`. The same bytes and MIME type return the cached URL. Never falls back to a data URI. |

`FalTask` is `"video" | "image" | "prompt-gen" | "music" | "sfx" | "sprite"`. The price shape
narrows on `"inputPerM" in info.price`.

```ts file="prices.ts" check
import { app } from "./app";

for (const model of app.fal.models("video")) {
  if ("inputPerM" in model.price) continue; // [!note] prompt-gen prices are per million tokens. Every other task prices `usd` per `second`, `image`, `minute` or `generation`.
  console.log(model.id, model.price.usd, "per", model.price.per);
}

console.log(app.fal.info().configured); // [!note] `false` until `FAL_KEY` is set. Nothing above needed it.
```

`upload` returns a URL fal can read. Use it to host a portrait before registering it with
[ark](/docs/ai/plugins/ark/):

```ts file="register.ts" check
import { app } from "./app";

const image = { path: "faces/mira.png", mimeType: "image/png", hash: "a".repeat(64) };
const { url } = await app.fal.upload(image);
const record = await app.asset.register({ image, url }, { provider: "ark" });
console.log(record.assetId);
```

## Errors

The classes are `FalErrors.RetryableProviderError`, `FalErrors.TerminalProviderError` and
`FalErrors.FlaggedProviderError`. Messages start with `[ai]` and never contain the key or the prompt.

| Condition | Result |
|---|---|
| Caller abort | Rethrown unchanged. Uploads stop; a queue POST already sent runs to the end, so a billed job always returns its id. |
| Request timeout or network failure | Retryable, `kind: "timeout"` or `"network"`. |
| 429 | Retryable, `Retry-After` honored. |
| 5xx | Retryable. |
| 422 content policy, or fal text matching `sensitive`, `likeness`, `nsfw`, `moderation` | Flagged, never re-queued. |
| Other 4xx | Terminal. |
| Unknown model, missing image, too many refs, end frame on a model without one, missing price, bad params | Terminal 400 before the key is read or anything is uploaded. |
| Key not set at poll time, or the status call answers 401 or 403 | Plain error. The runner marks the job `expired`, so the next run adopts the same job instead of paying again. |
| Result or download of a `COMPLETED` job answers 400 or 422 | `failed`, terminal: fal's verdict on the job. |
| Result or download fails with another 4xx | Retryable 503: the clip exists and is paid for, polling goes on. |
| Image or music `execute` passes `jobTimeoutMs` | Retryable `timeout`. The job stays adoptable through `poll`. |
| prompt-gen 401 or 403 | `PromptGenUnavailableError`, reason `auth`: `promptGen` moves to its next fallback provider. |
| prompt-gen 402 or 429 | `PromptGenUnavailableError`, reason `limit`. |
| prompt-gen tool-call arguments that are not JSON | `ToolArgumentsError`, never retried. |
| sfx result is not mp3 | Terminal 415, never returned. |
| An `image`, `endImage` or ref that `$ref`s an `asset` item | Terminal 400: fal cannot use registered assets. Use provider `ark`. |
| `input.fromDraft` | Terminal: fal takes no draft render. Use provider `ark`. |

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): the six `register` calls.

:::gotchas
- **A refused face.** fal's Seedance endpoints refuse a real face and have no asset field. For real people use [apimodels](/docs/ai/plugins/apimodels/) or [ark](/docs/ai/plugins/ark/).
- **Video refs are not measured.** The plugin does not read clip lengths. Keep video refs within the model's combined seconds yourself; fal answers 422 otherwise.
- **The upload cache lives in the process.** The same bytes upload once across items, attempts and runs. `app.stop()` keeps it; a new process uploads again.
- **No `1080p` for Seedance 2.5.** The bundled table has `480p` and `720p` only. Add `seedance-2.5@1080p` to `priceOverrides` or the estimate fails.
- **`wan-3.0-ref` bills its reference videos too.** The estimate counts the output seconds only.
:::

## Related

- [Video shots](/docs/ai/guides/video-shots/): keyframe, clip and score in one build file.
- [video plugin](/docs/ai/plugins/video/): the request shape and the `submit` + `poll` contract.
- [apimodels plugin](/docs/ai/plugins/apimodels/): the same Seedance aliases, with real faces.
- [ark plugin](/docs/ai/plugins/ark/): Seedance straight from ByteDance, drafts and assets.
