---
title: codex
description: "Provider. Image and prompt-gen over the local Codex CLI. Runs on your ChatGPT plan, so every result costs $0."
section: Providers
order: 35
---

## What it does

**Provider.** `codex` runs the local Codex CLI, `codex exec`, on the user's ChatGPT plan. The
marginal price of one image or one answer is `$0`. It registers two handlers with `registry` in
`onInit`: `("image", "codex")`, then `("prompt-gen", "codex")`.

Each call owns one temp dir under `workDir`:

1. Reference images are copied in as `ref-1.png`, `ref-2.jpg` and so on. Store paths have no
   extension, and codex reads the type from it.
2. `codex exec` runs with `-C <dir>` and stdin closed. An open stdin makes codex wait forever.
3. The image is `output.png`, else the newest `.png`, `.jpg`, `.jpeg` or `.webp` that is not a
   ref. The prompt-gen answer is `last-message.txt`, trimmed.
4. The dir is removed in `finally`, on success and on every failure.

Its own public API is one method, `app.codex.info()`.

## Setup

No API key. The CLI is found on `PATH`, read through `ctx.env`, and must be logged in.

```sh terminal title="setup"
$ codex login
```

`info().configured` is true when `bin` exists: a path-like `bin` is checked directly, a bare name
is searched on `PATH`.

## Tasks it serves

| Task | Command | Default provider of the task |
|---|---|---|
| [image](/docs/ai/plugins/image/) | `codex exec ... --sandbox workspace-write` | yes: codex registers first |
| [prompt-gen](/docs/ai/plugins/prompt-gen/) | `codex exec ... --sandbox read-only` | no: name `provider: codex` |

### image

`prompt`, optional `negative`, `aspect` and refs. The prompt sent to codex is one line each: the
instruction to generate exactly one image, the brief, `Avoid: <negative>.`, the size line, a line
naming the refs, and the save instruction (`output.png`, reply with the file name only).

| `aspect` | Size line |
|---|---|
| `"9:16"` (default, also for unknown values) | `Portrait, 1024x1536.` |
| `"16:9"` | `Landscape, 1536x1024.` |
| `"1:1"` | `Square, 1024x1024.` |

```yaml file="hello.moku.yaml"
  - id: patisserie
    task: image
    provider: codex
    input:
      prompt: "cream-walled patisserie, night"
      aspect: "9:16"
```

### prompt-gen

Single turn only. codex has no system flag: with `system` set, the prompt is `system`, a blank
line, then `prompt`. With `params.responseSchema`, the answer rule and the schema follow after
another blank line. `--output-schema` is never used: strict mode rejects what `z.toJSONSchema`
makes.

| Param | Shape | Effect |
|---|---|---|
| `params.images` | `ImageFile` or `ImageFile[]` | Copied into the call dir, one `--image <abs path>` each. |
| `params.responseSchema` | plain JSON-schema object | Appended to the prompt as compact JSON. The answer is parsed, one ```` ```json ```` fence stripped, and checked with `z.fromJSONSchema(schema)`. `text` is the validated JSON, re-stringified. |
| `params.reasoning` | `"off"`, `"low"`, `"medium"`, `"high"` | `-c model_reasoning_effort="<x>"`. `off` becomes `low`. Absent: `reasoningEffort`. |
| `temperature` | number | Ignored. `meta.ignored: ["temperature"]`. |
| any other param | any | Ignored. |

A bad shape throws a plain `Error` before codex is spawned: `[ai] Codex params.images must be
image files.`, `[ai] Codex params.responseSchema must be a JSON schema object.`,
`[ai] Codex params.reasoning must be off, low, medium or high.`

The result has `toolCalls: []`, `finishReason: "stop"` and every `usage` count `0`: the CLI
reports no tokens. `cacheSystem` and `cacheTtl` are ignored. `meta` is `Codex.CodexPromptMeta`:
`{ provider: "codex", model?, modelRequested?, effort, ignored? }`.

Model mapping, in order:

1. An exact `modelMap` entry wins.
2. No request model: `textModel`.
3. `openai/<id>`: the prefix is stripped. `openai/gpt-6-sol` becomes `gpt-6-sol`.
4. A bare codex id passes: `gpt-*`, `o<digit>*`, `codex-*`.
5. Anything else, such as `anthropic/claude-opus-5.5`: `textModel`.

An empty `textModel` means no `-m` flag: codex's own default. `meta.modelRequested` keeps the
original id.

```yaml file="hello.moku.yaml"
  - id: terse
    task: prompt-gen
    provider: codex
    input:
      system: "Be terse."
      prompt: "Say ok"
      model: openai/gpt-6-sol
    params: { reasoning: low }
```

## Models and prices

Bundled image prices: `{ "gpt-6-astra": 0 }`. The zero is an explicit entry. A model without a
price throws from `estimate()` and `execute()`, it never counts as free:

```
[ai] No price for codex model "<model>".
```

`priceOverrides` merges over the table, USD per image by model. prompt-gen has no price table:
`estimate()` returns `{ usd: 0 }` and every result has `costUsd: 0`.

```ts file="moku.config.ts" check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: {
    codex: {
      textModel: "gpt-6-sol",
      priceOverrides: { "gpt-6-luna": 0 } // [!note] A new image model needs a price, even $0.
    },
    limits: { lanes: { "prompt-gen/codex": { concurrency: 2 } } } // [!note] A local CLI should not run many calls at once.
  }
});

console.log(app.codex.info().models); // ["gpt-6-astra", "gpt-6-luna"]
```

## Config

`pluginConfigs.codex`.

| Option | Type | Default | Description |
|---|---|---|---|
| `bin` | `string` | `"codex"` | Executable. A bare name is looked up on `PATH`. |
| `model` | `string` | `"gpt-6-astra"` | Image model when an image request names none. |
| `reasoningEffort` | `string` | `"low"` | Passed as `-c model_reasoning_effort="<effort>"`, for both tasks. |
| `timeoutMs` | `number` | `600_000` | Kill the CLI with SIGTERM after this long. |
| `workDir` | `string` | `".moku/tmp"` | Root for per-call temp dirs, resolved against the cwd. `""` means `os.tmpdir()`. |
| `priceOverrides` | `Record<string, number>` | `{}` | USD per image by model, merged over the bundled table. |
| `textModel` | `string` | `""` | prompt-gen model when the request model maps to none. `""` leaves `-m` out. |
| `modelMap` | `Record<string, string>` | `{}` | Exact request-model id to codex model. Checked before every other mapping rule. |

## API

Mounted at `app.codex`.

| Method | Signature | Description |
|---|---|---|
| `info` | `() => { provider: "codex"; configured: boolean; models: string[] }` | `configured` is whether `bin` exists. `models` is the image models of the effective price table. |

```ts file="status.ts" check
import { app } from "./app";

const { configured, models } = app.codex.info();
console.log(configured, models); // true, ["gpt-6-astra"]
```

Types ship under the `Codex` namespace: `Codex.Config`, `Codex.CodexInfo`, `Codex.CodexPromptMeta`.

## Errors

| Case | Error | Runner |
|---|---|---|
| Unknown image model price | `Error` `[ai] No price for codex model "<m>".` | terminal |
| `messages`, `tools` or `toolChoice` set | `PromptGenUnavailableError`, `reason: "unsupported"` | `promptGen` falls back |
| `bin` not found | `PromptGenUnavailableError`, `reason: "missing"`, `[ai] Codex CLI not found: <bin>.` | `promptGen` falls back |
| Not logged in: status 401 or 403, or stderr says so | `PromptGenUnavailableError`, `reason: "auth"`, `[ai] Codex CLI is not logged in.` | `promptGen` falls back |
| Plan or rate limit: status 429, or stderr says so | `PromptGenUnavailableError`, `reason: "limit"`, `[ai] Codex CLI hit its plan or rate limit.` | `promptGen` falls back |
| `bin` not executable | `TerminalProviderError` `[ai] Codex CLI could not start: <code>.` | terminal |
| Non-zero exit | `TerminalProviderError` `[ai] Codex exited with code <n>: <detail>.` | terminal |
| Exit 0, no image | `TerminalProviderError` `[ai] Codex finished without writing an image.` | terminal |
| Exit 0, answer missing or blank | `TerminalProviderError` `[ai] Codex wrote no answer.` | terminal |
| Answer off-schema or not JSON | `TerminalProviderError` `[ai] Codex answer does not match params.responseSchema.` | terminal |
| Timeout | `RetryableProviderError`, `kind: "timeout"` | retried |
| Caller abort | `signal.reason`, rethrown unchanged | pause |

The `<detail>` of a non-zero exit is the `error.message` of the API error codex prints, else the
last stderr line, capped at 300 characters. An API error with a status decides by the status
alone: 401 or 403 is `auth`, 429 is `limit`, any other status is terminal. The unavailable
checks run in `estimate()` and `execute()`, before any spawn.

Terminal and unavailable errors carry neither `kind` nor `status`, so the runner classifies them
as `unknown`, which is terminal: the item is `failed` and never re-run.

The classes are values under `CodexErrors`:

```ts file="handle.ts" check
import { CodexErrors } from "@moku-labs/ai";
import { app } from "./app";

try {
  await app.image.generate({ prompt: "a cat" }, { provider: "codex" });
} catch (error) {
  if (error instanceof CodexErrors.RetryableProviderError) {
    console.warn("timed out", error.kind);
  } else if (error instanceof CodexErrors.TerminalProviderError) {
    console.error("failed", error.message);
  } else {
    throw error;
  }
}
```

:::gotchas
- **Cap the lane.** `promptGen.generate` and runner builds wait for the `prompt-gen/codex/default` lane. Set its `concurrency` in [limits](/docs/ai/plugins/limits/).
- **No tools, no conversation.** `messages`, `tools` and `toolChoice` make the provider unavailable. Use another prompt-gen provider for tool calling.
- **`--` is mandatory in the command.** `--image` is greedy and would take the prompt as another image. The plugin handles this; it matters only when you read the logs.
:::

## Events

### Emits

None.

### Listens to

None. Diagnostics go through `ctx.log`: `codex:image:done` with `{ model, bytes }` and
`codex:prompt-gen:done` with `{ model, chars }`. `model` is `"default"` when no `-m` was passed.
The prompt and the answer are never logged.

## Depends on

- [registry](/docs/ai/plugins/registry/): the two `register` calls.

## Related

- [image](/docs/ai/plugins/image/), [prompt-gen](/docs/ai/plugins/prompt-gen/): the tasks.
- [claude](/docs/ai/plugins/claude-code/): the same shape over the Claude Code CLI.
- [openai](/docs/ai/plugins/openai/): the same models through the API, priced per token.
