---
title: asset
description: "Task plugin for provider assets. Registers a portrait with a provider once and returns an opaque AssetRecord, with the one-off facade app.asset.*."
section: Tasks
order: 28
---

## What it does

Some video providers refuse a plain photo of a real face. They take the same face when it is
registered first, as an asset in the provider's own account, and the video request names the
asset id instead of sending the image. `asset` is the task plugin for that registration step.

It owns the contract every asset provider implements: `AssetRequest`, `AssetRecord`,
`AssetResult`, `AssetJobPoll` and `AssetHandler`. It exposes a small typed facade, `app.asset.*`.

Providers that serve this task today:

| Provider | Plugin | Notes |
|---|---|---|
| `ark` | [ark](/docs/ai/plugins/ark/) | Needs the public https `url`. Estimate is 0. |

## How it works

Registration is its own step. An `asset` item runs before any video item that uses it. It is not
a retry after a refusal: no provider registers a face on the fly, and no provider falls back to
sending the raw photo.

| The runner | How |
|---|---|
| Orders it | A video item `$ref`s the asset item, so the asset runs first. |
| Caches it | The done asset is an artifact like any other. A second run, or a second clip with the same face, reuses it at no cost. |
| Journals it | Registration is async upstream: `submit`, then `poll` until the asset is active. The job id is journaled, so a crash resumes by polling, never by registering twice. |
| Blocks early | A refused portrait flags the asset item. Every item that `$ref`s it is never dispatched. Nothing is paid for a clip that would be refused. |

The stored record has the MIME type `ASSET_MIME`, `application/vnd.moku.asset+json`. When the
runner resolves a `$ref` to a done asset item, the video handler gets a file with this MIME type.
That is how a video provider tells an asset from an image. A `.json` `$file` stays
`application/json`: it never becomes an asset. On export the record is written as `<label>.json`.

There is no `execute`. Every provider implements `submit` + `poll`. A refused registration is a
`failed` poll, or a throw, whose error carries `kind: "content-policy"`.

The plugin is stateless. No lifecycle hooks, no events.

## Config

`pluginConfigs.asset`.

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultProvider` | `string` | `"ark"` | Provider the facade uses when a call names none. |
| `pollIntervalMs` | `number` | `3000` | Delay between polls in the facade's submit/poll loop, ms. Ark's guidance is to poll every 3 s. |

```ts check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: { asset: { defaultProvider: "ark", pollIntervalMs: 3000 } }
});
```

:::callout{tone="warn"}
The runner does not read this config. In a build file the provider comes from the item, else the
build file's `defaults.provider`, else the task's first registered provider. The runner polls
every `runner.pollIntervalMs`.
:::

## API

Mounted at `app.asset`, reachable with `ctx.require(assetPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `register` | `(request: AssetRequest, opts?: { provider?: string; signal?: AbortSignal }) => Promise<AssetRecord>` | One-off registration. Calls `submit` once, then `poll` every `config.pollIntervalMs`. Direct: not journaled and not cached. |
| `estimate` | `(request: AssetRequest, opts?: { provider?: string }) => { usd: number }` | Cost estimate from the provider handler. Ark returns `0`. |
| `providers` | `() => string[]` | Registered asset providers, in registration order. |

`register` parses a `done` poll's `body` with `parseAssetRecord` and returns the record. A
`failed` poll throws its `error` unchanged. An abort during the wait rejects at once with the
signal's reason.

| Condition | Error |
|---|---|
| Unknown provider, or a registered value that fails the shape check | `[ai] No asset provider named "<name>" is registered.` then `Available: <comma list or "none">.` |
| Stored bytes are not a record | `[ai] Not an asset record: <reason>.` then `Expected JSON with assetId, provider, account, groupId, registeredAt.` |
| Provider refused the portrait | The provider's flagged error, `kind: "content-policy"`. In a run the item is `flagged`. |

### `AssetRequest`

| Field | Type | Required | Description |
|---|---|---|---|
| `image` | `AssetFile` | yes | The portrait file. Its sha256 `hash` is part of the artifact key, so the same bytes register once. |
| `url` | `string` | no | Public https URL of the same bytes, for providers whose register API only fetches URLs. Ark needs it and fails before any call without it. |
| `group` | `"aigc"` | no | Group kind. Default `"aigc"`, the only kind today. |
| `name` | `string` | no | Display name sent to the provider, at most 64 characters. Default: the file's base name. |
| `groupName` | `string` | no | Asset group name, 1 to 64 characters. Default: the provider's configured group name. |
| `params` | `Record<string, unknown>` | no | Provider params. `generation` (a number) is the re-register knob. |

`AssetFile` is `{ path: string; mimeType: string; hash: string }`, the shape of the runner's
resolved file.

### `AssetRecord`

| Field | Type | Description |
|---|---|---|
| `assetId` | `string` | Provider asset id. Ark sends it as `asset://<assetId>`. |
| `provider` | `string` | Provider that registered it, e.g. `"ark"`. |
| `account` | `string` | Provider-computed, one-way account fingerprint. The id is valid only in this account. |
| `groupId` | `string` | Provider group the asset lives in. |
| `registeredAt` | `number` | Epoch ms when the provider reported the asset active. |

### Package exports

| Export | Description |
|---|---|
| `ASSET_MIME` | `"application/vnd.moku.asset+json"`. |
| `encodeAssetRecord(record)` | UTF-8 JSON with a stable key order. Drops extra keys. |
| `parseAssetRecord(bytes)` | Reads it back and checks every field. Throws `[ai] Not an asset record: <reason>.` |

## Example

The durable path is a build file. Register the portrait in an `asset` item, then `$ref` it from
the video items:

```yaml file="mira.moku.yaml"
version: 1
name: mira
items:
  - id: face-mira
    task: asset
    provider: ark
    input:
      image: { $file: faces/mira.png }
      url: "https://cdn.example/faces/mira.png"
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

- `face-mira` runs first. Its artifact is the `AssetRecord` JSON.
- `clip-01` gets a ref with `mimeType === ASSET_MIME`. The video provider reads the record and sends the asset id, not the photo.
- A second run reuses both items at no cost. So does another build file with the same face and URL.
- If the provider refuses the portrait, `face-mira` is `flagged` and `clip-01` stays queued. The runner logs `runner:blocked`.
- A video provider that cannot use assets refuses the ref before any upload. `fal` does this.

### Register again

The artifact key covers the image hash, `url`, `name`, `group`, `groupName` and `params`.
Unchanged input means the stored record is reused, even when the provider has since deleted the
asset. To register the same portrait again, bump `params.generation`. `params` sits next to
`input` in a build item:

```yaml file="mira.moku.yaml"
  - id: face-mira
    task: asset
    provider: ark
    input:
      image: { $file: faces/mira.png }
      url: "https://cdn.example/faces/mira.png"
    params: { generation: 2 }
```

The new key misses the cache, so the item registers again. Every video item that `$ref`s it gets
a new key too, so those clips render again with the new asset.

The facade is the direct path. Nothing is journaled and nothing is cached:

```ts file="register.ts" check
import { app } from "./app";

await app.start();

const image = { path: "faces/mira.png", mimeType: "image/png", hash: "a".repeat(64) };

console.log(app.asset.estimate({ image })); // { usd: 0 }

const record = await app.asset.register({ image, url: "https://cdn.example/faces/mira.png" }, { provider: "ark" });
console.log(record.assetId, record.account, record.registeredAt);

console.log(app.asset.providers()); // ["ark"]
await app.stop();
```

A custom provider registers an `AssetHandler` under `"asset"`:

```ts file="acme-assets.ts" check
import { ASSET_MIME, createPlugin, encodeAssetRecord, registryPlugin } from "@moku-labs/ai";
import type { Asset } from "@moku-labs/ai";

declare function acmeUpload(path: string): Promise<string>;
declare function acmeStatus(jobId: string): Promise<{ ready: boolean; id: string }>;
declare function acmeAccount(): string;

const handler: Asset.AssetHandler = {
  estimate: () => ({ usd: 0 }),
  submit: async request => ({ jobId: await acmeUpload(request.image.path) }),
  poll: async jobId => {
    const asset = await acmeStatus(jobId);
    if (!asset.ready) return { state: "pending" };
    const record = { assetId: asset.id, provider: "acme", account: acmeAccount(), groupId: "default", registeredAt: Date.now() };
    return { state: "done", body: encodeAssetRecord(record), mimeType: ASSET_MIME, costUsd: 0 };
  }
};

export const acmeAssetsPlugin = createPlugin("acmeAssets", {
  depends: [registryPlugin],
  onInit: ctx => {
    ctx.require(registryPlugin).register("asset", "acme", handler);
  }
});
```

:::gotchas
- **`register` is not journaled and not cached.** Each call registers again. Prefer an `asset` item in a build file.
- **Ark needs `url`.** Its register API fetches URLs only. Without `url` the handler fails before any call.
- **The record is account-bound.** `account` is a fingerprint of the provider account. The asset id is valid there only.
- **`params.generation` is the only way to re-register.** An unchanged input reuses the stored record even when the provider no longer has the asset.
:::

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): `resolve("asset", provider)` and `providers("asset")`.

## Related

- [video](/docs/ai/plugins/video/): the task that uses the asset through `refs`.
- [runner](/docs/ai/plugins/runner/): the durable path. It stores the done `body` under `ASSET_MIME`.
- [ark](/docs/ai/plugins/ark/): the provider.
