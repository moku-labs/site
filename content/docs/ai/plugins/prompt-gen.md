---
title: promptGen
description: "Task plugin for text generation. Owns the prompt-gen contract, the one-off facade app.promptGen.* and a provider fallback chain."
section: Tasks
order: 22
---

## What it does

`promptGen` is the task plugin for text generation. It owns the contract every prompt-gen
provider implements: `PromptGenRequest`, `PromptGenResult` and `PromptGenHandler`. It exposes a
typed facade, `app.promptGen.*`, for one-off generation, cost estimates and provider discovery.

Two names. The plugin and the facade are camelCase: `app.promptGen`. The task key in build files
and in `registry.register()` is kebab-case: `"prompt-gen"`.

The plugin talks to no AI service. It backs the `compose` plugin, which routes every LLM call
through this facade. Tool calling adds multi-turn fields to the request (`messages`, `tools`,
`toolChoice`, `cacheSystem`) and one library function, `runToolLoop`. See the
[Tool loop](/docs/ai/guides/tool-loop/) guide.

Providers that serve this task today:

| Provider | Plugin | `messages`, `tools`, `toolChoice` | `cacheSystem` | `cacheTtl` |
|---|---|---|---|---|
| `openai` | [openai](/docs/ai/plugins/openai/) | refused, `"unsupported"` | ignored | ignored |
| `anthropic` | [anthropic](/docs/ai/plugins/anthropic/) | served | `cache_control` on the system text | `"1h"` on every mark |
| `codex` | [codex](/docs/ai/plugins/codex/) | refused, `"unsupported"` | ignored | ignored |
| `claude` | [claude](/docs/ai/plugins/claude-code/) | refused, `"unsupported"` | ignored | ignored |
| `fal` | [fal](/docs/ai/plugins/fal/) | served | `cache_control` on the system text | ignored |

A request without `messages`, `tools`, `toolChoice` and `cacheSystem` is a one-turn `prompt`
request. Every provider serves it.

## How it works

`generate` walks a chain: `[opts.provider ?? config.defaultProvider, ...config.fallback]`. A name
listed twice is tried once. For each provider it checks the registered handler's shape, waits for
the provider's `limits` lane `prompt-gen/<provider>/default`, and calls `execute()`. The first
answer wins. `meta.provider` names the provider that answered.

The chain moves on only when the current provider is **unavailable**: `isPromptGenUnavailable(error)`
is true, or the lane rejects with `reason: "breaker-open"`. A provider throws
`PromptGenUnavailableError` when it cannot serve at all:

| `reason` | Meaning |
|---|---|
| `"missing"` | The local binary is missing. |
| `"auth"` | Not logged in, or no key. |
| `"limit"` | A plan or rate limit. |
| `"unsupported"` | The provider cannot express the request, for example `tools` on `openai`. |

`isPromptGenUnavailable` is also true for a numeric `status` of 401, 402, 403 or 429. Any other
error is rethrown at once. A bad or invalid answer never switches provider. An abort is rethrown
at once. When every provider is unavailable, the last error is rethrown. Each switch logs
`warn("prompt-gen:fallback", { from, to, reason })`.

`estimate` and `providers` take no lane and never fall back.

## Config

`pluginConfigs.promptGen`.

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultProvider` | `string` | `"openai"` | Head of the chain when a call names no provider. |
| `fallback` | `string[]` | `[]` | Providers `generate` tries in order when the current one is unavailable. |

```ts check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: { promptGen: { defaultProvider: "claude", fallback: ["codex", "openai"] } }
});
```

:::callout{tone="warn"}
The runner path does not fall back. A `task: prompt-gen` build item uses one provider: the item's
`provider`, else the build file's `defaults.provider`, else the task's first registered provider.
:::

Direct calls obey `limits.defaults` or a lane override. `limits` is a core plugin, so its config
goes to `pluginConfigs.limits`. The prefix key `"prompt-gen/claude"` matches the full lane
`"prompt-gen/claude/default"`:

```ts check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: {
    limits: { lanes: { "prompt-gen/claude": { concurrency: 2 }, "prompt-gen/codex": { concurrency: 2 } } }
  }
});
```

## API

Mounted at `app.promptGen`, reachable with `ctx.require(promptGenPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `generate` | `(request: PromptGenRequest, opts?: { signal?: AbortSignal; provider?: string }) => Promise<PromptGenResult>` | One-off generation with the fallback chain. Direct, not journaled. |
| `estimate` | `(request: PromptGenRequest, opts?: { provider?: string }) => { usd: number }` | Cost estimate from the head of the chain. Synchronous. No fallback, no lane. |
| `providers` | `() => string[]` | Registered prompt-gen providers, in registration order. `[]` when none. |

An unregistered head of the chain throws:

```text
[ai] No prompt-gen provider named "<name>" is registered.
  Available: <comma list or "none">.
```

A later unregistered name in `fallback` is skipped with a `prompt-gen:fallback-skip` warning.

### `PromptGenRequest`

| Field | Type | Required | Description |
|---|---|---|---|
| `prompt` | `string` | yes | The user text. Ignored when `messages` is set; may be `""` then. |
| `system` | `string` | no | System text. |
| `model` | `string` | no | Provider-scoped model id. |
| `temperature` | `number` | no | The provider maps or clamps it. |
| `params` | `Record<string, unknown>` | no | Provider params. |
| `messages` | `ChatMessage[]` | no | The turns after the system text. Replaces `prompt`. |
| `tools` | `ToolDefinition[]` | no | Tools the model may call: `{ name, description, inputSchema }`. |
| `toolChoice` | `"auto" \| "none" \| "required" \| { name: string }` | no | Default `"auto"`. |
| `cacheSystem` | `boolean` | no | A prompt-cache breakpoint after the system text. |
| `cacheTtl` | `"5m" \| "1h"` | no | Lifetime of every cache mark of the request. Default `"5m"`. Only `anthropic` sends it. |

`ChatMessage` is one of:

| Role | Shape |
|---|---|
| `user` | `{ role: "user"; content: string \| ContentPart[] }` |
| `assistant` | `{ role: "assistant"; content: string \| null; toolCalls?: ToolCall[] }` |
| `tool` | `{ role: "tool"; toolCallId: string; content: string \| ContentPart[] }` |

`ContentPart` is `{ type: "text"; text: string; cache?: true }` or
`{ type: "image"; path: string; mimeType: string; hash: string }`. `ToolCall` is
`{ id: string; name: string; input: unknown }`, where `input` is the parsed JSON of the call's
arguments.

### `PromptGenResult`

| Field | Type | Description |
|---|---|---|
| `text` | `string` | The answer. `""` when the turn is only tool calls. |
| `costUsd` | `number` | Actual cost, USD. |
| `toolCalls` | `ToolCall[]` | `[]` when none. |
| `finishReason` | `"stop" \| "tool_calls" \| "length" \| "other"` | Why the model stopped. |
| `usage` | `PromptGenUsage` | Token counts. A count the provider does not report is `0`. |
| `meta` | `Record<string, unknown>?` | Metadata only. `generate` sets `meta.provider`. |

`PromptGenUsage` has `promptTokens`, `completionTokens`, `cachedTokens` and `cacheWriteTokens`.
`cachedReadTokens` and `cachedWriteTokens` are present only when the provider reports them.

A tool call whose arguments are not JSON throws `ToolArgumentsError` with `toolName` and `raw`.
It is never retried and never switches provider.

## Example

The durable path is a build file item:

```yaml file="copy.moku.yaml"
version: 1
name: copy
items:
  - id: tagline
    task: prompt-gen
    provider: openai
    input:
      prompt: "Write a one-line tagline for a durable AI build system."
      system: "You are a concise copywriter."
```

The facade is the direct path. Nothing is journaled:

```ts file="tagline.ts" check
import { app } from "./app";

await app.start();

const request = {
  prompt: "Write a one-line tagline for a durable AI build system.",
  system: "You are a concise copywriter."
};

const { usd } = app.promptGen.estimate(request);
console.log(usd);

const controller = new AbortController();
setTimeout(() => controller.abort(), 30_000);

const result = await app.promptGen.generate(request, { provider: "openai", signal: controller.signal });
console.log(result.text, result.costUsd, result.meta?.provider);

await app.stop();
```

With a fallback chain, a provider that is not logged in is skipped:

```ts file="fallback.ts" check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: { promptGen: { defaultProvider: "claude", fallback: ["codex"] } }
});
await app.start();

const result = await app.promptGen.generate({ prompt: "Name this shot in three words." });
console.log(result.meta?.provider); // [!note] "codex" when claude is unavailable, with one prompt-gen:fallback warning.

await app.stop();
```

A custom provider registers a `PromptGenHandler` under `"prompt-gen"`. `toolCalls`,
`finishReason` and `usage` are required on the result:

```ts file="echo-plugin.ts" check
import { createPlugin, registryPlugin } from "@moku-labs/ai";
import type { PromptGen } from "@moku-labs/ai";

const handler: PromptGen.PromptGenHandler = {
  estimate: request => ({ usd: request.prompt.length * 0.00001 }),
  execute: async request => ({
    text: `echo: ${request.prompt}`,
    costUsd: 0,
    toolCalls: [],
    finishReason: "stop",
    usage: { promptTokens: 0, completionTokens: 0, cachedTokens: 0, cacheWriteTokens: 0 }
  })
};

export const echoPlugin = createPlugin("echo", {
  depends: [registryPlugin],
  onInit: ctx => {
    ctx.require(registryPlugin).register("prompt-gen", "echo", handler);
  }
});
```

:::gotchas
- **`generate` is not journaled.** For a durable item put `task: prompt-gen` in a build file. For a journaled tool conversation use [`runToolLoop`](/docs/ai/guides/tool-loop/).
- **`estimate` has no fallback.** A tool request on a provider that refuses tools throws in `estimate` too. Estimate it with `{ provider: "fal" }`.
- **A tool request needs a provider that serves tools.** `openai`, `codex` and `claude` throw `"unsupported"`. Put `"fal"` or `"anthropic"` in `fallback`, or pass it as `provider`.
- **The lane is shared with the runner.** Direct calls count against the same `prompt-gen/<provider>/default` lane. Local CLIs should not run many at once.
:::

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): `resolve("prompt-gen", provider)` and `providers("prompt-gen")`.
- `limits` and `log` are core APIs on `ctx`: one lane per attempt, one warning per switch.

## Related

- [Tool loop](/docs/ai/guides/tool-loop/): `runToolLoop`, messages, tools and the prompt cache.
- [runner](/docs/ai/plugins/runner/): the durable path for the same handlers.
- [compose](/docs/ai/plugins/compose/): the consumer that turns natural language into a build file.
