---
title: project
description: "The capability registry and every generated file. Owns the tree, never spawns a process."
section: Plugins
kind: node
order: 13
---

## What it does

`project` turns the config into files: `tauri.conf.json`, capability JSON, `Cargo.toml`, `lib.rs`, the
`Info.ios.plist` sidecar and the mobile patches. It never spawns a process.

## How it works

**The writer.** Generators write through a write-if-changed writer, so a second run changes nothing.
The tree reproduces itself.

**Mobile.** `tauri ios init` and `tauri android init` run once. `patchMobile` then keeps the kept tree
in line with the config on each build, and the pass is idempotent.

**A smaller store build.** Every `Cargo.toml` carries a size-tuned `[profile.release]`. A store build also
sets `build.removeUnusedCommands`.

**A full-screen iOS page.** The generated `lib.rs` sets the web view's scroll view so UIKit does not
shrink the page by the safe area. CSS `env(safe-area-inset-*)` still reports the notch.

**The guards.** `clean()` refuses a `projectDir` that is not derived state: it must sit strictly inside
the project anchor or a temp root, and must not contain the anchor, the working directory or home.
`createApp` checks the same rule up front.

## The shell

`shell` is the one capability that is not a Tauri plugin. `system: [{ name: "shell" }]` generates a
local crate, `tauri-plugin-moku-shell`, whose init script installs a frozen `globalThis.__MOKU_NATIVE__`
before the page's scripts run. It is **Android only**. A browser, iOS, or an app without it has no
`__MOKU_NATIVE__`, so keep a fallback.

| Member | What the page gets |
|---|---|
| `display.setFrameRate(fps \| null)`, `display.maxHz` | The slowest display mode at or above `fps`. `null` restores the default. |
| `thermal.read()` | Thermal status and headroom, with a `moku-native:thermal` event on `window`. |
| `insets.current` | Safe-area insets in CSS px, mirrored to `--moku-device-safe-top`, `-right`, `-bottom`, `-left`, with a `moku-native:insets` event. |
| `device`, `ready` | Model, manufacturer and SDK level, once `ready` resolves. It never rejects. |
| `build` | `{ profile: "release" \| "debug", id }`, fixed at generate time. |
| `share(file)` | Debug builds only. Writes the bytes to the cache and opens the share sheet. |

## Config

None of its own. It reads the global config.

## API

Mounted at `app.project`.

| Method | Description |
|---|---|
| `generate({ target, profile? })` | Writes every artifact of a target. Returns which paths were written or left alone. |
| `getCompleteness({ target })` | `not-applicable`, `not-initialized`, `incomplete` with the missing paths, or complete. |
| `getRequiredFiles({ target })` | The file set a `gen/` tree must carry. |
| `patchMobile({ target, runner?, profile? })` | The idempotent mobile pass: signing, runner, orientation, deployment target, privacy manifest. |
| `patchMobileIcons({ target })` | Applies `app.adaptiveIconInset` after `tauri icon`. |
| `ensureIconSource()` | The path of `app.icon`, or a generated placeholder. Throws when `app.icon` names no file. |
| `detectPageAgent()` | Scans the built page's `.js` for the editor agent. `{ agent, file? }`. |
| `checkShellLinked({ target, profile? })` | Fails when a tree predates the shell, with the fix. |
| `getBundleLayout({ target })` | Where a target's output lands in the project. |
| `clean({ target? })` | Deletes derived state. Returns what was removed. |
| `clearMobileBuildOutput({ target })` | Empties `gen/apple/build` before an iOS compile. |
| `resolveDerivedPath(target)` | The comparable real path the guards use. |
| `resolve(name, config?)` | One registry row with its config applied. |
| `isKnownCapability(name)` | Narrows a plain string to a capability name. |
| `getRegistryRows()` | Fresh copies of every row. `npmPackage` and `crate` are optional: `tray` and `back` have neither. |
| `getDebugKeystore()` | The debug keystore's path and the command that creates it. |

## Events

None.

## Depends on

Nothing. `build`, `doctor` and `cli` depend on it.

## Example

```ts file="scripts/native-inspect.ts" check
import { native } from "../src/native";

await native.start();

const generated = await native.project.generate({ target: "macos" });
console.log(generated);

for (const row of native.project.getRegistryRows()) {
  console.log(row.name, row.crate ?? "no crate", row.permissions);
}

console.log(native.project.getCompleteness({ target: "ios" }));

await native.stop();
```

:::gotchas
- **Do not edit `.moku/tauri/`.** The next build overwrites it. If the config has no field for what you need, that is the gap to report.
- **Do not replace `pluginConfigs.env.providers`.** The framework seeds a provider there so `PATH` resolves. Core config is a shallow merge, so your own list removes it, and every build dies with `Could not locate a node binary`. Add yours beside `workerSafeProcessEnv()`.
- **A tree from before the shell needs a clean.** `checkShellLinked` tells you so after the compile.
:::

## Related

- [How it works](/docs/native/how-it-works/): the registry table.
- [@moku-labs/system](/docs/system/): the plugins these names belong to.
