---
title: Build profiles
description: "Store, debug and dev: three builds of one app, and what changes between them."
section: Guides
order: 11
---

## How it fits together

A run picks one profile. All three are optimized release builds, so what you measure on a phone is what
the store app does. The web build sees the choice in `MOKU_NATIVE_PROFILE`.

| | Store (default) | `debug: true` | `dev: true` |
|---|---|---|---|
| For | The store | Your own device | A tester, through TestFlight or a Play track |
| Targets | all | iOS, Android | all |
| Page with the editor agent | refused | allowed | allowed |
| `build.removeUnusedCommands` | `true` | left out | left out |
| `MOKU_NATIVE_PROFILE` | `store` | `debug` | `dev` |
| Delivered to | `<outDir>/<target>/` | `<outDir>/<target>-debug/` | `<outDir>/<target>/` |

## Example

```ts file="scripts/native-phone.ts" check
import { native } from "../src/native";

await native.start();

await native.cli.build({ target: "android", debug: true }); // [!note] Lands in `dist-native/android-debug/`, beside the store build.
await native.cli.build({ target: "android", aab: true, dev: true });

await native.stop();
```

## Debug on Android

Native marks the build so it can never pass for the store app, and installs it next to it.

| | Debug profile |
|---|---|
| Application id | `<app.identifier>.debug` |
| Launcher name | `<app.name> (debug)` |
| Signing | `~/.android/debug.keystore`, alias `androiddebugkey` |
| Network | Cleartext allowed |
| `shell` | Composed even when `system` does not name it |
| Page | `__MOKU_NATIVE__.build.profile === "debug"`, `console.*` forwarded to logcat under the tag `moku-page`, WebView debugging on, `share` present |

Every patch is idempotent, and the next store or dev build reverts each to the bytes before.

## Debug on iOS

Native renames nothing here. The config names the app, and the profile adds three things:

| Added | Effect |
|---|---|
| `NSLocalNetworkUsageDescription` | The local-network prompt. |
| `NSAppTransportSecurity` | `{ NSAllowsLocalNetworking: true }`, so `ws://` reaches a machine on the LAN. It replaces your own value, in this profile only. |
| Web Inspector | `devtools` on the main window and on the `tauri` crate. |

The package README marks this as verified on a simulator only so far.

## Dev

The store build with the agent allowed. Native renames nothing. To get a separate test app, give the
config a different `app.identifier`, `app.name`, `app.icon`, `projectDir` and `outDir`.

```ts file="src/native-dev.ts" check
import { createApp } from "@moku-labs/native";

export const nativeDev = createApp({
  config: {
    app: { name: "MyApp Dev", identifier: "com.example.myapp.dev" },
    projectDir: ".moku/tauri-dev", // [!note] Its own tree: `gen/apple` is never regenerated for a new id.
    outDir: "dist-native-dev"
  }
});
```

:::gotchas
- **`debug` and `dev` cannot be combined.** The pair is refused before the first phase.
- **`debug` on a desktop target throws.** `runAll` checks every target up front and refuses the whole run.
- **A debug build needs the keystore.** With none it fails in `codegen`, with the `keytool` command. `doctor` warns about it in `android-debug-signing`.
- **The page sees `release` for store and dev.** Only `debug` shows in `__MOKU_NATIVE__.build.profile`. Read `MOKU_NATIVE_PROFILE` at web build time to tell them apart.
:::

## Related

- [Signing and store builds](/docs/native/guides/signing/): the store profile.
- [project plugin](/docs/native/plugins/project/): the shell.
