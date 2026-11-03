---
title: tauri
description: "The only subprocess seam: argv builders, process-group dev, error taxonomy, secret scrubbing."
section: Plugins
kind: node
order: 14
---

## What it does

`tauri` is the one place that spawns a process. It builds the arguments for `@tauri-apps/cli`, streams
scrubbed output, classifies failures and owns the lifetime of a dev session.

## How it works

**The runner.** The CLI needs Node, so every verb spawns an absolute `node` and `tauri.js` pair. The first
iOS build writes the same pair into the Xcode project, because Tauri's bare `node tauri` does not resolve
inside Xcode.

**Scrubbing.** Every output line is scrubbed before it can reach a log or a callback. `stderrTail` on a
`TauriError` is already safe.

**Dev.** There is no "ready" line on stdout, so `dev()` polls `web.devUrl`. A second `dev()` while one
runs throws. A stop escalates to a process-group kill.

## Config

`pluginConfigs.tauri`.

| Option | Type | Default | Description |
|---|---|---|---|
| `readiness` | `{ intervalMs, timeoutMs }` | `{ intervalMs: 250, timeoutMs: 60000 }` | The `web.devUrl` poll. |
| `nodePath` | `string` | found on `PATH` | An explicit `node`. |
| `arch` | `NodeJS.Architecture` | `process.arch` | The host arch behind the iOS simulator slice. `x64` gives `--target x86_64`, others `--target <arch>-sim`. |
| `spawnImpl` | `SpawnFn` | a real process-group spawn | Test seam. |

## API

Mounted at `app.tauri`.

| Method | Signature | Description |
|---|---|---|
| `icon` | `(opts: { source }) => Promise<RunResult>` | `tauri icon` into `src-tauri/icons`. |
| `build` | `(opts: BuildOptions) => Promise<RunResult>` | `tauri build`, or the `ios` or `android` form. Takes the flavor flags, `exportMethod`, `onTick`, `onOutput` and `env`. |
| `mobileInit` | `(opts: { target }) => Promise<RunResult>` | `tauri ios init` or `tauri android init`. Only call it when `project.getCompleteness` says `not-initialized`. |
| `dev` | `(opts: { target?, onOutput? }) => Promise<DevHandle>` | Returns at once. `DevHandle` is `{ url, ready, exited, stop() }`. |
| `getVersion` | `() => Promise<{ cliVersion } \| undefined>` | `undefined` when the CLI cannot run. |
| `getRunner` | `() => TauriRunner` | The absolute pair. Throws when `node` or the CLI cannot be found. |

## Events

None. Output comes through the callbacks.

## Depends on

Nothing. It reads `projectDir` and `web.devUrl` from the global config, and `PATH` through `env`.

## Example

```ts file="scripts/native-tail.ts" check
import { TauriError } from "@moku-labs/native";
import { native } from "../src/native";

await native.start();

const handle = await native.tauri.dev({ onOutput: line => console.log(line) });
await handle.ready;
console.log("up on", handle.url);
await handle.stop();

try {
  await native.tauri.icon({ source: "assets/icon.png" });
} catch (error) {
  if (error instanceof TauriError) console.error(error.kind, error.exitCode, error.stderrTail);
}

await native.stop();
```

:::gotchas
- **`tauri.build` is one step.** It does not generate anything. Use `build.run` unless you already have the tree.
- **`env` never changes the arguments.** The debug and dev profiles are still release builds, with no `--debug`.
:::

## Related

- [How it works](/docs/native/how-it-works/): the `TauriError` kinds.
