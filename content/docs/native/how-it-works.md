---
title: How it works
description: "A list of names becomes a generated Tauri project, and six phases turn it into installers."
section: Get started
order: 3
---

## The picture

:::flow
- cli
- build
- project
- tauri
- dist-native/
:::

`cli` fronts the rest. `build` orchestrates `project` and `tauri`, which never call each other.
`doctor` reads both. Only `tauri` spawns processes, so every subprocess line goes through one scrubber.

## The six phases

`build.run({ target })` walks `PHASE_ORDER`, emitting `native:phase` for each.

:::steps
1. **scaffold.** Creates `projectDir`.
2. **codegen.** `project.generate` writes the Tauri project through a write-if-changed writer. On a mobile target with no `gen/` tree, `tauri ios init` or `tauri android init` runs once. A half-written tree fails here, and is never initialized again by itself. Then `patchMobile` patches the tree.
3. **icons.** `tauri icon` expands `app.icon`, or a generated placeholder, into every platform's set.
4. **compile.** `tauri build`, which also runs `web.build`. Progress carries real crate counts from cargo.
5. **bundle.** The second half of `tauri build`, from its first "bundling" line. A store build whose page carries the editor agent is refused after it.
6. **collect.** Finished files are copied to `<outDir>/<target>/`, and `native:complete` is emitted.
:::

## The composition is the contract

`config.system` is a list of names. `project` resolves each against its registry:

| Name | Package and crate | Platforms | System plugin |
|---|---|---|---|
| `store` | `tauri-plugin-store` | all | [store](/docs/system/plugins/store/) |
| `notification` | `tauri-plugin-notification` | all | [notify](/docs/system/plugins/notify/) |
| `clipboard-manager` | `tauri-plugin-clipboard-manager` | all | [clipboard](/docs/system/plugins/clipboard/) |
| `tray` | none, a Cargo feature | desktop | [tray](/docs/system/plugins/tray/) |
| `deep-link` | `tauri-plugin-deep-link` | all | [deep-link](/docs/system/plugins/deep-link/) |
| `back` | none, a permission | Android | [back](/docs/system/plugins/back/) |
| `haptics` | `tauri-plugin-haptics` | iOS, Android | [haptics](/docs/system/plugins/haptics/) |
| `shell` | a generated local crate | Android | none, see [project](/docs/native/plugins/project/) |

A row is filtered out on a platform it does not support, so one list serves every target. Mobile
permissions need no patched XML: the official plugins merge their own manifest needs.

## Two folders

| Config | Default | What it is |
|---|---|---|
| `projectDir` | `.moku/tauri` | The generated project. Delete it, and the next build writes it again. |
| `outDir` | `dist-native` | Finished installers, one folder per target. |

| Target | `dist-native/<target>/` holds |
|---|---|
| `macos` | `.dmg`, `.app` |
| `windows` | `-setup.exe`, `.msi` |
| `linux` | `.AppImage`, `.deb`, `.rpm` |
| `ios` | `.ipa`, or a `.app` folder for the simulator |
| `android` | `.apk`, or `.aab` with `aab: true` |

## Two apps, side by side

Plugins are bound to their own framework, so native plugins can never enter your web app. The two
meet at the edges: one shared list of names, and `web.build` and `web.dist` in the config.

The packaged page's origin depends on the platform. Add both to any server CORS allowlist:

| Platform | `location.origin` |
|---|---|
| Android, Windows | `http://tauri.localhost` |
| iOS, macOS, Linux | `tauri://localhost` |

## When a build fails

A non-zero exit of the Tauri CLI throws `TauriError`, with `kind`, `exitCode` and a scrubbed
`stderrTail`. Classification reads the cause lines only, so one stray `CodeSign` line in a long log
does not decide it.

| `kind` | Means |
|---|---|
| `xcode-script-failed` | The Xcode "Build Rust Code" phase failed. Check the runner line in `gen/apple/project.yml`. |
| `signing-failed` | codesign, a provisioning profile, notarization, the keychain, signtool, jarsigner or the keystore. |
| `toolchain-missing` | `command not found`, `xcode-select`, `ANDROID_HOME`, a missing NDK, `rustup`. |
| `platform-missing` | The iOS platform is not installed. |
| `device-unavailable` | No device or booted simulator. |
| `config-invalid` | Tauri could not read the generated `tauri.conf.json`. |
| `compile-failed` | Rust compile errors. |
| `cancelled` | Stopped by a signal, usually Ctrl-C. |
| `unknown` | Nothing matched. Read the tail. |
