---
title: cli
description: "Typed commands with live branded progress. No argument parser and no binary."
section: Plugins
kind: node
order: 10
---

## What it does

`cli` is the front door: `build`, `dev`, `doctor` and `clean`, with a branded terminal panel. There is
no `argv` parsing and no binary. Each command is a thin script that calls one method. It is convenience,
not a gate: everything below it stays reachable on the app.

## How it works

Every method delegates. Progress renders live from the `native:phase` and `native:complete` hooks, and
doctor rows from `doctor:check`. On a failure it prints the scrubbed tail above the `[native]` line,
then rethrows the same error.

In a terminal the tail sits in a box, and lines are cut to its width. With no terminal, in CI or piped
to a file, there is no box and nothing is cut.

## Config

`pluginConfigs.cli`. Both are test seams.

| Option | Type | Default | Description |
|---|---|---|---|
| `renderImpl` | `(line: string) => void` | the branded console | Where lines go. |
| `confirmImpl` | `(question: string) => Promise<boolean>` | a styled prompt | Answers the `clean` question. |

## API

Mounted at `app.cli`.

| Method | Signature | Description |
|---|---|---|
| `build` | `(opts?: BuildFlavor & { target?, all? }) => Promise<void>` | One target, by default the host's. `all: true` builds every configured target and ignores `target`. |
| `dev` | `(opts?: { target? }) => Promise<void>` | Prepares the tree, runs the dev session and resolves when it exits cleanly, Ctrl-C included. |
| `doctor` | `(opts?: { target? }) => Promise<boolean>` | Prints the report. Returns whether nothing failed. |
| `clean` | `(opts?: { target? }) => Promise<void>` | One target at once. With no target, it asks first and then wipes `projectDir`. |

## Events

None emitted. It hooks `native:phase`, `native:complete` and `doctor:check`.

## Depends on

- [project](/docs/native/plugins/project/), [tauri](/docs/native/plugins/tauri/), [build](/docs/native/plugins/build/), [doctor](/docs/native/plugins/doctor/).

## Example

```ts file="scripts/native-release.ts" check
import { native } from "../src/native";

await native.start();

await native.cli.build({ all: true }); // [!note] Every target in `config.targets`, in order. The first failure stops the run.
await native.cli.build({ target: "android", aab: true });
await native.cli.clean({ target: "android" });

await native.stop();
```

:::gotchas
- **`doctor` does not set the exit code.** Do `if (!ok) process.exitCode = 1` in your script.
- **`clean()` with no target asks first.** Pass a target to skip the question.
:::

## Related

- [build](/docs/native/plugins/build/): the same flags with a result you can read.
