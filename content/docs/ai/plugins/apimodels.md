---
title: apimodels
description: "Provider. Seedance 2.5 and 2.0 official over apimodels.app: the same aliases as fal, and real faces are accepted."
section: Providers
order: 37
---

## What it does

**Provider.** `apimodels` serves the `video` task over the apimodels.app task API. It registers
`("video", "apimodels")` with the registry in `onInit`.

Its reason to exist is faces. fal's Seedance endpoints refuse a real person and have no asset
field. apimodels serves Seedance 2.5 and Seedance 2.0 official, which accept a real-person photo.
It takes a face in two ways:

| Route | What happens |
|---|---|
| Auto | Every input goes up as an https upload. apimodels registers a refused face by itself and retries. |
| `params.assets` | The request names the inputs to register first and send as `asset://` ids. Registrations are cached in the journal. |

The handler is `submit` + `poll`. The job id is JSON `{ taskId, model, assetUsd }`, journaled by
the runner before it waits. A crash, Ctrl-C or restart polls the same task again. It is never
submitted and paid twice. There is no `execute`: `app.video.generate()` drives the same loop.

## Setup

Export `APIMODELS_API_KEY`, or put it in `.env.local` in the working directory. The shell wins
over the file. The key is read at submit and poll time. Estimates never need it.

```ts file="app.ts" check
import { createApp } from "@moku-labs/ai";

export const app = createApp({
  pluginConfigs: {
    video: { defaultProvider: "apimodels" }, // [!note] Optional. Without it `fal` is the default, and items name `provider: apimodels`.
    apimodels: { assetGroup: "series-01" }
  }
});
```

The framework ships the lane default `video/apimodels`: `{ concurrency: 2, rpm: 20 }`. Upstream
rate limits are not documented. The lane is held for the whole attempt, polling included.

## Tasks it serves

```yaml file="shot-03.moku.yaml"
version: 1
name: shot-03
items:
  - id: shot-03
    task: video
    provider: apimodels
    input:
      model: seedance-2.5
      prompt: "She turns to the window, slow push-in."
      image: { $file: cast/anna.png }
      seconds: 8
    params: { assets: ["image"] }
```

- [video](/docs/ai/plugins/video/): `model` is one of the four aliases below. `image` is required on every alias. `seconds` defaults to 5, `aspect` to `9:16`, `resolution` to `720p`, `audio` to off. `negative` is not supported upstream: it is dropped and logged at debug level. `params` is merged last into the body, after `assets` is removed.

`params.assets` lists the inputs to send as `asset://` ids: `"image"`, `"endImage"` or `"refs.<n>"`.
Name only portraits. Props, locations and sketch sheets never need to be in an identity store.
Each named input must be an image. A registration costs `asset` (0.01 USD) and the estimate adds it
per named input, a worst case: the estimate cannot see the cache.

## Models and prices

This is the bundled table. `priceOverrides` changes a row, and a model with no price fails the
estimate instead of counting as $0. The aliases mirror fal's, so a build item switches `provider`
only. Any other value fails with a terminal 400.

| Alias | API model | `image` | `endImage` | `refs` | Resolutions | Seconds | USD/s at 480p / 720p / 1080p |
|---|---|---|---|---|---|---|---|
| `seedance-2.5` | `seedance-2.5` | `first_frame_url` | `last_frame_url` | refused | 480p, 720p | 4 to 30 | 0.12 / 0.27 |
| `seedance-2.5-ref` | `seedance-2.5` | `reference_image_urls[0]` | refused | 30 images with `image`, 10 audio, 10 video | 480p, 720p | 4 to 30 | 0.12 / 0.27 |
| `seedance-2.0` | `seedance-2.0-official` | `first_frame_url` | `last_frame_url` | refused | 480p, 720p, 1080p | 4 to 15 | 0.092 / 0.197 / 0.492 |
| `seedance-2.0-ref` | `seedance-2.0-official` | `reference_image_urls[0]` | refused | 9 images with `image`, 10 audio, 10 video | 480p, 720p, 1080p | 4 to 15 | 0.092 / 0.197 / 0.492 |

Price keys are `<alias>@<resolution>` in USD per second and `asset` in USD per registration. Refs
are told apart by MIME type. A refused field, a resolution or length outside the table, or too many
refs fails at estimate and at submit, before any upload or charge. `input.fromDraft` is refused:
use [ark](/docs/ai/plugins/ark/) with a Seedance 2.5 draft.

When the task is done, `GET /records/<taskId>` gives the real cost: when `settled` is true and
the currency is USD, the cost is `credits + assetUsd`. Otherwise the table price plus `assetUsd`.

## Config

`pluginConfigs.apimodels`.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKeyEnv` | `string` | `"APIMODELS_API_KEY"` | Env var with the key, read through `ctx.env` at submit and poll time. |
| `baseUrl` | `string` | `"https://api.apimodels.app/v1"` | API base URL, no trailing slash. |
| `assetGroup` | `string` | `"moku-ai"` | Name of the asset group, created once per account on the first registration. |
| `timeoutMs` | `number` | `60_000` | Timeout of one HTTP request. Also caps the local `Retry-After` wait of uploads and registrations. |
| `priceOverrides` | `Record<string, number>` | `{}` | Replaces bundled prices per key: `<alias>@<resolution>` in USD/s, or `asset` in USD per registration. |

## API

Mounted at `app.apimodels`, reachable with `ctx.require(apimodelsPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `info` | `() => ApimodelsInfo` | `{ provider: "apimodels", configured, models }`. `configured` is true when the key is set. `models` lists the four aliases. No network call. |

```ts file="info.ts" check
import { app } from "./app";

const { configured, models } = app.apimodels.info();
console.log(configured, models); // false, ["seedance-2.5", "seedance-2.5-ref", "seedance-2.0", "seedance-2.0-ref"]

const { usd } = app.video.estimate(
  { model: "seedance-2.5", prompt: "slow push-in", seconds: 8 },
  { provider: "apimodels" }
);
console.log(usd); // [!note] 8 s at the default 720p: 2.16. No key needed.
```

## Errors

The classes are `ApimodelsErrors.RetryableProviderError`, `ApimodelsErrors.TerminalProviderError`
and `ApimodelsErrors.FlaggedProviderError`. Messages start with `[ai] apimodels` and never contain
the key or the prompt: both are cut out of any text apimodels sends back.

| Condition | Result |
|---|---|
| Key not set at submit | Terminal 401, before any network call. |
| Unknown model, missing image, refused field, bad resolution or seconds, too many refs, bad `params.assets` | Terminal 400, before any upload. |
| 401 or 403 at submit | Terminal: check `APIMODELS_API_KEY`. |
| 402 | Terminal: balance too low. |
| 422 on asset registration, or fail code `CONTENT_MODERATION` | Flagged, never re-queued. Not charged. |
| Other 4xx | Terminal. |
| 429 | Retryable, `Retry-After` honoured. |
| 5xx, unreadable JSON | Retryable. |
| Timeout or network failure | Retryable, `kind: "timeout"` or `"network"`. |
| Stale asset id, task unknown to apimodels, dead result URL | Retryable 503, `kind: "resubmit"`: submitted again, not counted against the lane breaker. The second stale id for the same item is terminal. |
| Key missing at poll time, 401 or 403 on the poll, corrupt job id | Plain error, no status: the job is marked `expired`. Fix the key and the next run adopts the same task. |
| Caller abort | Rethrown unchanged. Once the POST is sent it runs to the end, so a billed task always returns its id. |

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): the `register` call.

It also reads and writes provider records
through `ctx.journal` for the asset cache. Before `app.start()` the journal is closed:
`app.video.generate()` then uses the in-process cache only and logs `apimodels:journal:closed` once.

:::gotchas
- **The 7-day window.** `resultUrls[0]` lives 7 days. A task adopted after that finds its result gone, the poll returns a retryable failure and the runner submits the task again. That clip is paid again.
- **Not verified live.** The plugin was built without a paid smoke test. Whether the auto path bills 0.01 per generation, and `asset://` in `last_frame_url`, are unconfirmed. The explicit `params.assets` path is the safe one.
- **Cache keys are the runner's hashes.** The sha256 of a `$file` or the store hash of a `$ref`, never recomputed. The account is a 12-character fingerprint of the key, not the key. A key change never reuses another account's ids.
:::

## Related

- [Faces in video](/docs/ai/guides/faces/): the routes that work for a real person.
- [fal plugin](/docs/ai/plugins/fal/): the same aliases, more models, no faces.
- [ark plugin](/docs/ai/plugins/ark/): Seedance straight from ByteDance, drafts and assets.
- [video plugin](/docs/ai/plugins/video/): the request shape and the job contract.
