---
title: journal
description: "The SQLite ledger: runs, items, attempts, the atomic budget gate and crash durability. Injected as ctx.journal."
section: Pipeline
order: 15
---

## What it does

**Core plugin.** The journal is the framework's memory. One invocation is one `runs` row. Each item
is one `items` row with this state machine: `queued → dispatching → done | failed | flagged`.
Each provider call is one `attempts` row.

It holds metadata only: statuses, costs, hashes, error classes. It never holds a prompt, a body or
a key. The bytes are in [store](/docs/ai/plugins/store/).

Most apps never call it. The runner drives it. Read it for your own reports, or use provider
records in a custom provider.

## How it works

- On Bun it uses `bun:sqlite`. On Node it uses `better-sqlite3`.
- WAL mode with `synchronous=FULL`. Each state change commits inside `BEGIN IMMEDIATE`.
- `gateToDispatching` does the budget check, the dedup and the state change in one transaction.
- Every method except `isOpen()` throws before `app.start()` and after `app.stop()`.

## Config

`pluginConfigs.journal`.

| Option | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | `".moku/journal.db"` | The database file. Parent folders are created on start. |
| `checkpointIntervalMs` | `number` | `30000` | Time between WAL checkpoints. |
| `busyTimeoutMs` | `number` | `5000` | SQLite `busy_timeout`. |

## API

Mounted at `app.journal` and `ctx.journal`.

| Group | Methods |
|---|---|
| Runs | `openRun`, `getRun`, `latestRun`, `latestResumableRun`, `setRunStatus` |
| Items | `insertItems`, `getItem`, `requeueDispatching`, `gateToDispatching`, `commitDone`, `markFailed`, `markFlagged` |
| Reuse | `findDoneArtifact`, `reuseDone` |
| Attempts and jobs | `recordAttempt`, `finishAttempt`, `setAttemptJob`, `findLiveJob` |
| Reads | `totals`, `listItems`, `readSnapshot`, `isOpen` |
| Provider records | `findProviderRecord`, `putProviderRecords`, `deleteProviderRecord` |

`readSnapshot` opens a short-lived connection, so it is safe from a second process. Provider records
keep opaque provider ids, like a registered asset, across runs.

```ts file="report.ts" check
import { app } from "./app";

await app.start();
const run = app.journal.latestRun();
if (run) {
  console.log(run.status, app.journal.totals(run.id).spendUsd);
  for (const item of app.journal.listItems(run.id, { status: "failed" })) {
    console.log(item.label, item.attemptCount);
  }
}
await app.stop();
```

## Events

### Emits

None.

### Listens to

None.

## Depends on

Nothing.
