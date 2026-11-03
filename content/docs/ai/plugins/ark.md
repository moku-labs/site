---
title: ark
description: "Provider. Seedance video, Seedream images and portrait assets straight from BytePlus ModelArk or Volcengine Ark: drafts, 1080p finals, trusted faces."
section: Providers
order: 31
---

## What it does

**Provider.** `ark` talks to ByteDance's own API, without a reseller in between. One plugin
instance is one region and one account. It registers three handlers with the registry in `onInit`:

| Handler | What it does |
|---|---|
| `("video", "ark")` | Seedance text-to-video and image-to-video. Maps asset refs to `asset://<id>` and checks every asset before any paid call. Makes cheap 480p drafts and renders a draft again at 1080p. |
| `("image", "ark")` | Seedream 5.0 lite text-to-image, and image-to-image from local refs. One image or a group of consistent images. The bytes come back unchanged, so Seedance trusts a face in them. |
| `("asset", "ark")` | Registers one portrait into an AIGC asset group through the signed asset OpenAPI and returns an `AssetRecord`. |

Video and asset are `submit` + `poll`: the runner journals the task or asset id before it waits,
so a crash or Ctrl-C resumes by polling the same job. Image is one call: once sent, it runs to the
end, so a paid image is not lost to a pause.

`ark` registers after `fal`, so `fal` stays the default video provider. Put `provider: ark` on the
items that should go to Ark.

## Setup

### Regions

| `region` | Service | Data plane (video, images) | Control plane (assets) | Prices |
|---|---|---|---|---|
| `intl` (default) | BytePlus ModelArk | `https://ark.ap-southeast.bytepluses.com/api/v3` | `https://ark.ap-southeast-1.byteplusapi.com` | USD |
| `cn` | Volcengine Ark | `https://ark.cn-beijing.volces.com/api/v3` | `https://open.volcengineapi.com` | CNY |

Each region serves only its own model ids. A model from the other region fails before any call.

### Keys and entitlements

:::steps
1. **Keys.** Export them, or put them in `.env.local` in the working directory. The shell wins over the file. A video request without asset refs needs only `ARK_API_KEY`. Estimates and validation need no key.

   | Env var | Used for |
   |---|---|
   | `ARK_API_KEY` | Video tasks and Seedream images. Bearer, read at submit and poll time. |
   | `ARK_ACCESS_KEY` | The asset API, signed with HMAC-SHA256. Read on the first asset call, and by the video preflight when a request carries an asset ref. |
   | `ARK_SECRET_KEY` | The secret that goes with `ARK_ACCESS_KEY`. |

2. **Seedance Advanced Creation Rights.** The asset API needs this entitlement on the account. Without it the asset calls fail with an `AccessDenied*` or `InvalidAuthorization*` code.
3. **AIGC authorization letter.** AIGC asset groups need a one-time authorization letter, signed in the Ark console.
4. **Group id.** With `groupId` unset, the first registration finds the oldest group with the exact `groupName`, or creates one and logs its id as `ark:asset:group-created`. Set `groupId` to pin it. An account holds at most 50 groups.
:::

```ts file="app.ts" check
import { createApp } from "@moku-labs/ai";

export const app = createApp({
  pluginConfigs: {
    ark: { region: "intl", groupId: "group-20260929120000-abcde" } // [!note] `groupId` applies only to `groupName`. A request with another name is looked up by name.
  }
});
```

## Tasks it serves

```yaml file="mira.moku.yaml"
version: 1
name: mira
items:
  - id: key-01
    task: image
    provider: ark
    input: { prompt: "Vertical 9:16 photo. Close-up, Akari lifts a cake box lid", aspect: "9:16" }
  - id: face-mira
    task: asset
    provider: ark
    input: { image: { $file: faces/mira.png }, url: "https://cdn.example/faces/mira.png" }
  - id: clip-01
    task: video
    provider: ark
    input:
      model: dreamina-seedance-2-5-260628
      prompt: "image 1 walks into the rain"
      refs: [{ $ref: face-mira }]
      seconds: 10
      resolution: 720p
      aspect: "9:16"
```

- [video](/docs/ai/plugins/video/): `model` is an id from the table below, for the configured region. `image` is the first frame, `endImage` the last frame, `refs` the reference images and assets, in request order. A local image goes out as a data URI, an asset ref as `asset://<id>`. `seconds` defaults to 5, `resolution` to `720p`, `aspect` to `9:16`. `audio: true` turns on `generate_audio`. `negative` is dropped with one warning.
- [image](/docs/ai/plugins/image/): `model` defaults to `seedream-5-0-lite-260128`. `aspect` picks the size: `9:16` is 1440×2560, `16:9` 2560×1440, `1:1` 2048×2048, `3:4` 1728×2304, `4:3` 2304×1728. `refs` are local images, up to 14, cited by position in the prompt ("image 1"). `params.images: N` asks for a group of up to N consistent images; refs plus N is at most 15.
- [asset](/docs/ai/plugins/asset/): `image` is the portrait, PNG, JPEG or WebP, under 30 MB, 300 to 6000 px per side. `url` is required: a public https URL of the same bytes. Ark fetches the portrait from there and never uploads it. `groupName` picks a group other than `config.groupName`.

The prompt cites refs by position. The handler never rewrites it.

### Video params

`params` is an allowlist. Any other key fails before any call.

| Param | Meaning |
|---|---|
| `refUrls` | Video and audio references as public https URLs. Ark takes base64 for images only; the caller hosts clips and audio. `.mp4` and `.mov` are video, `.mp3` and `.wav` audio. A video or audio file in `refs` fails before any call. |
| `draft` | `true` only: a 480p draft on Seedance 2.5. |
| `seed` | Passed through on a model that takes a seed (Seedance 2.5). Fails on the others. |
| `omni_reference_task_type` | `auto`, `reference`, `edit` or `extend`. Pins the Seedance 2.5 task when the prompt wording would pick the wrong one. An edit needs `aspect: adaptive` and `seconds: -1`, an extension `aspect: adaptive`. |
| `watermark`, `return_last_frame`, `execution_expires_after`, `priority` | Passed through. The last frame URL comes back in `meta.lastFrameUrl`. |
| `generation` | Never sent. It only changes the item key, so a new value renders again. |

On Seedance 2.5 with a first or last frame, the output ratio follows the image and `ratio` is
not sent. An explicit `aspect` is checked but cannot be honoured: one `ark:ratio:ignored` warning.

## Models and prices

These are the bundled tables. `priceOverrides` changes a row by model id, and a model with no price
fails the estimate instead of counting as $0. `app.ark.info()` lists the configured region's ids.

### Video

Prices are per 1M output tokens, "no video input / with video input". intl prices are list
prices from the official price page. cn prices come from summaries of the rate card and are
divided by `cnyPerUsd` to report USD. Check them in the console before a paid run.

| Model | Region | Clip | Resolutions | Refs img / vid / aud | Seed | Draft | 480p, 720p | 1080p |
|---|---|---|---|---|---|---|---|---|
| `dreamina-seedance-2-0-260128` | intl | 4 to 15 s | 480p, 720p, 1080p | 9 / 3 / 3 | no | no | $7.0 / $4.3 | $7.7 / $4.7 |
| `dreamina-seedance-2-0-fast-260128` | intl | 4 to 15 s | 480p, 720p | 9 / 3 / 3 | no | no | $5.6 / $3.3 | none |
| `dreamina-seedance-2-0-mini-260615` | intl | 4 to 15 s | 480p, 720p | 9 / 3 / 3 | no | no | $3.5 / $2.1 | none |
| `dreamina-seedance-2-5-260628` | intl | 4 to 30 s | 480p, 720p, 1080p | 30 / 10 / 10 | yes | yes | $10.7 / $6.4 | $11.7 / $7.0 |
| `doubao-seedance-2-0-260128` | cn | 4 to 15 s | 480p, 720p, 1080p | 9 / 3 / 3 | no | no | ¥46 / ¥28 | same |
| `doubao-seedance-2-5-260628` | cn | 4 to 30 s | 480p, 720p, 1080p | 30 / 10 / 10 | yes | yes | ¥70 / ¥42 | same |

Cost is `usage.completion_tokens / 1e6 × price`. The "with video input" price applies when
`refUrls` holds a video URL. The estimate is `width × height × (24 × seconds + 1) / 1024` tokens at
the base price, with 480p as 864×496, 720p as 1280×720 and 1080p as 1920×1080. This matched live
bills exactly: 480p 5 s is 50,638 tokens, 1080p 5 s is 245,025 tokens.

Enterprise discounts are not in the catalog. Set them with `priceOverrides`.

### Image

| Model | Region | Smallest size | Refs | Group: refs + images | Price |
|---|---|---|---|---|---|
| `seedream-5-0-lite-260128` (default) | intl | 3,686,400 px | 14 | 15 | $0.035 per image |

There is no cn image model. `costUsd` is the price per image times `usage.generated_images`.
A group's estimate prices N images, an upper bound; Ark bills each image it made.

### Asset

An asset registration estimates at $0: the fee is part of the entitlement.

## Draft and final

Seedance 2.5 makes a cheap 480p draft with `params.draft: true`. A final renders the same draft
again at 1080p: same frames, motion, seed and audio. Only the draft task goes to Ark.

```yaml file="e01.moku.yaml"
version: 1
name: e01
items:
  - id: s04.key
    task: image
    provider: ark
    input: { prompt: "Vertical 9:16 photo. Close-up, Akari lifts a cake box lid", aspect: "9:16" }
  - id: s04.draft
    task: video
    provider: ark
    input:
      model: dreamina-seedance-2-5-260628
      prompt: "Akari lifts the lid, smiles"
      image: { $ref: s04.key }
      seconds: 5
      audio: true
    params: { draft: true }
  - id: s04.final
    task: video
    provider: ark
    input:
      model: dreamina-seedance-2-5-260628
      fromDraft: { $ref: s04.draft }
```

| Rule | Draft | Final |
|---|---|---|
| Model | one with a draft mode: `dreamina-seedance-2-5-260628` | the same model as the draft |
| Resolution | absent or `480p` | absent or `1080p` |
| Inputs | the usual request | `fromDraft` only. `image`, `endImage`, `refs`, `params.refUrls`, `params.seed` and `params.draft` are refused. `prompt` may be left out and is never read. |
| Params | the allowlist | `watermark`, `return_last_frame`, `execution_expires_after`, `priority`. `omni_reference_task_type` is refused: Ark reuses the draft's task type. |
| Needs | `ARK_API_KEY` | the journal open (`app.start()`) and a draft record younger than 7 days |

When a draft succeeds, ark keeps its task id in the journal as a `draft` provider record, keyed by
the sha256 of the clip, scoped to this region and API key. A `$ref` to the draft item finds it.
Every check runs before any call; each failure is a plain terminal error, nothing billed.

**The 7-day rule.** Ark keeps a draft id valid for 7 days from the draft's `created_at`. After
that, bump `params.generation` on the draft item: the draft renders again, and so does the final.

**Price of a final.** Ark bills a final at 1080p, at the rate of its draft: "with video input"
when the draft had a reference video, base when it had none. The final's own request sends no
video, so the rate comes from the draft record. On `dreamina-seedance-2-5-260628` a 5 s final is
341,880 tokens: $2.39 with video input, $4.00 without. A record without the field, written by an older
version, gets the base price with an `ark:cost:draft-input-unknown` warning.

## Faces

Seedance refuses a real face in an image from outside, for example a Codex keyframe. The item is
`flagged` and the task is not billed. There is no raw-photo fallback and no registration after a
refusal. Two routes work.

| Route | How | Holds when |
|---|---|---|
| Seedream first | An `image` item on provider ark, then `$ref` it as `image` of the video item. | The image was made by Seedream 5.0 lite on the same account, the bytes are unchanged, and it is used within 30 days. |
| Asset | An `asset` item registers the portrait, the video items `$ref` it. | The portrait passed Ark's review. A refused asset flags the item, and the clips that use it are never dispatched. |

The handler never decodes, resizes, crops or re-encodes a Seedream image, so the bytes stay
trusted. The guide [Faces in video](/docs/ai/guides/faces/) walks both routes.

### Asset preflight

Before a video POST, every asset ref is checked. The POST happens only when all checks pass:
the record was registered by ark, it belongs to this account, and `GetAsset` says `Active`. An
asset seen `Active` is not checked again in the same process.

An asset id is valid only in the account that registered it. The record carries a one-way
fingerprint, `sha256("moku-ai:" + region + ":" + accessKey)` cut to 12 characters. It never contains
the key. When the keys change, bump `params.generation` on the asset items to register the
portraits in the new account.

### A dead asset

A stored record is reused as long as the item's input is unchanged. When the asset was deleted in
the console, or the preflight reports it as not `Active`, bump `params.generation` on the asset
item. The new key registers the portrait again, and the clips that use it render again.

```yaml file="mira.moku.yaml"
  - id: face-mira
    task: asset
    provider: ark
    input:
      image: { $file: faces/mira.png }
      url: "https://cdn.example/faces/mira.png"
    params: { generation: 2 }
```

## Config

`pluginConfigs.ark`.

| Option | Type | Default | Description |
|---|---|---|---|
| `region` | `"intl" \| "cn"` | `"intl"` | BytePlus ModelArk or Volcengine Ark. |
| `apiKeyEnv` | `string` | `"ARK_API_KEY"` | Env var of the API key: video tasks and images. |
| `accessKeyEnv` | `string` | `"ARK_ACCESS_KEY"` | Env var of the access key id: the asset API. |
| `secretKeyEnv` | `string` | `"ARK_SECRET_KEY"` | Env var of the secret access key. |
| `baseUrl` | `string \| null` | `null` | Data-plane URL override, for proxies and tests. `null` is the region's. |
| `controlUrl` | `string \| null` | `null` | Control-plane URL override. `null` is the region's. |
| `groupId` | `string \| null` | `null` | AIGC asset group for `config.groupName` only. `null` finds the oldest exact name match, or creates and logs one. |
| `groupName` | `string` | `"moku-ai"` | Default group name when the request leaves out `groupName`. |
| `timeoutMs` | `number` | `60_000` | Timeout of one HTTP request. |
| `downloadTimeoutMs` | `number` | `300_000` | Timeout of one clip or image download. A 1080p or 30 s clip is large. |
| `priceOverrides` | `Record<string, number>` | `{}` | By model id, wins over the catalog: USD per 1M output tokens for a video model, USD per image for an image model. |
| `cnyPerUsd` | `number` | `7.1` | CNY per 1 USD, to report cn prices in USD. |

## API

Mounted at `app.ark`, reachable with `ctx.require(arkPlugin)`. The four library methods use the
signed asset OpenAPI and need the access key and secret key. `opts.signal` cancels their calls.

| Method | Signature | Description |
|---|---|---|
| `info` | `() => ArkInfo` | `{ provider: "ark", region, configured: { video, assets, image }, models, imageModels }`. `video` and `image` are true when the API key is set, `assets` when both the access key and the secret key are set. No network call. |
| `draftRecord` | `(hash: string) => ArkDraftRecord \| undefined` | The record of a draft clip by its sha256. Sync, no network call. `undefined` when the key is not set, the journal is closed, there is no record, or the record is damaged. Never throws. |
| `listAssetGroups` | `(opts?: { signal? }) => Promise<ArkAssetGroup[]>` | `ListAssetGroups` with `GroupType: "AIGC"`. Reads all pages. |
| `listAssets` | `(filter?: { groupId? }, opts?: { signal? }) => Promise<ArkAsset[]>` | `ListAssets` with `GroupType: "AIGC"`, narrowed to one group when `groupId` is given. Reads all pages. |
| `deleteAsset` | `(assetId: string, opts?: { signal? }) => Promise<void>` | `DeleteAsset`. The id is forgotten in the preflight cache. |
| `deleteAssetGroup` | `(groupId: string, opts?: { signal? }) => Promise<void>` | `DeleteAssetGroup`. Deletes its assets too and clears the preflight cache. |

`ArkDraftRecord` is `{ taskId, model, seed, createdAt, withVideoInput }`. `createdAt` is ms since
the epoch; the draft id is valid 7 days from there. `ArkAsset` is
`{ assetId, name, groupId, status, createTime?, updateTime?, lastInferenceTime? }`, `ArkAssetGroup`
is `{ groupId, name, createTime? }`. Both are exported as `Ark.ArkAsset` and `Ark.ArkAssetGroup`.

`draftRecord` does not check the age or the model. Compare `createdAt` yourself before a final:

```ts file="final.ts" check
import { app } from "./app";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const draftSha256 = "a".repeat(64); // [!note] The store hash of the draft clip, the same value as `fromDraft.hash`.

await app.start(); // [!note] The record lives in the journal. Before `start()` the call returns `undefined`.
const record = app.ark.draftRecord(draftSha256);
const isFresh = record !== undefined && Date.now() - record.createdAt < SEVEN_DAYS_MS;

if (isFresh) {
  const final = await app.video.generate(
    { model: record.model, prompt: "", fromDraft: { path: "draft.mp4", mimeType: "video/mp4", hash: draftSha256 } },
    { provider: "ark" }
  );
  console.log(final.costUsd, final.meta); // [!note] `meta.resolution` is `1080p`, `meta.draftTaskId` the draft's task id.
}
await app.stop();
```

One group per series: register in `series-01`, list its assets, then delete one.

```ts file="library.ts" check
import { app } from "./app";

const image = { path: "faces/mira.png", mimeType: "image/png", hash: "a".repeat(64) };
const record = await app.asset.register(
  { image, url: "https://cdn.example/faces/mira.png", groupName: "series-01" },
  { provider: "ark" }
);

const assets = await app.ark.listAssets({ groupId: record.groupId });
const asset = assets[0];
if (asset !== undefined) await app.ark.deleteAsset(asset.assetId);
```

## Errors

The classes are `ArkErrors.RetryableProviderError`, `ArkErrors.TerminalProviderError` and
`ArkErrors.FlaggedProviderError`. Messages start with `[ai]` and never contain a key or a signed URL.

| Condition | Result |
|---|---|
| Caller abort | Rethrown unchanged. A task POST already sent runs to the end, so a billed task always returns its id. |
| Request timeout or network failure | Retryable, `kind: "timeout"` or `"network"`. |
| HTTP 429 | Retryable, `Retry-After` honored. |
| HTTP 5xx | Retryable. |
| HTTP 400 or 422 with a `SensitiveContent` code | Flagged. `Input…Image…` on a plain local image says to use a Seedream image or an asset item. `Output…` means Ark refused its own result: run a new take, it was not charged. `InputText…` says to change the prompt. |
| `InvalidParameter.TaskTypeConstraint` or `InvalidParameter.TaskTypeMismatch` | Terminal, with the reason on a second line: pin `params.omni_reference_task_type`, or reword the prompt. |
| Other HTTP 4xx | Terminal: `[ai] ark <Action or path> failed (<status> <code>): <message>.` |
| Asset API `Throttling*`, `RequestLimitExceeded*`, `FlowLimitExceeded*`, `TooManyRequests*` | Retryable 429. |
| Asset API `QuotaExceeded`, `AccessDenied*`, `InvalidAuthorization*` | Terminal, with a hint to check the entitlement and the authorization letter. |
| A key not set, unknown model or param, bad seconds, resolution, ratio or ref count, bad `url` or image | Plain two-line error before any call. Terminal after one attempt, nothing billed. |
| A draft or final that breaks a rule above | Plain two-line error before any call. |
| Seedream: unknown model, too many refs, bad `params.images`, unknown param or aspect, size under the minimum | Plain two-line error before any call. |
| Task `expired` or `cancelled` | Terminal 410. |
| Asset `Failed` at poll | Flagged: `[ai] ark refused asset "<name>": <FailedReason>.` Items that `$ref` it stay queued. |

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): the three `register` calls.

It reads and writes `draft`
provider records through `ctx.journal`; before `app.start()` the journal is closed, a draft is
still returned with one `ark:journal:closed` warning, and a final fails.

:::gotchas
- **The video URL expires.** `content.video_url` is downloaded at once; it expires 24 h after success.
- **Video and audio refs are URLs.** Ark takes base64 for images only. Host clips and audio yourself and pass `params.refUrls`.
- **`seconds: -1` is for an edit only.** It passes with `omni_reference_task_type: edit` and is estimated at the model's longest clip.
- **cn prices are summaries.** The cn rows are not list prices. Check the console before a paid run.
- **Same key, two regions, two accounts.** The fingerprint includes the region. An asset registered on `intl` is unknown on `cn`.
:::

## Related

- [Faces in video](/docs/ai/guides/faces/): Seedream first, draft to final, asset registration.
- [asset plugin](/docs/ai/plugins/asset/): the `AssetRecord` that video items `$ref`.
- [apimodels plugin](/docs/ai/plugins/apimodels/): Seedance official through a reseller, with its own asset route.
- [fal plugin](/docs/ai/plugins/fal/): the default video provider, no faces.
