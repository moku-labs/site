---
title: compose
description: "Natural language to a validated build file. A repair loop means it can never return an invalid spec."
section: Pipeline
order: 13
---

## What it does

`compose` asks an LLM for a build file and validates the answer through `buildfile`. An invalid
answer goes back to the model with the validation issue. It writes no files and starts no run.

:::steps
1. Build a system prompt from `buildfile.jsonSchema()` and the input shapes of the tasks.
2. Call `promptGen.generate` with the configured provider.
3. Strip a Markdown fence, then validate with `buildfile.compile`.
4. On failure, send the request, the last output and the issue again, up to `maxRepairAttempts` times.
5. On success, apply `name` and emit the text.
:::

## Config

`pluginConfigs.compose`.

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | `string` | `"openai"` | The `prompt-gen` provider for every attempt. |
| `maxRepairAttempts` | `number` | `2` | Extra attempts after the first. |

## API

Mounted at `app.compose`, reachable with `ctx.require(composePlugin)`.

| Method | Signature | Description |
|---|---|---|
| `compose` | `(opts: { prompt, emit, name?, signal? }) => Promise<ComposeResult>` | Generates and validates. |

| Option | Type | Description |
|---|---|---|
| `prompt` | `string` | What the build should make. |
| `emit` | `"build" \| "script"` | YAML text, or a `defineBuild()` TypeScript module. |
| `name` | `string` | Replaces the generated `name`. |
| `signal` | `AbortSignal` | Goes to every generate call. |

`ComposeResult` is `{ spec, text, costUsd }`. `costUsd` counts every attempt, the failed ones too.

```ts file="compose.ts" check
import { writeFile } from "node:fs/promises";
import { app } from "./app";

await app.start();
const { text, costUsd } = await app.compose.compose({
  prompt: "Narrate a greeting in English, then translate it to Spanish.",
  emit: "build",
  name: "greeting"
});
await writeFile("greeting.moku.yaml", text);
console.log(costUsd);
await app.stop();
```

When every attempt fails it throws `[ai] Compose could not produce a valid build file after <n> attempts.`

:::callout
`compose` is a direct call. It is not journaled and not under a run's budget. It needs the key of
its provider, `OPENAI_API_KEY` by default.
:::

## Events

### Emits

None.

### Listens to

None.

## Depends on

[buildfile](/docs/ai/plugins/buildfile/), [promptGen](/docs/ai/plugins/prompt-gen/).
