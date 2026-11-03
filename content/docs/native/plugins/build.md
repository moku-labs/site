---
title: build
description: "The per-target pipeline: six phases, typed events, and the delivery into dist-native/."
section: Plugins
kind: node
order: 11
---

## What it does

`build` runs one target through `scaffold`, `codegen`, `icons`, `compile`, `bundle` and `collect`. It
emits progress and returns where the artifacts landed.

## How it works

Targets run one after another, and the first failure stops the run. `collect` resolves `outDir` and each
destination to real paths before it removes anything, so a symlinked `<outDir>/<target>` pointing into
another tree is refused, not wiped.

Up-front refusals, before the first phase:

```text
[native] --debug builds Android and iOS only for now (asked for macos).
[native] debug and dev cannot be combined.
```

A store build whose page carries the editor agent fails before `collect`:

```text
[native] store build refused: the page carries the editor agent (<dist>/<file>).
```

## Config

None of its own. It reads the global config.

## API

Mounted at `app.build`.

| Method | Signature | Description |
|---|---|---|
| `prepare` | `(opts: { target; debug? }) => Promise<void>` | Runs scaffold, codegen and icons, and stops. `dev` uses it. |
| `run` | `(opts: BuildFlavor & { target }) => Promise<BuildResult>` | The whole pipeline for one target. |
| `runAll` | `(opts?: BuildFlavor & { targets? }) => Promise<readonly BuildResult[]>` | Every target, by default `config.targets`. |

| Flag | Target | Effect |
|---|---|---|
| `simulator` | iOS | The host's simulator slice, not a signed archive. |
| `aab` | Android | A store bundle, not an `.apk`. |
| `debug` | iOS, Android | The [debug profile](/docs/native/guides/profiles/). |
| `dev` | any | The [dev profile](/docs/native/guides/profiles/). |

A flag a target does not use is ignored. `BuildResult` is `{ target, outPath, artifacts, durationMs, phases, profile }`.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `native:phase` | `{ target, phase, status, durationMs?, detail? }` | `status` is `start`, `progress`, `done` or `error`. `detail` carries ticks like `Compiling tauri 3/50`, never a made-up percentage. |
| `native:complete` | `{ target, outPath, artifacts, durationMs, profile }` | After a successful `collect`. |

### Listens to

None.

## Depends on

- [project](/docs/native/plugins/project/) and [tauri](/docs/native/plugins/tauri/).

## Example

```ts file="scripts/native-ci.ts" check
import { native } from "../src/native";

await native.start();

const results = await native.build.runAll({ targets: ["android"], aab: true });
for (const result of results) {
  console.log(result.outPath, result.artifacts, result.profile);
}

await native.stop();
```

:::gotchas
- **`compile` runs `web.build`.** Do not build the page first. Tauri runs it, with `MOKU_NATIVE_PROFILE` in the environment.
- **`prepare` takes no `dev`.** A dev build is only ever a full `run`.
:::

## Related

- [How it works](/docs/native/how-it-works/): each phase in order.
