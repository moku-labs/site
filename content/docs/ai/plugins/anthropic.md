---
title: anthropic
description: "Provider. prompt-gen over the Messages API with the official Anthropic SDK: tools, prompt cache, effort."
section: Providers
order: 34
---

## What it does

**Provider.** `anthropic` registers one handler with `registry` in `onInit`:
`("prompt-gen", "anthropic")`. It defines no task of its own. `app.promptGen.generate` and the
runner reach it through the registry.

It reads the same request contract as every prompt-gen provider: `prompt` or `messages`, `system`,
`tools`, `toolChoice`, `cacheSystem`, `cacheTtl`, part `cache: true` and `params`. A call moves
from another provider to Anthropic by the provider and model name only.

Every request is streamed, so a 128K `max_tokens` works. The SDK's own retries are off: the runner
owns retries. Prompts, answers and the key never appear in errors, logs or result metadata.

Its own public API is one method, `app.anthropic.info()`.

## Setup

One env var. Exported in the shell or in `.env.local`.

| Variable | Needed by |
|---|---|
| `ANTHROPIC_API_KEY` | `execute` only |

`info()` and `estimate()` never need it. Without it, `execute` throws `PromptGenUnavailableError`
with reason `"auth"`, so `promptGen` moves to the next provider of its `fallback` chain. No request
is sent.

```
[ai] ANTHROPIC_API_KEY is not set.
  Export it, or use another prompt-gen provider.
```

## Tasks it serves

| Task | API | Default provider of the task |
|---|---|---|
| [prompt-gen](/docs/ai/plugins/prompt-gen/) | Messages API, streamed | no: name `provider: anthropic` |

### prompt-gen

| Request field | Sent as | Notes |
|---|---|---|
| `system` | `system` | With `cacheSystem`: one text block with `cache_control`. |
| `prompt` (no `messages`) | one user message | With `params.images`: the image blocks first, then the text. |
| `messages` | user and assistant turns | `prompt` is ignored. |
| `cacheTtl` | `ttl` of every `cache_control` | `"1h"` sends `ttl: "1h"`. Unset or `"5m"` sends no `ttl`. Other values: 400. |
| `tools` | `{ name, description, input_schema }` | Sent only when there is at least one tool. |
| `toolChoice` | `auto`, `none`, `any`, `tool` | Opus 5.5, Sonnet 5.5 and Fable 5.1 answer a forced choice with a terminal 400. |
| `params.reasoning` | `output_config.effort` | off and low send `low`, medium sends `medium`, high sends `high`. Unset: `medium`. Other: 400. |
| `params.responseSchema` | `output_config.format` of type `json_schema` | Not a plain object: 400. `params.strictSchema` is not read. |
| `params.max_tokens` | `max_tokens` | Positive integer, else `config.maxTokens`. |
| `params.images` | base64 image blocks | One `{ path, mimeType, hash }` or a list. Refused with `messages`. jpeg, png, gif and webp only. |
| `temperature` | never sent | Current models reject it. |

Refused with a terminal 400 before any I/O: empty `messages`, an empty prompt without
`messages`, a model without a price, a bad `params.reasoning`, `params.responseSchema` or
`cacheTtl`, `params.images` with `messages`, an image that is not a local file or has a type the
API cannot read.

Answers: `stop_reason` `end_turn` and `stop_sequence` give `finishReason: "stop"`, `tool_use` gives
`"tool_calls"`, `max_tokens` gives `"length"` and logs `anthropic:prompt-gen:partial`, `refusal`
throws `FlaggedProviderError`. `text` is the text blocks joined. `meta` is
`{ model, effort, stopReason, promptTokens, completionTokens }`.

```yaml file="hello.moku.yaml"
  - id: judge
    task: prompt-gen
    provider: anthropic
    input:
      model: anthropic/claude-sonnet-5.5
      system: "You judge storyboard frames."
      cacheSystem: true
      prompt: "Is the subject in frame?"
    params: { reasoning: medium, max_tokens: 2000 }
```

### Prompt cache

- A mark is `cacheSystem` on the system text, or `cache: true` on a text part. Each becomes a
  `cache_control` on its block. The API takes at most 4 marks: the first 4 in request order keep
  theirs.
- `cacheTtl` sets one lifetime for every mark of the request. Unset or `"5m"`: 5 minutes.
  `"1h"`: one hour. A 1-hour write costs 2× input, a 5-minute write 1.25×. A read costs the same
  on both. Use `"1h"` for calls that share a prefix but start more than 5 minutes apart.
- `usage.cachedReadTokens` are the reads, `cacheWriteTokens` the writes. `promptTokens` is every
  input token: uncached, written and read.

### Tools and thinking

A `tool_use` block becomes a `ToolCall`. Consecutive `tool` messages are sent as one user message
of `tool_result` blocks. Thinking blocks must go back unchanged with their tool turn, and the
`ChatMessage` type cannot carry them, so the plugin keeps the whole content of every answer with
tool calls in state, keyed by its first `tool_use` id. The memory holds the last 500 turns and is
lost on a restart: a resumed loop then sends the open tool turn without its thinking, and the API
may answer with a terminal 400.

## Models and prices

The plugin ships a price table in USD per one million tokens. `priceOverrides` merges over it
field by field.

| Model | Input | Output | Cache read | Cache write 5m | Cache write 1h | Long context |
|---|---|---|---|---|---|---|
| `claude-opus-5-5` | 4 | 20 | 0.20 | 5 | 8 | |
| `claude-sonnet-5-5` | 2 | 10 | 0.20 | 2.50 | 4 | |
| `claude-sonnet-5` | 2 | 10 | 0.20 | 2.50 | 4 | |
| `claude-haiku-5-5` | 0.10 | 0.50 | 0.01 | 0.125 | 0.20 | above 100 000 input tokens: × 5 in, × 5 out |
| `claude-fable-5-1` | 10 | 50 | 0.25 | 12.50 | 20 | |

Aliases, the ids the studio uses with fal and OpenRouter:

| Alias | Native id |
|---|---|
| `anthropic/claude-opus-5.5` | `claude-opus-5-5` |
| `anthropic/claude-sonnet-5.5` | `claude-sonnet-5-5` |
| `anthropic/claude-sonnet-5` | `claude-sonnet-5` |
| `anthropic/claude-haiku-5.5` | `claude-haiku-5-5` |
| `anthropic/claude-fable-5.1` | `claude-fable-5-1` |

Any other id is sent as is. It needs all five rates in `priceOverrides`, or the request is refused
with a terminal 400 before any I/O.

Cost: uncached input × input, 5m writes × write 5m, 1h writes × write 1h, cache reads × read,
output × output, rounded to micro-dollars. Without the lifetime breakdown every write is priced
at 5m. Long context: when the total input passes the threshold, every input-side rate and the
output rate take their multiplier for the whole request. `estimate` is offline: `chars / 4` of
the system text and the prompt, or of every message and tool-call JSON, plus 1 600 tokens per
image, in; `max_tokens` out.

```ts file="moku.config.ts" check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: {
    anthropic: {
      model: "claude-sonnet-5-5",
      maxTokens: 64_000,
      priceOverrides: {
        "claude-next-6": { inputPerM: 5, outputPerM: 25, cacheReadPerM: 0.5, cacheWrite5mPerM: 6.25, cacheWrite1hPerM: 10 } // [!note] All five rates, or the model is refused.
      }
    }
  }
});

console.log(app.anthropic.info().model); // "claude-sonnet-5-5"
```

## Config

`pluginConfigs.anthropic`.

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKeyEnv` | `string` | `"ANTHROPIC_API_KEY"` | Name of the env var with the API key. Read through `ctx.env` on the first `execute`. |
| `baseUrl` | `string` (optional) | SDK default | API base URL override. |
| `model` | `string` | `"claude-opus-5-5"` | Model when the request names none, or names `"default"`. Aliases work here too. |
| `maxTokens` | `number` | `32_000` | Output cap when `params.max_tokens` is not a positive integer. |
| `timeoutMs` | `number` | `900_000` | Request timeout, ms. A timeout is retryable. |
| `priceOverrides` | `Record<string, Partial<AnthropicPrice>>` | `{}` | Per-model prices merged over the bundled table. `AnthropicPrice` has `inputPerM`, `outputPerM`, `cacheReadPerM`, `cacheWrite5mPerM`, `cacheWrite1hPerM` and an optional `longContext`. |

## API

Mounted at `app.anthropic`.

| Method | Signature | Description |
|---|---|---|
| `info` | `() => { provider: "anthropic"; configured: boolean; model: string }` | `configured` is whether the key env var is set. `model` is the default model. Never throws and never builds the client. |

```ts file="status.ts" check
import { app } from "./app";

const { configured, model } = app.anthropic.info();
console.log(configured, model); // true, "claude-opus-5-5"
```

Types ship under the `Anthropic` namespace: `Anthropic.Config`, `Anthropic.AnthropicPrice`,
`Anthropic.AnthropicApi`.

## Errors

| SDK error | Class | Fields | Runner |
|---|---|---|---|
| `APIConnectionTimeoutError` | `RetryableProviderError` | `kind: "timeout"` | retried |
| `RateLimitError` (429) | `RetryableProviderError` | `status: 429`, `retryAfterMs` from `retry-after` | retried after the hint |
| `APIError` with status 500 or above, 529 overloaded included | `RetryableProviderError` | `status` | retried |
| Any other `APIError` with a status, a refused request | `TerminalProviderError` | `status` | item `failed` |
| A `refusal` stop reason | `FlaggedProviderError` | `kind: "content-policy"` | item `flagged`, never re-queued |
| Anything else: connection error, stream error | `RetryableProviderError` | `kind: "network"` | retried |
| Missing key | `PromptGenUnavailableError` | `reason: "auth"` | `promptGen` falls back |

A 401, 402, 403 or 429 also makes `promptGen` fall back to the next provider. An
`APIUserAbortError`, or any failure after the caller aborted, is rethrown unchanged. Messages are
fixed `[ai] Anthropic ...` strings, never the SDK's message.

The classes are values under `AnthropicErrors`:

```ts file="handle.ts" check
import { AnthropicErrors } from "@moku-labs/ai";
import { app } from "./app";

try {
  await app.promptGen.generate({ prompt: "Say ok." }, { provider: "anthropic" });
} catch (error) {
  if (error instanceof AnthropicErrors.RetryableProviderError) {
    console.warn("transient", error.status ?? error.kind);
  } else if (error instanceof AnthropicErrors.TerminalProviderError) {
    console.error("failed", error.status, error.api?.type);
  } else {
    throw error;
  }
}
```

`TerminalProviderError` also carries `api`, the API's `{ type, message }` error detail when there
is one.

:::gotchas
- **No `temperature`.** It is never sent. Current models reject it.
- **One TTL per request.** `cacheTtl` applies to every mark. The API needs longer-lived marks before shorter ones.
- **The thinking memory is per process.** A tool loop resumed after a restart may get a terminal 400 on its open turn.
:::

## Events

### Emits

None.

### Listens to

None. Diagnostics go through `ctx.log`: `anthropic:prompt-gen:done` with model and token counts,
`anthropic:prompt-gen:partial` on `max_tokens`, and `anthropic:prompt-gen:failed` with the error
class and status. No text.

## Depends on

- [registry](/docs/ai/plugins/registry/): the `register` call.

## Related

- [prompt-gen](/docs/ai/plugins/prompt-gen/): the task, its `fallback` chain and `runToolLoop`.
- [claude](/docs/ai/plugins/claude-code/): the same models through the Claude Code CLI, plan-billed.
- [runner](/docs/ai/plugins/runner/): how the error classes become retries.
