---
title: cli
description: "Node-only. The dev and deploy verbs for your scripts, with live progress and no stack traces."
section: Plugins
kind: node
order: 29
---

## What it does

**Node-only.** `cli` is the surface your scripts call. Each verb hands the work to
[deploy](/docs/worker/plugins/deploy/) and adds the branded output: a banner, live phases, and one
clean error line with a non-zero exit code instead of a stack trace.

## How it works

There is no `bin` and no argument parser for you to configure. Your script decides which verb to call.
The single flag read here is `--stage <name>` or `--stage=<name>`, from `process.argv`, as the fallback
for `dev`, `deploy` and `seed`. Precedence: `opts.stage`, then the flag, then `config.stage`.

`onInit` replaces the app's log sinks with the branded one. This is one more reason to keep `cli` in a
Node-side app.

Slow phases animate a spinner on a terminal. Off a terminal every phase is a plain line, which suits CI.

## Config

None. `pluginConfigs.cli` takes no keys. The dev port is an argument of `dev`.

## API

Mounted at `app.cli`.

| Method | Signature | Description |
|---|---|---|
| `dev` | `(opts?: { port?, stage?, webBuild?, onChange?, seed? }) => Promise<void>` | The local session. The port is `opts.port`, or 8787. A `--port` flag is not read. |
| `deploy` | `(opts?: { ci?, stage?, webBuild?, migration?, seed?, delete? }) => Promise<DeployReport>` | The pipeline. Never throws: a failure comes back as `status: "failed"`. `delete: true` tears the stage down and ignores the rest. |
| `seed` | `(sqlFile: string, opts?: { binding?, remote? }) => Promise<void>` | Runs a SQL file on D1, local by default. |
| `auth` | `(sub?: "setup") => Promise<void>` | Verifies the token. `"setup"` prints which tokens to create, for local and for CI. |
| `doctor` | `() => Promise<void>` | One report: the token, then the plan against the account. |
| `whoami` | `() => Promise<void>` | Prints the account of the token. |
| `wrangler` | `(args: string[]) => Promise<void>` | Runs any wrangler command with its output. |

`dev` takes two build hooks. `webBuild` is the cold build, and also the rebuild on each change when
`onChange` is absent. `onChange` gets the changed paths, for an incremental rebuild.

`manifest` is not on `cli.deploy`. To ship from your own manifest, call `app.deploy.run({ manifest })`.

## Events

### Emits

None.

### Listens to

| Event | What it does |
|---|---|
| `deploy:phase` | Prints the phase, or a spinner for `upload` and `deploy` on a terminal. |
| `deploy:complete` | Settles the spinner. The deploy prints the summary panel. |
| `dev:phase` | Prints the phase. |
| `dev:rebuilt` | Prints the file count and the time. |
| `dev:error` | Prints a warning. |

## Depends on

- [deploy](/docs/worker/plugins/deploy/): every verb. So `cli` comes after `deploy`, and after the five resource plugins `deploy` needs.

## Example

```ts file="scripts/cli.ts" check
import {
  cliPlugin,
  createApp,
  d1Plugin,
  deployPlugin,
  durableObjectsPlugin,
  kvPlugin,
  queuesPlugin,
  storagePlugin
} from "@moku-labs/worker";

const tools = createApp({
  plugins: [storagePlugin, kvPlugin, d1Plugin, queuesPlugin, durableObjectsPlugin, deployPlugin, cliPlugin],
  config: { name: "tasks", compatibilityDate: "2026-06-17" },
  pluginConfigs: {
    d1: { main: { name: "tasks-db", binding: "DB", migrations: "db/migrations" } },
    deploy: { entry: "src/worker.ts", nodeCompat: true }
  }
});

const [command, argument] = process.argv.slice(2); // [!note] The script owns its arguments.

if (command === "dev") await tools.cli.dev({ port: 7878 });
else if (command === "deploy") await tools.cli.deploy({ ci: process.argv.includes("--ci"), migration: true });
else if (command === "destroy") await tools.cli.deploy({ delete: true });
else if (command === "seed") await tools.cli.seed(argument ?? "db/seed.sql");
else if (command === "doctor") await tools.cli.doctor();
else await tools.cli.auth("setup");
```

```sh terminal title="use it"
$ bun scripts/cli.ts dev --stage dev
$ bun scripts/cli.ts deploy --stage staging
$ bun scripts/cli.ts doctor
```

:::gotchas
- **`deploy` returns, even on failure.** Check `report.ok`, or rely on `process.exitCode`. An aborted deploy keeps exit code 0, because stopping was your choice.
- **`auth`, `doctor` and `whoami` do not set an exit code.** They print a failure and resolve. Use `app.deploy.verifyAuth()` in a script that must stop.
- **`--stage` is not read by `doctor`.** It reports on `config.stage`.
- **The verbs are not commands.** `bun scripts/cli.ts dev` works because your script maps the word to the verb.
:::

## Related

- [Build & deploy](/docs/worker/guides/deploy/): the scripts in context.
- [deploy plugin](/docs/worker/plugins/deploy/): config and the report.
