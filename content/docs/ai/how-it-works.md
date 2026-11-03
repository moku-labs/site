---
title: How it works
description: "One pipeline for every item: plan, reuse, gate, execute, persist. The journal and the store make it safe to kill."
section: Get started
order: 3
---

## The picture

:::flow
- `*.moku.yaml`
- `buildfile`
- `runner`
- `registry`
- provider handler
- `store`, then `journal`
:::

| Part | Job |
|---|---|
| `buildfile` | Compiles the build files through one zod schema into a `BuildSpec`. |
| `runner` | Plans every item and drives it through the steps below. |
| `registry` | Finds the handler for the item's task and provider. |
| Provider handler | Calls the service. Returns the bytes and the real cost. |
| `store` | Keeps the bytes. |
| `journal` | Records the hash and the cost, after the bytes are safe. |

Tasks and providers never import each other. A task plugin owns a contract, a provider plugin
registers a handler for it, and the runner only sees the handler.

## One item, step by step

:::steps
1. **Plan.** Order the items so `$ref` targets come first. Resolve the provider. Hash every `$file`. Compute two keys. Insert the item as `queued`.
2. **Reuse.** A `done` artifact with the same artifact key, from any run, with its bytes still in the store, completes the item at cost 0. No provider call.
3. **References.** Wait for the `$ref` targets. A target that did not end `done` blocks the item: it stays `queued` and the run ends `paused`.
4. **Claim.** One item per artifact key reaches the provider at a time, across all active runs.
5. **Admit.** `limits.acquire("{task}/{provider}/default")` waits for a rate token and a concurrency slot.
6. **Gate.** One SQLite transaction checks the budget, drops duplicates and moves the item `queued → dispatching`.
7. **Execute.** The handler runs: `execute`, or `submit` and `poll` for a long job.
8. **Persist.** `store.put` writes the bytes. Then `journal.commitDone` writes the metadata. An artifact exists only when both are there, bytes first.
9. **Report.** A record goes to `app.runner.events()`. Progress goes to the plugin bus, at most once per 500 ms.
:::

## Two keys

| Key | Hash of | What it does |
|---|---|---|
| Planning key | `task`, `input`, `params` | The item's identity inside a run. `$ref` uses the target's planning key. Excludes `provider`. |
| Artifact key | `task`, `provider`, pack version, `input`, `params` | The identity of the result. `$ref` uses the target's artifact key. This key drives reuse. |

Each `$file` enters both keys as its content hash. So one changed keyframe rebuilds that keyframe
and every shot that references it. The other items are reused.

The `id` is not part of either key. It is the file name of the export and the target of a `$ref`.

## Which provider runs

An item picks its provider in this order:

1. `provider` on the item.
2. `defaults.provider` in the build file.
3. The first provider registered for the task.

:::callout{tone="warn"}
A task's `defaultProvider` config applies to the one-off facade, such as `app.music.generate`. It
does not apply to a build file item. Name the `provider` on the item when it matters.
:::

## The budget gate

The gate runs right before each provider call, in one transaction:

```text
done actual cost + dispatching estimates + this item's estimate <= maxCostUsd
```

When the check fails, the run stops admitting, lets in-flight items finish and settles
`budget-stopped`. The guarantee is that spend stays within the done items plus the items that
were dispatching at a kill. `estimate` uses the same math, and `moku estimate` shows it.

:::callout
The real cost of an item can differ from its estimate. A run without `maxCostUsd` has no ceiling.
:::

## Failures

| Error class | Comes from | Outcome |
|---|---|---|
| `http-5xx` | `status >= 500` | Retry with backoff |
| `http-429` | `status === 429` | Retry with backoff. A longer `Retry-After` wins. |
| `timeout` | `kind: "timeout"` | Retry with backoff |
| `network` | `kind: "network"` | Retry with backoff |
| `http-4xx` | Other 4xx | `failed` |
| `content-policy` | `kind: "content-policy"` | `flagged`, never queued again |
| `invalid-request` | `kind: "invalid-request"` | `failed` after one attempt |
| `local-failure` | `kind: "local-failure"` | `failed` after one attempt |
| `unknown` | No hint at all | `failed` after one attempt. A bug must not re-run a paid job. |

Backoff is exponential in the attempt number, from `runner.retryBaseMs`, jittered to 50-100%.
`runner.maxAttempts` caps the attempts. A build file can set `defaults.maxAttempts`.

`limits` counts retryable failures per lane. After `breakerThreshold` in a row the lane's breaker
opens for `breakerCooldownMs`, and items wait.

## Crashes, pauses and long jobs

The journal runs SQLite in WAL mode with `synchronous=FULL`. Every state change is a committed
write, so a `kill -9` loses only work in flight.

| What happened | What the next run does |
|---|---|
| Crash or kill | `moku run` or `runner.resume()` queues the `dispatching` items again. `done` items are never billed again. |
| Ctrl-C or an aborted `signal` | The run stops admitting and drains, then settles `paused`. Exit code 4. |
| `app.stop()` | Pauses every active run and waits for it. |
| A `submit` + `poll` job was in flight | The job id was journaled before any wait, so the next attempt polls the same job. It does not pay twice. |
| A job passed `jobTimeoutMs` | The job is `expired`, and the next attempt polls it again first. A job that expired twice is not adopted again. |

## What is stored where

| | Journal (`.moku/journal.db`) | Store (`.moku/store/`) |
|---|---|---|
| Holds | Statuses, costs, hashes, error classes | The artifact bytes |
| Never holds | Prompts, request bodies, keys | Metadata |
| Plugin | [journal](/docs/ai/plugins/journal/) | [store](/docs/ai/plugins/store/) |

This split is the redaction boundary. A prompt cannot reach the journal, because the runner only
passes it statuses, costs and hashes. A generated text output, like a `translate` result, is an
artifact in the store.

## Durable path or one-off call

| | `app.runner.run(...)` | `app.voiceover.generate(...)` |
|---|---|---|
| Journaled | yes | no |
| Budget gate | yes | no |
| Resumable | yes | no |
| Reuses artifacts | yes | no |
| Good for | Anything worth keeping | Scripts, tests, experiments |

```ts file="both.ts" check
import { app } from "./app";

await app.start();

// One-off: direct, not journaled.
const speech = await app.voiceover.generate({ text: "Hi!", voice: "21m00Tcm4TlvDq8ikWAM" });
console.log(speech.costUsd);

// Durable: journaled, budget-gated, resumable.
const result = await app.runner.run({ files: "**/*.moku.yaml", maxCostUsd: 25 });
if (result.status === "paused") await app.runner.resume({ runId: result.runId });

await app.stop();
```

## The plugin order

`createApp` composes five core plugins and the regular plugins. Core plugins are on every
plugin's `ctx`: `log`, `env`, `journal`, `store`, `limits`. Regular plugins mount at `app.<name>`.
Providers register their handlers in `onInit`, so `app.registry` is full as soon as `createApp`
returns, and the order of registration decides the third step of [Which provider runs](#which-provider-runs).

| Task | Providers, in registration order |
|---|---|
| `voiceover` | `elevenlabs`, `openai` |
| `translate` | `openai` |
| `prompt-gen` | `openai`, `anthropic`, `codex`, `claude`, `fal` |
| `image` | `codex`, `fal`, `ark` |
| `video` | `fal`, `apimodels`, `ark` |
| `music` | `elevenlabs`, `fal` |
| `sfx` | `elevenlabs`, `fal` |
| `sprite` | `fal` |
| `asset` | `ark` |
