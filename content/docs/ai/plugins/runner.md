---
title: runner
description: "The durable orchestrator: run, resume, estimate, status, events and export. Owns every run event."
section: Pipeline
order: 10
---

## What it does

`runner` turns build files into artifacts. One `run()` opens one journal run across every matched
build file and drives each item through the [pipeline](/docs/ai/how-it-works/#one-item-step-by-step).

It does not reject on a provider error. A run that cannot finish resolves with
`status: "failed"`, `"paused"` or `"budget-stopped"`.

## Config

`pluginConfigs.runner`.

| Option | Type | Default | Description |
|---|---|---|---|
| `maxAttempts` | `number` | `3` | Attempts per item. A build file's `defaults.maxAttempts` overrides it. |
| `retryBaseMs` | `number` | `1000` | Base of the exponential backoff, jittered to 50-100%. A larger `Retry-After` wins. |
| `eventBufferSize` | `number` | `10000` | Unread item records per `events()` consumer before overflow. |
| `pollIntervalMs` | `number` | `5000` | Delay between two polls of a provider job. |
| `jobTimeoutMs` | `number` | `1800000` | A job still pending after this is marked `expired`. The next attempt polls it again. |
| `maxActiveRuns` | `number` | `1` | Runs one process drives at once. Lanes stay shared. |

## API

Mounted at `app.runner`, reachable with `ctx.require(runnerPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `run` | `(options: RunOptions, opts?: { signal?, onStart? }) => Promise<RunResult>` | One durable run. |
| `resume` | `(opts?: { runId?, signal?, onStart? }) => Promise<RunResult>` | Continues a run. Default: the newest resumable run this process does not drive. |
| `estimate` | `(options: { files? }) => Promise<EstimateResult>` | The gate's own math, by task and provider. No journal writes. |
| `status` | `(runId?: string) => RunStatusReport` | A snapshot. Safe from a second process. |
| `events` | `(opts?: { runId? }) => AsyncIterable<RunEvent>` | The per-item stream. |
| `export` | `(opts?: { runId?, outDir?, flat? }) => Promise<ExportResult>` | Copies done artifacts to named files. |

| `RunOptions` field | Type | Description |
|---|---|---|
| `files` | `string` | Glob of build files. Default: `buildfile.defaultGlob`. |
| `maxCostUsd` | `number` | The budget ceiling. |
| `dryRun` | `boolean` | Plans only. No journal writes. Returns `runId: "dry-run"` and the plan's total in `totals.estimatedRemainingUsd`. |

`RunResult` is `{ runId, status, totals }`. `totals` is `{ total, queued, dispatching, done, failed, flagged, spendUsd, estimatedRemainingUsd }`.

`run` and `resume` throw when `maxActiveRuns` runs are active. `resume` also throws for a run this
process drives, for an unknown id, and when nothing is resumable. `resume()` with no id skips
`failed` runs. Fix the bug, then `resume({ runId })` continues one.

```ts file="pause.ts" check
import { app } from "./app";

await app.start();

const controller = new AbortController();
process.on("SIGINT", () => controller.abort());

const running = app.runner.run(
  { files: "**/*.moku.yaml", maxCostUsd: 25 },
  { signal: controller.signal }
);

for await (const event of app.runner.events()) {
  if (event.type === "item:done") console.log(event.itemId, event.costUsd);
  if (event.type === "item:failed") console.error(event.label, event.errorClass, event.message);
}

const result = await running;
if (result.status === "paused") console.log("Run again to continue:", result.runId);
await app.stop();
```

## Stream records

`app.runner.events()` carries the per-item detail. Every record has `runId`. Per-item records
never touch the plugin bus, because hook dispatch is sequential.

| Record | Fields | When |
|---|---|---|
| `item:queued` | `itemId, task, provider` | The item enters the pipeline. |
| `item:dispatching` | `itemId` | The item passed the gate. |
| `item:done` | `itemId, costUsd, contentHash, contentHashes?` | Stored and committed. `costUsd` is 0 when reused. |
| `item:retry` | `itemId, errorClass, attempt` | Retryable failure. The item is queued again. |
| `item:failed` | `itemId, label, errorClass, message?` | Terminal failure. |
| `item:flagged` | `itemId, message?` | Content policy. Never queued again. |
| `overflow` | `dropped` | The consumer fell behind. The oldest item records were dropped. |
| `progress` | `totals` | Coalesced totals. The latest unread one wins. |
| `terminal` | `status, totals` | Always the last record of a run. |

`events({ runId })` follows one run. `events()` follows every run until none is active. Both are
already closed when nothing is active, so open the stream in `onStart` to see a whole run.

## Export

`export` writes `<outDir>/<build name>/<label>.<ext>`, or `<outDir>/<label>.<ext>` with `flat`.
The default `outDir` is `out`. The label is the item `id`, else `<NN>-<task>`. The extension comes
from the stored mime type.

- A multi-output item writes `<label>.<ext>`, `<label>-2.<ext>` and so on. The item's cost is on the first file.
- A label with `..` or an absolute path is skipped and listed in `skipped`.
- One export never overwrites its own file. With `flat`, the same label in two builds keeps the first.

## Several runs at once

```ts file="two-runs.ts" check
import { createApp } from "@moku-labs/ai";

const app = createApp({ pluginConfigs: { runner: { maxActiveRuns: 2 } } });
await app.start();

const follow = async (runId: string) => {
  for await (const event of app.runner.events({ runId })) console.log(event.type);
};

await Promise.all([
  app.runner.run({ files: "ep01/*.moku.yaml", maxCostUsd: 20 }, { onStart: id => void follow(id) }),
  app.runner.run({ files: "ep02/*.moku.yaml", maxCostUsd: 20 }, { onStart: id => void follow(id) })
]);
await app.stop();
```

Each run keeps its own signal, budget, totals and status. `limits` lanes are shared. An item with
the same artifact key in two runs reaches the provider once: the second waits and copies the
verdict at cost 0. When the first ran out of retries on a retryable error, the second tries itself.

## Events

### Emits

Bus events are for a plugin with `depends: [runnerPlugin]` and a `hooks` map. The app has no `on()`.

| Event | Payload | When |
|---|---|---|
| `run:progress` | `{ runId, total, done, failed, flagged, spendUsd }` | At most once per 500 ms. |
| `run:done` | `{ runId, totals }` | The run completed. |
| `run:failed` | `{ runId, error }` | An unrecoverable run error. |
| `run:budget-stop` | `{ runId, spendUsd, maxCostUsd }` | The ceiling was reached and the run drained. |
| `run:paused` | `{ runId, drained }` | The pause completed. |

```ts file="reporter.ts" check
import { createApp, createPlugin, runnerPlugin } from "@moku-labs/ai";

const reporterPlugin = createPlugin("reporter", {
  depends: [runnerPlugin],
  hooks: ctx => ({
    "run:progress": payload => ctx.log.info("progress", payload),
    "run:done": payload => ctx.log.info("run complete", { runId: payload.runId })
  })
});

export const app = createApp({ plugins: [reporterPlugin] });
```

### Listens to

None.

## Depends on

[registry](/docs/ai/plugins/registry/), [buildfile](/docs/ai/plugins/buildfile/). Uses `ctx.journal`, `ctx.store`, `ctx.limits` and `ctx.log`.
