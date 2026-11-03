---
title: claude
description: "Provider. prompt-gen over the local Claude Code CLI. Runs on your Claude plan, so every answer costs $0."
section: Providers
order: 36
---

## What it does

**Provider.** `claude` runs the local Claude Code CLI, `claude -p --output-format json`, on the
user's Claude plan. The marginal price of one answer is `$0`, so `costUsd` is always `0`. The
CLI's own list-price figure is kept in `meta.listCostUsd` for reference. It registers one handler
with `registry` in `onInit`: `("prompt-gen", "claude")`. No events, no state.

Each call owns one temp dir, `moku-claude-*`, under `workDir`:

1. `params.images` are copied in as `image-1.png`, `image-2.jpg` and so on. Store paths have no
   extension, and the Read tool needs one.
2. `claude -p` runs with the dir as cwd. The dir is outside the repo, so no project `CLAUDE.md`
   is loaded.
3. The prompt goes to stdin, then stdin is closed. stdout is the JSON result.
4. The dir is removed in `finally`, on success and on every failure.

Its own public API is one method, `app.claude.info()`.

## Setup

No API key. The CLI is found on `PATH`, read through `ctx.env`, and must be logged in.

```sh terminal title="setup"
$ claude login
```

`info().configured` is true when `bin` exists: a path-like `bin` is checked directly, a bare name
is searched on `PATH`.

## Tasks it serves

| Task | Command | Default provider of the task |
|---|---|---|
| [prompt-gen](/docs/ai/plugins/prompt-gen/) | `claude -p --output-format json` | no: name `provider: claude`, or set `promptGen.defaultProvider` |

### prompt-gen

Single turn only. The command:

```
claude -p --output-format json --no-session-persistence
  --setting-sources user --strict-mcp-config --disable-slash-commands
  --system-prompt <request.system or the default>
  --restricted --tools Read --allowedTools Read --permission-prompts none    (with images)
  --tools ""                                                    (without images)
  [--model <mapped>] [--effort <low|medium|high>] [--json-schema <schema>]
```

The default system prompt is `Answer the request directly. Output only the answer.` It replaces
Claude Code's coding-agent prompt. `--bare` is never used: it disables OAuth, so plan billing
breaks.

| Param | Shape | Effect |
|---|---|---|
| `params.images` | `ImageFile` or `ImageFile[]` | Copied into the call dir. The prompt lists them by relative path, to be read with the Read tool. |
| `params.responseSchema` | plain JSON-schema object | Passed as `--json-schema` when the root is `type: "object"`, else put in the prompt with the answer rule. The answer is `structured_output`, or `result` with one ```` ```json ```` fence stripped. Either is checked with `z.fromJSONSchema(schema)`. `text` is the validated JSON, re-stringified. |
| `params.reasoning` | `"off" \| "low" \| "medium" \| "high"` | `--effort <x>`. `off` becomes `low`. Echoed in `meta.effort`. Absent: no flag. |
| `temperature` | number | Ignored. Listed in `meta.ignored`. |
| any other param | | Ignored. |

A bad `images`, `responseSchema` or `reasoning` throws a plain `Error` before anything is
spawned, from `estimate()` too. `--json-schema` carries the schema as compact JSON without a
top-level `$schema`: the CLI rejects that key.

Model mapping:

| Request `model` | `--model` |
|---|---|
| a key of `modelMap` | `modelMap[model]` |
| none | `textModel` (no flag when `""`) |
| `anthropic/claude-opus-5.5` | `claude-opus-5-5` (prefix stripped, dots to dashes) |
| `claude-*`, `opus`, `sonnet`, `haiku`, `fable` | passed through |
| anything else, e.g. `openai/gpt-6-sol` | `textModel` (no flag when `""`) |

`meta.modelRequested` keeps the original id whenever the request names a model.

The result: `toolCalls` is always `[]`, `finishReason` always `"stop"`. `usage.promptTokens` is
`input_tokens + cache_read_input_tokens + cache_creation_input_tokens`, `completionTokens` is
`output_tokens`, `cachedTokens` the cache reads and `cacheWriteTokens` the cache writes. A count
the CLI does not report is `0`. `cacheSystem` and `cacheTtl` are ignored. `meta` is
`Claude.ClaudePromptMeta`: `{ provider: "claude", model?, modelRequested?, effort?, listCostUsd,
usage: { inputTokens, outputTokens }, ignored? }`.

```yaml file="hello.moku.yaml"
  - id: score
    task: prompt-gen
    provider: claude
    input:
      prompt: "Score this frame from 1 to 10."
      model: anthropic/claude-opus-5.5
    params:
      reasoning: low
      responseSchema: { type: object, properties: { score: { type: number } }, required: [score] }
```

## Models and prices

No price table. Every answer is plan-billed: `estimate()` returns `{ usd: 0 }` and every result
has `costUsd: 0`. The CLI's `total_cost_usd` is kept in `meta.listCostUsd` and never counted.

Make claude the default prompt-gen provider and cap how many local processes run at once:

```ts file="moku.config.ts" check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: {
    claude: { textModel: "claude-sonnet-5-5" }, // [!note] Used when the request names no model, or one claude cannot map.
    promptGen: { defaultProvider: "claude", fallback: ["codex"] },
    limits: { lanes: { "prompt-gen/claude": { concurrency: 2 } } }
  }
});

console.log(app.claude.info().configured);
```

## Config

`pluginConfigs.claude`.

| Option | Type | Default | Description |
|---|---|---|---|
| `bin` | `string` | `"claude"` | Executable. A bare name is looked up on `PATH`. |
| `textModel` | `string` | `""` | Model when mapping gives none. `""` means no `--model`: the CLI's default. |
| `modelMap` | `Record<string, string>` | `{}` | Exact request-model id to claude model. Checked before the built-in mapping. |
| `timeoutMs` | `number` | `600_000` | Kill the CLI with SIGTERM after this long. |
| `workDir` | `string` | `""` | Root for per-call temp dirs. `""` means `os.tmpdir()`. |

## API

Mounted at `app.claude`.

| Method | Signature | Description |
|---|---|---|
| `info` | `() => { provider: "claude"; configured: boolean }` | `configured` is whether `bin` exists. |

```ts file="status.ts" check
import { app } from "./app";

const { configured } = app.claude.info();
if (!configured) throw new Error("Install the Claude Code CLI first.");
```

Types ship under the `Claude` namespace: `Claude.Config`, `Claude.ClaudeInfo`,
`Claude.ClaudePromptMeta`, `Claude.Reasoning`, `Claude.Effort`.

## Errors

stdout JSON is parsed first, even on a non-zero exit: the not-logged-in result exits 1 with valid
JSON. The login and limit patterns also apply to stderr when stdout is not JSON.

| Case | Error | Runner |
|---|---|---|
| `messages`, `tools` or `toolChoice` set, in `estimate()` and `execute()`, before any spawn | `PromptGenUnavailableError`, `reason: "unsupported"`, `[ai] Claude prompt-gen does not support messages or tools.` | `promptGen` falls back |
| `bin` not found | `PromptGenUnavailableError`, `reason: "missing"`, `[ai] Claude CLI not found: <bin>.` | `promptGen` falls back |
| Not logged in: `not logged in`, `/login`, `invalid api key`, status 401 or 403 | `PromptGenUnavailableError`, `reason: "auth"` | `promptGen` falls back |
| Plan or rate limit: `usage limit`, `limit reached`, `hit your limit`, `rate limit`, status 429 | `PromptGenUnavailableError`, `reason: "limit"` | `promptGen` falls back |
| `bin` not executable | `TerminalProviderError` `[ai] Claude CLI could not start: <code>.` | terminal |
| Other reported error | `TerminalProviderError` `[ai] Claude returned an error: <first line>.` | terminal |
| No JSON, non-zero exit | `TerminalProviderError` with the last stderr line | terminal |
| Empty answer | `TerminalProviderError` `[ai] Claude wrote no answer.` | terminal |
| Answer off-schema or not JSON | `TerminalProviderError` `[ai] Claude answer does not match params.responseSchema.` | terminal |
| Timeout | `RetryableProviderError`, `kind: "timeout"` | retried |
| Caller abort | `signal.reason`, rethrown unchanged | pause |

Terminal and unavailable errors carry neither `kind` nor `status`, so the runner classifies them
as `unknown`, which is terminal: the item is `failed` and never re-run.

The classes are values under `ClaudeErrors`:

```ts file="handle.ts" check
import { ClaudeErrors, isPromptGenUnavailable } from "@moku-labs/ai";
import { app } from "./app";

try {
  await app.promptGen.generate({ prompt: "Say ok." }, { provider: "claude" });
} catch (error) {
  if (isPromptGenUnavailable(error)) {
    console.warn("claude cannot serve now; promptGen would fall back");
  } else if (error instanceof ClaudeErrors.RetryableProviderError) {
    console.warn("timed out", error.kind);
  } else if (error instanceof ClaudeErrors.TerminalProviderError) {
    console.error("failed", error.message);
  } else {
    throw error;
  }
}
```

:::gotchas
- **Cap the lane.** The `"prompt-gen/claude"` lane in [limits](/docs/ai/plugins/limits/) caps how many local claude processes run at once, for `generate` and for runner builds.
- **No tools, no conversation.** `messages`, `tools` and `toolChoice` make the provider unavailable. Use [anthropic](/docs/ai/plugins/anthropic/) for tool calling.
- **Only an object schema goes to `--json-schema`.** Any other root, an array for example, goes in the prompt instead. The zod check is the same.
:::

## Events

### Emits

None.

### Listens to

None. Diagnostics go through `ctx.log`: `claude:prompt-gen:done` with `{ model, chars }`, where
`chars` is the answer length. The prompt and the answer are never logged.

## Depends on

- [registry](/docs/ai/plugins/registry/): the `register` call.

## Related

- [prompt-gen](/docs/ai/plugins/prompt-gen/): the task, `defaultProvider` and `fallback`.
- [anthropic](/docs/ai/plugins/anthropic/): the same models through the API, with tools and a prompt cache.
- [codex](/docs/ai/plugins/codex/): the same shape over the Codex CLI.
