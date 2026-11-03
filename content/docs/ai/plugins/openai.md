---
title: openai
description: "Provider. Voiceover, translate and prompt-gen through the official openai SDK, priced from usage."
section: Providers
order: 33
---

## What it does

**Provider.** `openai` registers three handlers with `registry` in `onInit`:
`("voiceover", "openai")` over `audio.speech.create`, `("translate", "openai")` over Chat
Completions and `("prompt-gen", "openai")` over the Responses API. It uses the official fetch-based
`openai` SDK with its own retries off: the runner owns retries. The SDK client is built on the
first `execute` and cached.

Every request is priced in USD twice: an offline estimate for the budget gate, and the actual
cost from the usage the API reports. Prompts, completions and the key never appear in errors, logs
or result metadata.

Its own public API is one method, `app.openai.info()`.

## Setup

One env var. Exported in the shell or in `.env.local`.

| Variable | Needed by |
|---|---|
| `OPENAI_API_KEY` | `execute` only |

`info()` and every `estimate()` work without the key. Without it, voiceover and translate throw
before any request:

```
[ai] OPENAI_API_KEY is not set.
  Export it or set config.apiKeyEnv to the variable that holds your key.
```

prompt-gen throws `PromptGenUnavailableError` with reason `"auth"` instead, so a `promptGen`
fallback chain moves on to the next provider.

## Tasks it serves

| Task | SDK call | Default provider of the task |
|---|---|---|
| [voiceover](/docs/ai/plugins/voiceover/) | `audio.speech.create` | no: `elevenlabs` registers first |
| [translate](/docs/ai/plugins/translate/) | `chat.completions.create` | yes |
| [prompt-gen](/docs/ai/plugins/prompt-gen/) | `responses.create` | yes |

### voiceover

`text`, `voice`, optional `model` and `format`. The model defaults to `models.tts`. `format`:
`mp3` (default) gives `audio/mpeg`, `wav` gives `audio/wav`, `ogg` is sent as `opus` and gives
`audio/ogg`.

```yaml file="hello.moku.yaml"
  - id: intro
    task: voiceover
    provider: openai
    input:
      text: "Welcome to the show!"
      voice: alloy
      format: mp3
```

### translate

`text`, `targetLang`, optional `sourceLang` (else auto-detect) and `model`. A fixed translation
system prompt and `temperature: 0`. The result is `{ text, costUsd, meta: { model, promptTokens,
completionTokens } }`. `detectedSourceLang` is never set.

```yaml file="hello.moku.yaml"
  - id: greeting-ja
    task: translate
    input:
      text: "Hello, world!"
      targetLang: ja
```

### prompt-gen

The same request contract as every prompt-gen provider: `prompt` or `messages`, `system`,
`tools`, `toolChoice`, `cacheSystem` and `params`. The model defaults to `models.chat`. An
`openai/<id>` alias is sent as `<id>`.

| Model | Kind | `params.reasoning: "off"` sends | `temperature` |
|---|---|---|---|
| `gpt-6-astra`, `gpt-6.1-sol` | GPT-6 reasoning | effort `low` | never sent |
| `gpt-6-sol`, `gpt-6-luna` | GPT-6 reasoning | effort `none` | never sent |
| any other | chat | no `reasoning` field | forwarded when set |

| Param | Type | Default | Sent as |
|---|---|---|---|
| `params.reasoning` | `"off" \| "low" \| "medium" \| "high"` | `"medium"` | `reasoning.effort`, GPT-6 only |
| `params.max_tokens` | positive integer | `32_000` | `max_output_tokens` |
| `params.responseSchema` | JSON schema object | none | `text.format` of type `json_schema` |
| `params.strictSchema` | `boolean` | `false` | `strict` of that format |
| `params.images` | `{ path, mimeType, hash }` or a list | none | `input_image` data URLs after the prompt |

Prompt cache: `cacheSystem` and a text part with `cache: true` add a cache breakpoint on GPT-6
models, at most 4 per request. `cacheTtl` is ignored. Every other param is ignored.

Refused before any I/O with a terminal 400: an empty prompt or empty `messages`, a bad
`params.reasoning`, a `responseSchema` that is not an object, `params.images` with `messages`.

```yaml file="hello.moku.yaml"
  - id: sunset
    task: prompt-gen
    provider: openai
    input:
      prompt: "Describe a sunset over the ocean."
      model: gpt-6-luna
    params: { reasoning: low, max_tokens: 400 }
```

## Models and prices

The plugin ships a price table in USD per one million tokens, or per one million characters for
TTS. `priceOverrides` merges over it field by field. An unpriced model costs `$0`, and prompt-gen
logs `openai:prompt-gen:unpriced` once per such model.

| Model | Input /M | Cached input /M | Cache write 30m /M | Cache write 12h /M | Output /M | TTS /M chars |
|---|---|---|---|---|---|---|
| `gpt-6-astra` | 10 | 1 | 12.50 | 25 | 50 | |
| `gpt-6.1-sol` | 2 | 0.10 | 2.50 | 5 | 10 | |
| `gpt-6-sol` | 2 | 0.20 | 2.50 | 5 | 10 | |
| `gpt-6-luna` | 0.10 | 0.01 | 0.125 | 0.25 | 0.50 | |
| `gpt-4o-mini` | 0.15 | 0.075 | | | 0.60 | |
| `gpt-4o` | 2.50 | 1.25 | | | 10 | |
| `gpt-4o-mini-tts` | | | | | | 15 |
| `tts-1` | | | | | | 15 |
| `tts-1-hd` | | | | | | 30 |

- **Long context.** A GPT-6 request above 272K input tokens pays every input-side rate × 2 and
  the output rate × 1.5.
- **Missing cache rates** fall back to the next rate up: cached input to input, 30m write to
  input, 12h write to 30m write.
- **Estimates** count tokens as `chars / 4`. Not a tokenizer. prompt-gen adds 1 600 tokens per
  image and prices `max_output_tokens` out, so the estimate is an upper bound.
- **Actual cost** comes from `usage`: uncached input, cache reads, 30m and 12h writes and output,
  each at its rate. No usage in the answer: `chars / 4` of what was sent and received.

```ts file="moku.config.ts" check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: {
    openai: {
      models: { tts: "gpt-4o-mini-tts", chat: "gpt-4o" },
      priceOverrides: {
        "gpt-4o-2024-11-20": { inputPerM: 2.5, outputPerM: 10 } // [!note] A custom model is $0 until you price it.
      }
    }
  }
});

console.log(app.openai.info().models); // { tts: "gpt-4o-mini-tts", chat: "gpt-4o" }
```

## Config

`pluginConfigs.openai`.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKeyEnv` | `string` | `"OPENAI_API_KEY"` | Name of the env var with the API key. Read through `ctx.env` at request time. |
| `baseUrl` | `string` (optional) | SDK default | Base URL for a proxy or an OpenAI-compatible endpoint. prompt-gen calls `/v1/responses`, so the proxy must serve it. |
| `models` | `{ tts: string; chat: string }` | `{ tts: "gpt-4o-mini-tts", chat: "gpt-4o-mini" }` | Default model per capability. Every request may name its own. |
| `timeoutMs` | `number` | `60_000` | Timeout of a voiceover or translate request, ms. A timeout is retryable. |
| `promptGenTimeoutMs` | `number` | `900_000` | Timeout of a prompt-gen request, ms. Reasoning calls run for minutes. |
| `priceOverrides` | `Record<string, Partial<ModelPrice>>` | `{}` | Per-model prices merged over the bundled table. `ModelPrice` has `inputPerM`, `cachedInputPerM`, `cacheWritePerM`, `cacheWrite12hPerM`, `outputPerM`, `ttsPerMChars`. |

## API

Mounted at `app.openai`.

| Method | Signature | Description |
|---|---|---|
| `info` | `() => { provider: "openai"; configured: boolean; models: { tts: string; chat: string } }` | `configured` is whether the key env var is set. Never throws and never builds the SDK client. |

```ts file="status.ts" check
import { app } from "./app";

const { configured, models } = app.openai.info();
console.log(configured, models.chat); // true, "gpt-4o-mini"
```

Types ship under the `Openai` namespace: `Openai.Config`, `Openai.ModelPrice`, `Openai.OpenaiApi`.

## Errors

`classifyOpenaiError` maps every SDK error to one of three classes. The runner reads `status`,
`kind` and `retryAfterMs` by shape.

| Failure | Class | Fields | Runner |
|---|---|---|---|
| Timeout | `RetryableProviderError` | `kind: "timeout"` | retried with backoff |
| Network failure | `RetryableProviderError` | `kind: "network"` | retried with backoff |
| HTTP 429 | `RetryableProviderError` | `status: 429`, `retryAfterMs` from `Retry-After` | retried after the hint |
| HTTP 5xx | `RetryableProviderError` | `status` | retried with backoff |
| Other HTTP 4xx, no choices in a translate answer, a prompt-gen answer `failed` | `TerminalProviderError` | `status` | item `failed` |
| Content policy | `FlaggedProviderError` | `kind: "content-policy"` | item `flagged`, never re-queued |
| prompt-gen without a key | `PromptGenUnavailableError` | `reason: "auth"` | `promptGen` falls back |

Content policy is found two ways: an SDK error whose body carries a `content_policy`,
`content_filter` or `moderation` marker, or an answer that refuses. For translate that is a
non-null `refusal`. For prompt-gen it is a `refusal` part, or `incomplete` with reason
`content_filter`.

An abort through `opts.signal` is rethrown unchanged. Every thrown message is a fixed string.
The SDK's own message is never echoed.

The classes are values under `OpenaiErrors`:

```ts file="handle.ts" check
import { OpenaiErrors } from "@moku-labs/ai";
import { app } from "./app";

try {
  await app.translate.generate({ text: "Hello", targetLang: "es" }, { provider: "openai" });
} catch (error) {
  if (error instanceof OpenaiErrors.RetryableProviderError) {
    console.warn("transient", error.status ?? error.kind, error.retryAfterMs);
  } else if (error instanceof OpenaiErrors.FlaggedProviderError) {
    console.error("refused");
  } else {
    throw error;
  }
}
```

:::gotchas
- **One key, no pool.** The runner schedules work on the lane `"{task}/openai/default"`. Throttle it with [limits](/docs/ai/plugins/limits/).
- **Reasoning items are kept in memory.** The reasoning of a tool-call answer is stored under its first call id, at most 500 turns, and sent back with that turn. After a restart it is gone. OpenAI accepts the turn without it.
- **A custom model is free until priced.** Add it to `priceOverrides` or the budget gate sees `$0`.
:::

## Events

### Emits

None.

### Listens to

None. Diagnostics go through `ctx.log`: `openai:tts:done`, `openai:translate:done`,
`openai:prompt-gen:done` with model and token or character counts, the `:failed` twins with the
error class and status, and `openai:prompt-gen:unpriced`. No text.

## Depends on

- [registry](/docs/ai/plugins/registry/): the three `register` calls.

## Related

- [voiceover](/docs/ai/plugins/voiceover/), [translate](/docs/ai/plugins/translate/), [prompt-gen](/docs/ai/plugins/prompt-gen/): the tasks.
- [anthropic](/docs/ai/plugins/anthropic/), [codex](/docs/ai/plugins/codex/), [claude](/docs/ai/plugins/claude-code/): the other prompt-gen providers.
- [runner](/docs/ai/plugins/runner/): how the error classes become retries.
