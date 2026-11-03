---
title: elevenlabs
description: "Provider. Voiceover, sound effects and music over the ElevenLabs HTTP API, with a bundled price table."
section: Providers
order: 32
---

## What it does

**Provider.** `elevenlabs` owns everything ElevenLabs-specific. It registers three handlers with
`registry` in `onInit`: `("voiceover", "elevenlabs")`, `("sfx", "elevenlabs")` and
`("music", "elevenlabs")`. It talks to the API with a thin `fetch` client, no SDK. Each handler
has `estimate` and `execute`. The runner and the task facades reach them through the registry.
You never call a handler directly.

Its own public API is one method, `app.elevenlabs.info()`.

## Setup

One env var. Exported in the shell or in `.env.local`.

| Variable | Needed by | Sent as |
|---|---|---|
| `ELEVENLABS_API_KEY` | `execute` only | the `xi-api-key` header |

`info()` and every `estimate()` work without the key. When the variable is unset, `execute` throws
before any network call:

```
[ai] ELEVENLABS_API_KEY is not set.
  Export it or set config.apiKeyEnv to the variable that holds your key.
```

The key is read through `ctx.env` at request time. It is never stored and never logged.

## Tasks it serves

| Task | Endpoint | Default provider of the task |
|---|---|---|
| [voiceover](/docs/ai/plugins/voiceover/) | `POST /v1/text-to-speech/{voiceId}` | yes: elevenlabs registers first |
| [sfx](/docs/ai/plugins/sfx/) | `POST /v1/sound-generation` | yes |
| [music](/docs/ai/plugins/music/) | `POST /v1/music` | no: the default is `fal`, name `provider: elevenlabs` |

### voiceover

`text`, `voice` (an ElevenLabs voice id), optional `language`, `model`, `format` and `params`.
`format` is `mp3` (default), `wav` or `ogg`. `params` is spread into the JSON body last, so its
keys win.

```yaml file="hello.moku.yaml"
  - id: greeting
    task: voiceover
    provider: elevenlabs
    input:
      text: "Hello, world!"
      voice: "21m00Tcm4TlvDq8ikWAM"
      format: mp3
```

### sfx

The output is always mp3. Every rule is checked before any HTTP call. A refused request is a
terminal 400: the runner marks the item `failed` and never retries it.

| Field | Rule |
|---|---|
| `model` | Must be `"eleven_text_to_sound_v2"`. |
| `prompt` | At most 450 characters. |
| `durationMs` | Optional. 500 to 30000. Omitted: the model picks the length. |
| `promptInfluence` | Optional. 0 to 1. |
| `loop` | Optional boolean. |
| `params.output_format` | Optional. Must start with `mp3_`. Default `"mp3_44100_128"`. The only `params` key the handler reads. |

```yaml file="hello.moku.yaml"
  - id: sword-hit
    task: sfx
    input:
      prompt: "sword hit, metallic"
      model: eleven_text_to_sound_v2
      durationMs: 800
```

### music

Paid ElevenLabs plans only. On a free plan the call fails with a 4xx. The endpoint answers when
the whole track is ready, so it has its own timeout, `musicTimeoutMs`.

| Field | Rule |
|---|---|
| `model` | `"music_v1"`, `"music_v2"` or `"music_v2_5"`. The fal alias `"elevenlabs-music-v2.5"` is refused. |
| `lengthMs` | Whole number, 3000 to 600000. |
| `prompt` | Sent when there are no `chunks`. Must not be empty. |
| `chunks` | A composition plan. `music_v2` and `music_v2_5` only. The chunk durations must add up to `lengthMs`. |
| `chunks[].durationMs` | Whole number, 3000 to 120000. |
| `chunks[].text` | At most 30 lines of at most 200 characters. |
| `seed` | Only with `chunks`. |
| `params.force_instrumental` | Optional boolean, only with a prompt. Default `true`. |
| `params.output_format` | Optional. Must start with `mp3_`. |
| any other `params` key | Refused. |

```yaml file="hello.moku.yaml"
  - id: s01.score
    task: music
    provider: elevenlabs
    input: { model: music_v2_5, prompt: "tense synth pulse", lengthMs: 30000 }
  - id: s01.theme
    task: music
    provider: elevenlabs
    input:
      model: music_v2_5
      prompt: "main theme"
      lengthMs: 43000
      seed: 7
      chunks:
        - { text: "[Intro]", durationMs: 13000, styles: [synthwave, dark, slow build] }
        - { text: "[Drop]", durationMs: 30000, styles: [driving bass], avoid: [vocals] }
```

## Models and prices

The plugin ships a price table. `priceOverrides` merges over it, and an override wins. The
effective table is computed once at first use and cached. The bundled numbers are estimates:
set your plan's real price.

Voice models, USD per character:

| Model | USD / character |
|---|---|
| `eleven_multilingual_v2` | 0.0003 |
| `eleven_turbo_v2_5` | 0.00015 |
| `eleven_flash_v2_5` | 0.00006 |
| `eleven_monolingual_v1` | 0.0003 |

A voice model missing from the table estimates at `$0`.

Sound effects, keyed `sfx:<model>#second` and `sfx:<model>#auto`:

| Key | USD |
|---|---|
| `sfx:eleven_text_to_sound_v2#second` | 0.002 per started second |
| `sfx:eleven_text_to_sound_v2#auto` | 0.01 per generation, when the request has no `durationMs` |

Music, keyed `music:<model>`, per started minute:

| Key | USD |
|---|---|
| `music:music_v1` | 0.15 |
| `music:music_v2` | 0.15 |
| `music:music_v2_5` | 0.15 |

A missing sfx or music price is a terminal error, not `$0`. A paid job never runs at an unknown
price:

```
[ai] No price for ElevenLabs sfx model "eleven_text_to_sound_v2".
  Add it to elevenlabs.priceOverrides.
```

Cost math: voiceover is `text.length × price`. sfx is `ceil(durationMs / 1000) × #second`, or
`#auto` without a duration. music is every started minute `× music:<model>`. `estimate` and
`execute` use the same formula, so `costUsd` equals the estimate.

```ts file="moku.config.ts" check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: {
    elevenlabs: {
      defaultModel: "eleven_turbo_v2_5",
      priceOverrides: {
        eleven_turbo_v2_5: 0.00012,
        "sfx:eleven_text_to_sound_v2#second": 0.0025 // [!note] The real per-second price of your plan.
      }
    }
  }
});

console.log(app.elevenlabs.info().models); // includes "eleven_turbo_v2_5"
```

## Config

`pluginConfigs.elevenlabs`.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKeyEnv` | `string` | `"ELEVENLABS_API_KEY"` | Name of the env var with the API key. Read through `ctx.env` at request time. |
| `baseUrl` | `string` | `"https://api.elevenlabs.io"` | API base URL. |
| `defaultModel` | `string` | `"eleven_multilingual_v2"` | Voice model when a request names none. |
| `timeoutMs` | `number` | `60_000` | Timeout of one voiceover or sfx request, ms. Merged with the caller's signal. |
| `musicTimeoutMs` | `number` | `600_000` | Timeout of one music request, ms. |
| `priceOverrides` | `Record<string, number>` | `{}` | Prices merged over the bundled table. Voice models by id, USD per character. `sfx:<model>#second`, `sfx:<model>#auto`, `music:<model>` as above. |

## API

Mounted at `app.elevenlabs`.

| Method | Signature | Description |
|---|---|---|
| `info` | `() => { provider: "elevenlabs"; configured: boolean; models: string[] }` | `configured` is whether the key env var is set, checked with `ctx.env.has`. `models` is the voice model ids of the effective price table, overrides included. `sfx:` and `music:` rows are left out. Never throws. |

```ts file="status.ts" check
import { app } from "./app";

const { configured, models } = app.elevenlabs.info();
if (!configured) throw new Error("Export ELEVENLABS_API_KEY first.");
console.log(models); // ["eleven_multilingual_v2", "eleven_turbo_v2_5", ...]
```

Types ship under the `Elevenlabs` namespace: `Elevenlabs.Config`, `Elevenlabs.ElevenlabsApi`.

## Errors

The client maps every failure to one of three classes. The runner reads them by shape
(`status`, `kind`, `retryAfterMs`), never by class.

| Failure | Class | Fields | Runner |
|---|---|---|---|
| HTTP 5xx | `RetryableProviderError` | `status` | `http-5xx`, retried |
| HTTP 429 | `RetryableProviderError` | `status: 429`, `retryAfterMs` from `Retry-After` | `http-429`, retried after the hint |
| Timeout | `RetryableProviderError` | `kind: "timeout"` | `timeout`, retried |
| Network failure | `RetryableProviderError` | `kind: "network"` | `network`, retried |
| Other HTTP 4xx, a broken request rule | `TerminalProviderError` | `status` | `http-4xx`, item `failed` |
| `detail.status` is `content_policy_violation`, `bad_prompt` or `bad_composition_plan` | `FlaggedProviderError` | `kind: "content-policy"` | `content-policy`, item `flagged`, never re-queued |

A content-policy `detail.status` in the body wins over the numeric status. An abort through
`opts.signal` is rethrown unchanged. Messages carry status codes and error classes only, never
request text or response bodies.

The classes are values under `ElevenlabsErrors`:

```ts file="handle.ts" check
import { ElevenlabsErrors } from "@moku-labs/ai";
import { app } from "./app";

try {
  await app.voiceover.generate({ text: "Hi", voice: "21m00Tcm4TlvDq8ikWAM" });
} catch (error) {
  if (error instanceof ElevenlabsErrors.RetryableProviderError) {
    console.warn("transient", error.status ?? error.kind, error.retryAfterMs);
  } else if (error instanceof ElevenlabsErrors.FlaggedProviderError) {
    console.error("content policy, do not re-queue");
  } else {
    throw error;
  }
}
```

:::gotchas
- **A music timeout is retried, and ElevenLabs may bill the first attempt.** Raise `musicTimeoutMs` for long tracks.
- **A refused music prompt is `flagged`.** `bad_prompt` comes back for artist names, band names and known lyrics. The API's suggested rewrite is not read into the error.
- **One key, no pool.** The runner schedules the work on the lane `"{task}/elevenlabs/default"`. Throttle it with [limits](/docs/ai/plugins/limits/).
:::

## Events

### Emits

None.

### Listens to

None. Diagnostics go through `ctx.log`: `elevenlabs:<task>:done` on success, and
`elevenlabs:<task>:failed` with the error class and status before a rethrow. No message text.

## Depends on

- [registry](/docs/ai/plugins/registry/): the three `register` calls.

## Related

- [voiceover](/docs/ai/plugins/voiceover/), [sfx](/docs/ai/plugins/sfx/), [music](/docs/ai/plugins/music/): the tasks.
- [openai](/docs/ai/plugins/openai/): the other voiceover provider.
- [runner](/docs/ai/plugins/runner/): how the error classes become retries.
