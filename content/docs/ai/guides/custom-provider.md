---
title: Add a provider or a task
description: "Register a handler in a plugin. Build files can name it at once, through the same durable pipeline."
section: Guides
order: 52
---

## How it fits together

A provider is a plugin that registers a handler in `onInit`. The handler has `estimate` and
`execute`. The runner hands it the item's `input` spread flat, plus `params`. The same shape makes a
new task: pick a task name and register it.

## A new task with its own provider

:::steps
1. **Write the plugin.** `depends: [registryPlugin]` makes the registry reachable in `onInit`.
2. **Compose it.** Pass it to `createApp`, or list it in `moku.config.ts` so the `moku` bin sees it.
3. **Name it in a build file.** Build files take any registered task.
4. **Run it.** Budget, retries, reuse and resume work with no extra code.
:::

```ts file="shout.ts" group="custom" check
import { createPlugin, registryPlugin } from "@moku-labs/ai";

type ShoutRequest = { text: string };

export const shoutPlugin = createPlugin("shout", {
  depends: [registryPlugin],
  onInit: ctx => {
    ctx.require(registryPlugin).register("shout", "acme", {
      estimate: (request: ShoutRequest) => ({ usd: request.text.length * 0.01 }), // [!note] The gate and `moku estimate` call this. It must not touch the network.
      execute: async (request: ShoutRequest) => ({
        body: new TextEncoder().encode(request.text.toUpperCase()), // [!note] Return `body`, `audio`, `image`, `video` or `text`. The runner stores it.
        mimeType: "text/plain", // [!note] The export takes the file extension from this.
        costUsd: request.text.length * 0.01
      })
    });
  }
});
```

```ts file="moku.config.ts" group="custom" check
import { defineConfig } from "@moku-labs/ai";
import { shoutPlugin } from "./shout";

export default defineConfig({ plugins: [shoutPlugin] });
```

```yaml file="demo.moku.yaml"
version: 1
name: demo
items:
  - id: greeting
    task: shout
    provider: acme
    input: { text: "hello" }
```

`moku run` writes `out/demo/greeting.txt`. A second run reuses it at cost 0.

## A provider for an existing task

Use the task's handler type, from its namespace.

```ts file="acme-tts.ts" check
import { createPlugin, registryPlugin } from "@moku-labs/ai";
import type { Voiceover } from "@moku-labs/ai";

const handler: Voiceover.VoiceoverHandler = {
  estimate: request => ({ usd: request.text.length * 0.00003 }),
  execute: async (request, { signal }) => {
    const response = await fetch("https://tts.example/speak", {
      method: "POST",
      body: JSON.stringify({ text: request.text, voice: request.voice }),
      ...(signal ? { signal } : {})
    });
    return {
      audio: new Uint8Array(await response.arrayBuffer()),
      mimeType: "audio/mpeg",
      costUsd: request.text.length * 0.00003
    };
  }
};

export const acmeTtsPlugin = createPlugin("acmeTts", {
  depends: [registryPlugin],
  onInit: ctx => ctx.require(registryPlugin).register("voiceover", "acme", handler)
});
```

## A long job

Expose `submit` and `poll` in place of `execute`. The runner journals the job id before it waits,
polls every `runner.pollIntervalMs`, and after a crash polls that job again.

```ts file="job.ts" check
import type { Runner } from "@moku-labs/ai";

export const handler: Runner.ExecutableHandler = {
  estimate: () => ({ usd: 0.5 }),
  submit: async () => ({ jobId: "job-1" }), // [!note] Call the service here and return its job id.
  poll: async () => ({ state: "pending" }) // [!note] Then `{ state: "done", video, mimeType, costUsd }` or `{ state: "failed", error }`.
};
```

## Tell the runner what failed

Throw an error with a hint. An error with no hint counts as a bug: it fails the item after one
attempt, so a bug cannot re-run a paid job.

| Field | Effect |
|---|---|
| `status` | The HTTP status. 5xx and 429 retry. Other 4xx fail. |
| `kind` | `timeout` and `network` retry. `content-policy` flags. `invalid-request` and `local-failure` fail after one attempt. `resubmit` keeps the status class and stays off the breaker. |
| `retryAfterMs` | Used when larger than the backoff. |
| `publicMessage` | Shown in `item:failed` and `item:flagged` as `message`. It must hold no keys and no prompts. |

```ts file="fail.ts" check
export function refuse(detail: string): never {
  throw Object.assign(new Error(`[acme] Invalid request: ${detail}`), {
    kind: "invalid-request",
    publicMessage: "[acme] Invalid request.\n  Name at least one clip."
  });
}
```

## Next

- [How it works](/docs/ai/how-it-works/#failures): the full failure table.
- [registry](/docs/ai/plugins/registry/): the map behind `register`.
