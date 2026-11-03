---
title: Video shots
description: "A keyframe, a clip from it with $ref, and a score: one build file, one run, three files on disk."
section: Guides
order: 50
---

## How it fits together

A shot is three items that reference each other. The runner runs references first and hands the
handler the finished file.

:::flow
- image item
- $ref
- video item
- out/ep01/s01.h3.mp4
:::

| Item | Task | Provider | Output |
|---|---|---|---|
| `s01.key` | [image](/docs/ai/plugins/image/) | `codex` | the keyframe, `out/ep01/s01.key.png` |
| `s01.h3` | [video](/docs/ai/plugins/video/) | `fal` | the clip, `out/ep01/s01.h3.mp4` |
| `s01.score` | [music](/docs/ai/plugins/music/) | `fal` | the music, `out/ep01/s01.score.mp3` |

Items reference each other with `$ref` (another item's artifact, by `id`) and local files with
`$file` (relative to the build file). Every item has an artifact key, so a second run re-bills
nothing that is done. Change the keyframe prompt and only the keyframe and the clip render again.

## The build file

```yaml file="ep01.moku.yaml"
version: 1
name: ep01
items:
  - id: s01.key
    task: image
    provider: codex
    input: { prompt: "patisserie counter at night, warm lamps", aspect: "9:16",
             refs: [{ $file: refs/akari.png }] }
  - id: s01.h3
    task: video
    provider: fal
    input: { model: minimax-h3, prompt: "slow push-in", image: { $ref: s01.key }, seconds: 5 }
  - id: s01.score
    task: music
    provider: fal
    input: { model: elevenlabs-music-v2.5, prompt: "tense synth pulse", lengthMs: 30000 }
```

- `refs` on the image item is a local sketch the keyframe follows. `$file` paths resolve against the build file.
- `image` on the video item is the first frame. The runner renders `s01.key` first, then passes `{ path, mimeType, hash }` to fal.
- `model` on the music item is required. The runner hashes the input as written, so there is no provider default.

## Run it

:::steps
1. **Estimate.** No key, no network. A model with no price fails here instead of counting as $0.

   ```sh terminal title="estimate"
   $ bunx moku estimate ep01.moku.yaml
   ```

2. **Add the keys.** `s01.key` runs on the local Codex CLI, plan-billed. The two fal items need `FAL_KEY`. Export it or put it in `.env.local`.
3. **Run under a ceiling.** The keyframe renders, then the clip, then the score. Ctrl-C is a clean pause; `moku run` again resumes, and the video job is polled, not paid twice.

   ```sh terminal title="run"
   $ bunx moku run ep01.moku.yaml --max-cost 10
   ```

4. **Find the files.** `out/ep01/s01.key.png`, `out/ep01/s01.h3.mp4` and `out/ep01/s01.score.mp3`.
:::

## Pick a video model

`app.fal.models("video")` lists the aliases with the price at the default resolution, audio off.
The full table with resolutions and reference limits is on the [fal page](/docs/ai/plugins/fal/).

| Alias | First frame | End frame | Refs | Default price USD/s |
|---|---|---|---|---|
| `minimax-h3` | yes | yes | none | 0.06 |
| `kling-3-pro` | yes | yes | none | 0.112 |
| `seedance-2.5` | yes | yes | none | 0.473 |
| `seedance-2.5-ref` | yes | no | 29 images, 10 audio, 10 video | 0.473 |
| `minimax-h3-max-ref` | yes | no | 8 images, 3 audio, 3 video | 0.08 |
| `veo-3.1-fast` | yes | no | none | 0.10 |

Two fields change a shot without a new model:

```yaml file="ep01.moku.yaml"
  - id: s02.clip
    task: video
    provider: fal
    input:
      model: minimax-h3-max-i2v
      prompt: "she opens the door"
      image: { $ref: s02.start }
      endImage: { $ref: s02.end } # [!note] The clip ends on this image. Only models with an end frame take it.
  - id: s03.clip
    task: video
    provider: fal
    input:
      model: minimax-h3-max-ref
      prompt: "Image 1 walks to the window, to the beat of the music"
      image: { $ref: s03.key }
      refs: [{ $ref: s01.score }, { $ref: s02.clip }] # [!note] An `audio/*` ref is an audio ref, a `video/*` ref a video ref, the rest are images. Too many of one kind fail before any upload.
      seconds: 8
```

## The same shot from code

The one-off facades are direct and not journaled: for scripts and experiments. `app.music.generate`
waits in process; `app.video.generate` submits and polls.

```ts file="teaser.ts" check
import { writeFile } from "node:fs/promises";
import { app } from "./app";

console.log(app.fal.models("music")); // [{ id: "elevenlabs-music-v2.5", price: { usd: 0.8, per: "minute" } }, ...]

const { usd } = app.video.estimate({ model: "minimax-h3", prompt: "push-in", seconds: 5 }, { provider: "fal" });
console.log(usd); // 0.3

const track = await app.music.generate({
  prompt: "tense synth pulse",
  model: "elevenlabs-music-v2.5",
  lengthMs: 60_000
});
await writeFile("teaser.mp3", track.audio); // [!note] 60 s at 0.80 per started minute: `track.costUsd` is 0.8.
```

A video from code takes a resolved file, the shape the runner hands a handler:

```ts file="clip.ts" check
import { writeFile } from "node:fs/promises";
import { app } from "./app";

const key = { path: "out/ep01/s01.key.png", mimeType: "image/png", hash: "a".repeat(64) }; // [!note] `hash` is the sha256 of the bytes. fal caches the upload by it.
const clip = await app.video.generate(
  { model: "minimax-h3", prompt: "slow push-in", image: key, seconds: 5 },
  { provider: "fal" }
);
await writeFile("s01.mp4", clip.video);
console.log(clip.costUsd, clip.meta); // [!note] `meta` is `{ endpoint, requestId, seconds }`.
```

:::gotchas
- **A real face.** fal's Seedance endpoints refuse a real person. For faces use [ark](/docs/ai/plugins/ark/) or [apimodels](/docs/ai/plugins/apimodels/): see [Faces in video](/docs/ai/guides/faces/).
- **The job survives a crash.** The runner journals fal's request id before it waits. A pause or a kill resumes by polling the same job.
- **`music` needs `model`.** There is no default, and ElevenLabs Music on fal bills per started minute: 61 s is two minutes.
- **A resolution needs a price.** `seedance-2.5@1080p` is not bundled. Add it to `fal.priceOverrides` or the estimate fails.
:::

## Related

- [fal plugin](/docs/ai/plugins/fal/): every model, price and limit.
- [video plugin](/docs/ai/plugins/video/): the request shape and `submit` + `poll`.
- [buildfile](/docs/ai/plugins/buildfile/): `$ref`, `$file`, `defaults` and `itemsFrom`.
- [Faces in video](/docs/ai/guides/faces/): when the shot has a real person in it.
