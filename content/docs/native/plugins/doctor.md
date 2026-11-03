---
title: doctor
description: "Per-target toolchain diagnosis, run in parallel. One broken check never sinks the report."
section: Plugins
kind: node
order: 12
---

## What it does

`doctor` tells you what is missing for a target, before a build fails on it. Each problem comes with a
fix-it. It checks that secret env vars exist without reading their values.

## How it works

Applicable checks run in parallel, and the report keeps registry order. A check that throws becomes a
`fail`. A check that outruns `probeTimeoutMs` becomes a `warn`. A `warn` does not flip `report.ok`, a
`fail` does.

| Check | Scope | Worst status | Looks at |
|---|---|---|---|
| `node-binary` | host | fail | A real `node` on `PATH`. |
| `tauri-cli` | host | fail | The CLI answers. |
| `tauri-version-skew` | host | warn | `@tauri-apps/*` in `package.json` against the crate majors. |
| `web-script` | host | fail | `web.build` and `web.devCommand` name real scripts. |
| `cross-repo-cors` | host | warn | A reminder: the packaged origins belong in your server's CORS allowlist. |
| `cross-repo-deep-link-well-known` | host, with `deep-link` | warn | A reminder about `.well-known` files if you later leave scheme mode. |
| `rustup-targets` | each target | fail | The Rust triple is installed. |
| `signing` | signing targets | warn | Credentials are present. Unsigned builds stay legal. |
| `xcode-toolchain` | iOS | fail | `xcodebuild` and `simctl`. |
| `ios-tools` | iOS on a Mac | fail | Rust iOS triples, `xcodegen`, `pod`. |
| `ios-platform` | iOS on a Mac | warn | An installed iOS platform and simulator. |
| `android-toolchain` | Android | fail | `ANDROID_HOME`, `ANDROID_NDK_HOME`, `java`. |
| `android-platform` | Android | fail | The SDK platform of `compileSdk`. |
| `android-debug-signing` | Android | warn | The debug keystore exists. |
| `gen-completeness` | iOS, Android | fail | The `gen/` tree is not half-written. A tree not yet created passes: the first build creates it. |

## Config

`pluginConfigs.doctor`.

| Option | Type | Default | Description |
|---|---|---|---|
| `probeImpl` | `(cmd, args) => Promise<{ code, stdout }>` | real subprocesses | Test seam. |
| `probeTimeoutMs` | `number` | `10000` | Budget per check. |

## API

Mounted at `app.doctor`.

| Method | Signature | Description |
|---|---|---|
| `run` | `(opts?: { target? }) => Promise<DoctorReport>` | One target, or every configured target plus the host checks. |

`DoctorReport` is `{ ok, checks }`. Each `CheckResult` is `{ id, target, status, message, fixIt? }`.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `doctor:check` | `CheckResult` | As each check settles. Hook it with `depends: [doctorPlugin]`. |

### Listens to

None.

## Depends on

- [project](/docs/native/plugins/project/) and [tauri](/docs/native/plugins/tauri/).

## Example

```ts file="scripts/native-check.ts" check
import { native } from "../src/native";

await native.start();

const report = await native.doctor.run({ target: "android" });
for (const check of report.checks) {
  if (check.status !== "pass") console.log(check.id, check.message, check.fixIt);
}

await native.stop();
if (!report.ok) process.exitCode = 1;
```

:::gotchas
- **`signing` never fails.** A green report does not mean a build can be shipped to a store.
- **A target scope skips host checks.** `run({ target })` diagnoses that target only. Call `run()` for the whole picture.
:::

## Related

- [cli](/docs/native/plugins/cli/): the same report, rendered.
