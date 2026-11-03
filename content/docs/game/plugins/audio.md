---
title: audio
description: "Opt-in. Music and sound effects on three buses; volumes read from the committed player; sound as an effect a node awaits."
section: Plugins
kind: optional
order: 35
---

## What it does

`audio` plays music and sound effects on three buses: `master`, `music` and `sfx`. It handles the
effect kinds `sfx`, `stopSfx` and `music`, plays the scene's `music`, and reads the volumes from
the committed player.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| opt-in, `plugins: [...screen, audioPlugin]` | Standard | `lifecycle`, `model`, `flow`, `assets`, `scenes` | nothing |

`game.screen()` of `defineGameApp` composes it for the game. An app made with `createApp` adds it
itself. Without `audio` every `sfx` and `music` effect resolves `undefined` at once, so the same
node runs in a game with no sound.

| Effect | What it does |
|---|---|
| `sfx(key, { bus?, id?, fadeMs? })` | Resolves when the sound started. With an `id` it plays through its own gain, and the next sound with that id fades it out. |
| `stopSfx(id, { fadeMs? })` | Fades out and ends a named sound. `fadeMs: 0` cuts it. |
| `music(key \| null, { fadeMs? })` | Cross-fades to a track. `null` fades out. |

**Volumes.** The player chooses volumes in the game, and a settings node commits them to
`player`. Config `volumes` reads them from the committed player and applies them on every
`model:committed`. The `volumes` of `defineGame` types the reader by the game's player.

**Unlock.** The context is asked to run at start. Where the shell lets audio play with no gesture,
`unlocked()` is true at once. A browser that wants a gesture unlocks on the first `pointerdown` or
`touchend`.

## Config

`pluginConfigs.audio`.

| Option | Type | Default | Description |
|---|---|---|---|
| `buses` | `{ master; music; sfx }` | `{ master: 1, music: 0.6, sfx: 1 }` | Start gain of each bus, 0..1. |
| `musicFadeMs` | `number` | `600` | Cross-fade of a music switch, in real milliseconds. |
| `sfxFadeMs` | `number` | `120` | Fade of a named sound when nothing names `fadeMs`. |
| `volumes` | `(player) => volumes \| undefined` | `undefined` | Reads the player's choice from the committed player. Absent: the buses stay at `buses`. |
| `context` | `() => AudioContextLike` | `undefined` | The context factory, a test seam. Absent: `new AudioContext()` where it exists. |
| `journal` | `number` | `0` | How many started sounds `journal()` keeps. `0` turns it off. |
| `music` | `"decode" \| "stream"` | `"decode"` | `"decode"`: a gapless buffer. `"stream"`: an `<audio>` element, less memory, a gap at every loop. MP3 or AAC only. |
| `session` | `"ambient" \| "playback" \| "auto"` | `"ambient"` | What the page asks iOS for. `"ambient"` mixes with other apps and obeys the silent switch. |

In a game made with `defineGameApp`, `context` belongs to the shell.

## API

Mounted at `app.audio`, reachable with `ctx.require(audioPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `setVolume` | `(bus: "master" \| "music" \| "sfx", value: number) => void` | Sets a bus at once. Not persisted: the next commit applies `volumes` again. |
| `volume` | `(bus) => number` | The stored volume, never the live gain. |
| `mute`, `muted` | `(bus, on: boolean) => void`, `(bus) => boolean` | A mute flag per bus, independent of the pause. |
| `unlocked` | `() => boolean` | Whether the audio context runs. |
| `journal` | `() => readonly SoundEntry[]` | The last started sounds, oldest first. Empty while `journal` is 0. |
| `stop` | `(id: string, options?: { fadeMs?: number }) => void` | The same stop as the `stopSfx` effect. Headless it does nothing. |

## Events

### Emits

None.

### Listens to

`model:committed` (volumes), `scenes:changed` (the scene's music), `lifecycle:changed` (the pause)
and `assets:replaced` (a swapped sound).

## Example

```ts file="sound.ts" check
import { audioPlugin, createApp, defineGame, music, screen, sfx, stopSfx, type } from "@moku-labs/game";

type Player = { settings: { audio: { master?: number; music?: number; sfx?: number } } };

const { defineNode, volumes } = defineGame<{
  player: Player;
  session: { rolls: number };
  assets: string;
  strings: Record<string, unknown>;
}>();

// Sound is an effect a node awaits, or starts and goes on.
export const win = defineNode({
  outcomes: { done: type() },
  run: async ({ fx, out }) => {
    await fx(music("board.theme"));
    fx.start(sfx("board.fanfare", { id: "fanfare" }));
    fx.start(stopSfx("fanfare", { fadeMs: 300 }));
    return out.done();
  }
});

const app = createApp({
  plugins: [...screen, audioPlugin],
  pluginConfigs: {
    model: { initialPlayer: { settings: { audio: { music: 0.5 } } } },
    audio: { volumes: volumes(player => player.settings.audio), journal: 20 }
  }
});
app.audio.mute("music", true);
app.audio.volume("music");
```

:::gotchas
- **A failed cosmetic effect never fails the node.** `sfx`, `music`, `play` and `haptic` that fail are a warning, and resolve `undefined`.
- **Store the choice in `player`.** `setVolume` is overwritten by the next commit when `volumes` is set.
- **`"stream"` needs MP3 or AAC.** WebM Opus is silent through a media element in WebKit.
:::

## Related

- [scenes](/docs/game/plugins/scenes/): music per scene.
- [assets](/docs/game/plugins/assets/): sounds are asset keys, `.mp3` or `.m4a`.
- [anim](/docs/game/plugins/anim/): `sfx` as a timeline step.
