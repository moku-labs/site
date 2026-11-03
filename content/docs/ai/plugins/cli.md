---
title: cli
description: "The moku bin: seven commands, the project config and an exit-code contract."
section: Pipeline
order: 14
---

## What it does

The package ships the `moku` bin. It loads the project config, calls `createApp`, `start`,
`app.cli.dispatch(argv)` and `stop`, then exits with the returned code.

## Commands

| Command | What it does |
|---|---|
| `moku new [name]` | Writes `<name>.moku.yaml` and its JSON Schema. Default name: `build`. Refuses to overwrite. |
| `moku validate [glob]` | Compiles every match. Offline, no keys. |
| `moku estimate [glob]` | Cost per task and provider, and the total. No key needed. |
| `moku run [glob]` | Runs the matches, with live progress, then exports the done artifacts. |
| `moku export [runId]` | Copies a run's artifacts to named files. Default: the newest run. |
| `moku status [runId]` | One snapshot, or a poll each second. Safe from a second process. |
| `moku compose "<prompt>"` | Generates a build file. |

| Flag | On | Description |
|---|---|---|
| `--max-cost <usd>` | `run` | The budget ceiling. A bad value exits 3. |
| `--dry-run` | `run` | Plans and prints the estimate. |
| `--out <dir>` | `run`, `export` | Export folder. Default `out`. |
| `--flat` | `run`, `export` | No `<build>/` folder. |
| `--follow` | `status` | Polls until the run ends. |
| `--emit build\|script` | `compose` | The output format. Default `build`. |
| `--out <path>` | `compose` | The file to write. Default: stdout. |
| `--config <path>` | all | The project config to load. |

```sh terminal title="a session"
$ moku compose "narrate a sunset in 3 languages" --out sunset.moku.yaml
$ moku validate
$ moku estimate
$ moku run --max-cost 5 --out assets/audio
$ moku status --follow
```

## Exit codes

`Cli.EXIT_CODES` holds these names.

| Code | Name | Meaning |
|---|---|---|
| `0` | `ok` | Success. |
| `1` | `failure` | A failed run, or any uncaught error. |
| `2` | `validation` | An invalid build file. |
| `3` | `usage` | A bad command, flag or config. |
| `4` | `paused` | Ctrl-C drained to a clean pause. |
| `5` | `budgetStop` | `--max-cost` was reached. |

## Project config

The bin looks in the working directory for `moku.config.ts`, `.mts`, `.js` and `.mjs`, in this
order. The first file wins. `--config <path>` wins over the search. With no file, the defaults apply.

```ts file="moku.config.ts" check
import { defineConfig } from "@moku-labs/ai";

export default defineConfig({
  pluginConfigs: {
    ark: { region: "cn" },
    fal: { upload: "data-uri" },
    runner: { maxAttempts: 5 }
  }
});
```

The default export goes to `createApp` as it is. Only `plugins` and `pluginConfigs` are allowed.
`defineConfig` returns its argument and types it. Node 24 strips the types of a `.ts` file, and Bun
loads it.

A config that does not load prints `[ai] Could not load <path>.` and the reason, then exits 3.

## Config

`pluginConfigs.cli`.

| Option | Type | Default | Description |
|---|---|---|---|
| `plain` | `boolean` | `false` | Plain output. Also on when stdout is not a TTY or `NO_COLOR` is set. |

## API

Mounted at `app.cli`, reachable with `ctx.require(cliPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `dispatch` | `(argv: string[]) => Promise<number>` | Runs one command and returns its exit code. It does not exit the process. |
| `commands` | `() => CommandTree` | The commands and flags as data. |

```ts file="bin.ts" check
import { app } from "./app";

await app.start();
const code = await app.cli.dispatch(["estimate", "**/*.moku.yaml"]);
await app.stop();
process.exit(code);
```

## Events

### Emits

None.

### Listens to

None.

## Depends on

[runner](/docs/ai/plugins/runner/), [buildfile](/docs/ai/plugins/buildfile/), [compose](/docs/ai/plugins/compose/).
