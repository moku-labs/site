---
title: iOS simulator
description: "An unsigned .app for the simulator, the tools it needs, and why rebuilds work."
section: Guides
order: 12
---

## How it fits together

`simulator: true` builds the host's simulator slice. It never exports an archive, and it collects the
`.app` folder instead of an `.ipa`. No Apple account is needed.

## Example

```ts file="scripts/native-sim.ts" check
import { native } from "../src/native";

await native.start();

const ok = await native.cli.doctor({ target: "ios" });
if (ok) await native.cli.build({ target: "ios", simulator: true }); // [!note] An unsigned `.app` in `dist-native/ios/`.

await native.stop();
```

## What it needs

`doctor` checks each of these.

| Need | Install | Check |
|---|---|---|
| Rust targets | `rustup target add aarch64-apple-ios aarch64-apple-ios-sim` | `ios-tools` (fail) |
| `xcodegen` | `brew install xcodegen` | `ios-tools` (fail) |
| CocoaPods | `brew install cocoapods` | `ios-tools` (fail) |
| An iOS platform and simulator | `xcodebuild -downloadPlatform iOS` | `ios-platform` (warn) |

## What the first build does

It runs `tauri ios init` once. Then it rewrites the build phase Tauri put in the Xcode project: that
phase calls whichever runner Tauri detected, and none resolve inside Xcode. `patchMobile` puts in the
absolute `node` and `tauri.js` pair instead.

## Rebuilds

Building a kept tree again would fail twice over. The packager handles both.

| Failure | Handled by |
|---|---|
| `Entitlements file … was modified during the build` | `patchMobile` writes `CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION` into the Xcode project and `project.yml`. |
| `failed to rename app … Directory not empty` | The compile phase removes `gen/apple/build` first. A `build` symlink out of `projectDir` is refused. |

A kept tree also follows the config. `tauri ios build` never runs xcodegen on it, so each `patchMobile`
writes `iosMinimumSystemVersion` and `ios.privacyManifest` into both project files.

:::gotchas
- **On an Intel Mac the slice is `x86_64`.** Tauri's Intel simulator slice carries no `-sim` suffix.
- **`exportMethod` is ignored here.** It only applies to device archives.
- **`clean({ target: "ios" })` removes `gen/apple`.** The next build runs init again.
:::

## Related

- [doctor plugin](/docs/native/plugins/doctor/): every check.
- [Build profiles](/docs/native/guides/profiles/): `debug: true` works with `simulator: true`.
