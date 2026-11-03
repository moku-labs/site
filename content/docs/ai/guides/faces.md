---
title: Faces in video
description: "Seedream first for a trusted face, a cheap 2.5 draft that becomes the 1080p final, or a registered portrait for a real person."
section: Guides
order: 51
---

## The problem

Seedance on Ark refuses a real face in an image from outside, for example a Codex keyframe. The
item is `flagged`, the task is not billed, and there is no fallback to the raw photo. Two routes
work, both on provider [ark](/docs/ai/plugins/ark/).

| Route | When | What Ark trusts |
|---|---|---|
| Seedream first | an invented character | a face that Seedream 5.0 lite made on the same account, bytes unchanged, used within 30 days |
| Asset | a real person | a portrait registered in your own Ark account, sent as `asset://<id>` |

Both need `ARK_API_KEY`. The asset route also needs `ARK_ACCESS_KEY` and `ARK_SECRET_KEY`, the
Seedance Advanced Creation Rights entitlement and the AIGC authorization letter. The
[ark setup](/docs/ai/plugins/ark/#setup) lists them.

## Seedream first, draft to final

:::flow
- image (ark)
- $ref
- draft 480p
- $ref
- final 1080p
:::

:::steps
1. **Make the keyframe with ark.** An `image` item on provider ark. The handler never decodes or re-encodes the result, so the bytes stay trusted.
2. **Draft the shot.** A `video` item on `dreamina-seedance-2-5-260628` with `params.draft: true`. The draft is 480p and cheap. `$ref` the keyframe as `image`.
3. **Finalize.** A second `video` item with `fromDraft: { $ref: <draft> }` and the same model. It renders the draft again at 1080p: same motion, face, seed and audio. No prompt is read.
4. **Run.** Estimate first, then run under a ceiling.
:::

```yaml file="akari.moku.yaml"
version: 1
name: akari
items:
  - id: key-01
    task: image
    provider: ark
    input: { prompt: "Vertical 9:16 photo. Close-up, Akari lifts a cake box lid", aspect: "9:16" }
  - id: draft-01
    task: video
    provider: ark
    input: { model: dreamina-seedance-2-5-260628, prompt: "Akari lifts the lid, smiles",
             image: { $ref: key-01 }, seconds: 5 }
    params: { draft: true }
  - id: final-01
    task: video
    provider: ark
    input: { model: dreamina-seedance-2-5-260628, fromDraft: { $ref: draft-01 } }
```

```sh terminal title="run"
$ bunx moku estimate akari.moku.yaml
$ bunx moku run akari.moku.yaml --max-cost 10
```

The run makes the image, the draft, then the final: `out/akari/key-01.jpg`,
`out/akari/draft-01.mp4` and `out/akari/final-01.mp4`.

| Step | Resolution | Price on `dreamina-seedance-2-5-260628` | 5 s |
|---|---|---|---|
| keyframe | 1440×2560 | $0.035 per image | $0.035 |
| draft | 480p | $10.7 per 1M tokens, 50,638 tokens | $0.54 |
| final | 1080p | $11.7 per 1M tokens, 341,880 tokens | $4.00 |

Review the draft before you pay for the final. Remove `final-01` from the file, run, watch
`draft-01.mp4`, then add the final back. The draft is done, so the next run renders only the final.

**A draft can be finalized for 7 days.** After that the draft id is dead. Bump `params.generation`
on the draft item: the draft renders again, and so does the final.

```yaml file="akari.moku.yaml"
  - id: draft-01
    task: video
    provider: ark
    input: { model: dreamina-seedance-2-5-260628, prompt: "Akari lifts the lid, smiles",
             image: { $ref: key-01 }, seconds: 5 }
    params: { draft: true, generation: 2 } # [!note] `generation` is never sent. It only changes the item key.
```

From code, the final takes the draft clip and its sha256. The draft record lives in the journal,
so `app.start()` first:

```ts file="final.ts" check
import { app } from "./app";

await app.start();

const draftSha256 = "a".repeat(64); // [!note] The store hash of `draft-01.mp4`.
const record = app.ark.draftRecord(draftSha256);
if (record === undefined) throw new Error("No draft record: render the draft with provider ark first.");

const final = await app.video.generate(
  { model: record.model, prompt: "", fromDraft: { path: "out/akari/draft-01.mp4", mimeType: "video/mp4", hash: draftSha256 } },
  { provider: "ark" }
);
console.log(final.costUsd, final.meta);

await app.stop();
```

## A real person: register the portrait

An `asset` item registers the portrait once, in your own Ark account. The video items `$ref` it
and Ark gets `asset://<id>`. The asset is an artifact like any other: registered once, reused by
every later run.

:::steps
1. **Host the portrait.** Ark fetches it from a public https URL and never uploads it. `url` must hold the same bytes as `image`. `app.fal.upload` gives such a URL when you have a fal key.
2. **Register it.** An `asset` item on provider ark. The image must be PNG, JPEG or WebP, under 30 MB, 300 to 6000 px per side, with a width to height ratio of 0.4 to 2.5.
3. **Use it.** `$ref` the asset in `refs` of the video item. The prompt cites it by position: "image 1".
:::

```yaml file="mira.moku.yaml"
version: 1
name: mira
items:
  - id: face-mira
    task: asset
    provider: ark
    input: { image: { $file: faces/mira.png }, url: "https://cdn.example/faces/mira.png" }
  - id: clip-01
    task: video
    provider: ark
    input: { model: dreamina-seedance-2-5-260628, prompt: "image 1 walks into the rain",
             refs: [{ $ref: face-mira }], seconds: 10 }
```

Before the clip's POST, ark checks the asset: registered by ark, in this account, `Active`. A
refused portrait flags the asset item and the clips that use it are never dispatched. The
estimate of an asset item is $0: the fee is part of the entitlement.

The same registration from code, with the URL from fal storage:

```ts file="register.ts" check
import { app } from "./app";

const image = { path: "faces/mira.png", mimeType: "image/png", hash: "a".repeat(64) };
const { url } = await app.fal.upload(image); // [!note] Needs `FAL_KEY`. Any public https URL of the same bytes works instead.
const record = await app.asset.register({ image, url, groupName: "series-01" }, { provider: "ark" });
console.log(record.assetId, record.groupId);

const assets = await app.ark.listAssets({ groupId: record.groupId });
console.log(assets.map(asset => `${asset.name}: ${asset.status}`));
```

## Which route when

| Case | Route |
|---|---|
| A character you invented | Seedream first. No entitlement, no letter, no asset group. |
| A real person | Asset. The portrait is reviewed by Ark once. |
| A keyframe from Codex or fal with a face | Neither works as is. Remake it with ark, or register the person. |
| fal only, no Ark account | [apimodels](/docs/ai/plugins/apimodels/): the same Seedance aliases as fal, and real faces are accepted. |

:::gotchas
- **Bytes unchanged.** Any crop, resize or re-encode of a Seedream image breaks the trust. Pass the artifact through `$ref`, never a copy from an editor.
- **The 30-day window.** A Seedream face is trusted for 30 days after it was made. A draft id lives 7 days.
- **Finals need the journal.** `fromDraft` finds the draft record in the journal. Before `app.start()` a final fails before any call.
- **Keys changed, assets gone.** An asset id belongs to one account and region. After a key change, bump `params.generation` on the asset items to register again.
- **No raw-photo fallback.** A refused face is never retried with the photo and never registered by itself. Pick a route before the run.
:::

## Related

- [ark plugin](/docs/ai/plugins/ark/): regions, models, the draft rules, the asset library.
- [asset plugin](/docs/ai/plugins/asset/): the `AssetRecord` that video items `$ref`.
- [Video shots](/docs/ai/guides/video-shots/): the keyframe, clip and score build.
- [apimodels plugin](/docs/ai/plugins/apimodels/): faces without an Ark account.
