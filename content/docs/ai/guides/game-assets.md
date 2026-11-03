---
title: Game assets
description: "Sound effects, sprites and nine-slice UI from one build file, exported straight into the game."
section: Guides
order: 53
---

## What you get

One build file makes the audio and the art of a game. Re-cutting a sprite never pays for the image
again, because the image is a separate item with its own key.

## The build file

```yaml file="ui.moku.yaml"
version: 1
name: ui
items:
  - id: coin-pickup
    task: sfx
    provider: elevenlabs
    input: { model: eleven_text_to_sound_v2, prompt: "coin pickup, bright 8-bit chime", durationMs: 600 }
  - id: button-raw
    task: image
    provider: fal
    input: { model: nano-banana-pro, prompt: "wooden game UI button, flat colour background", aspect: "1:1" }
  - id: "button{nine=12,12,12,12}"
    task: sprite
    provider: fal
    input: { source: { $ref: button-raw }, model: birefnet, size: { width: 128, height: 64 }, padding: 2 }
  - id: menu-loop
    task: music
    provider: fal
    input: { model: elevenlabs-music-v2.5, prompt: "calm looping menu theme", lengthMs: 30000 }
```

:::gotchas
- `sfx` and `music` need `model`. The artifact key hashes the input as written, so there is no provider default.
- Name the `provider` on `music` items. A `music` item with no provider goes to the first registered one, `elevenlabs`, whose model ids differ from fal's.
- A sprite takes two items. The `image` makes the picture, and the `sprite` cuts it by `$ref`.
- The `{nine=l,t,r,b}` hint stays in the file name. The game engine reads it there.
:::

## Run it into the game

:::steps
1. **Estimate.** No key needed.

   ```sh terminal title="estimate"
   $ moku estimate ui.moku.yaml
   ```

2. **Run with a ceiling.** This item set needs `ELEVENLABS_API_KEY` and `FAL_KEY`.

   ```sh terminal title="run"
   $ moku run ui.moku.yaml --max-cost 2 --out assets/ui --flat
   ```

3. **Find the files.** `--flat` drops the build folder: `assets/ui/coin-pickup.mp3`, `assets/ui/button{nine=12,12,12,12}.png`, the raw image and the music track.

4. **Tune and run again.** Change `padding` or `size`. Only the sprite is cut again.
:::

## Next

- [sfx](/docs/ai/plugins/sfx/), [sprite](/docs/ai/plugins/sprite/), [image](/docs/ai/plugins/image/), [music](/docs/ai/plugins/music/): every option.
- [fal](/docs/ai/plugins/fal/): the models and prices.
