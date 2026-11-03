---
title: Signing and store builds
description: "Config holds identifiers and env var names. The environment holds the secrets."
section: Guides
order: 10
---

## How it fits together

Tauri reads the credentials itself. So nothing secret reaches `tauri.conf.json`, Gradle or a log line.
Unsigned dev builds and simulator builds need none of this, and `doctor` only warns about it.

## Example

```ts file="src/native.ts" check
import { createApp } from "@moku-labs/native";

export const native = createApp({
  config: {
    app: {
      name: "MyApp",
      identifier: "com.example.myapp",
      buildNumber: "42", // [!note] On Android this becomes `versionCode`, so it must be a whole number.
      category: "Productivity"
    },
    targets: ["macos", "ios", "android"],
    signing: {
      apple: {
        teamId: "ABCDE12345",
        signingIdentity: "Developer ID Application: ACME (ABCDE12345)", // [!note] `-` means ad-hoc.
        providerShortName: "ACME",
        appStore: true,
        exportMethod: "app-store-connect"
      },
      android: {
        keystorePath: "release.jks",
        keystorePasswordEnv: "ANDROID_KEYSTORE_PASSWORD", // [!note] The name of a variable, never its value.
        keyPasswordEnv: "ANDROID_KEY_PASSWORD",
        keyAlias: "release"
      }
    }
  }
});
```

## What goes in the environment

| Variables | For |
|---|---|
| `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | Notarization with an app-specific password. |
| `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH` | Notarization with an App Store Connect API key. Either set is enough. |
| `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD` | A base64 certificate imported into a CI keychain. |
| The names in `keystorePasswordEnv`, `keyPasswordEnv` | Android release signing. `keyPasswordEnv` falls back to `keystorePasswordEnv`. |

## What each field does

| Field | Effect |
|---|---|
| `apple.teamId` | `bundle.iOS.developmentTeam`. `doctor` warns on an iOS target without it. |
| `apple.signingIdentity` | `bundle.macOS.signingIdentity`. `doctor` counts keychain identities, and never reads their names. |
| `apple.providerShortName` | Notarization on an account with several teams. |
| `apple.entitlements` | Your plist, relative to the working directory. |
| `apple.appStore` | With no `entitlements`, generates a sandbox plist for macOS. |
| `apple.exportMethod` | `tauri ios build --export-method`: `app-store-connect`, `release-testing` or `debugging`. A simulator build ignores it. |
| `apple.macosMinimumSystemVersion` | The macOS floor. |
| `apple.iosMinimumSystemVersion` | The iOS floor, default `"15.0"`. A kept tree follows it. |
| `android.keystorePath` | Keeps a `// MOKU-SIGNING-START` block in `build.gradle.kts`. Dropping it removes the block. |
| `windows.certificateThumbprint` | The Windows signing certificate. |

## Build for a store

```ts file="scripts/native-store.ts" check
import { native } from "../src/native";

await native.start();
await native.cli.build({ target: "android", aab: true }); // [!note] Play wants the `.aab`. The default is an installable `.apk`.
await native.cli.build({ target: "ios" });
await native.stop();
```

An iOS store app usually needs `ios.privacyManifest` too. Give it an absolute path. `ios.infoPlist` adds
any other keys, such as an encryption declaration.

:::gotchas
- **A store build refuses a page with the editor agent.** Use the [dev profile](/docs/native/guides/profiles/) for a TestFlight build that carries it.
- **Android refuses a dotted `buildNumber`.** It is checked at generate. It stays legal on other targets.
- **`doctor` is warn-only here.** A green report does not prove the credentials work.
:::

## Related

- [Build profiles](/docs/native/guides/profiles/): the test builds.
- [doctor plugin](/docs/native/plugins/doctor/): the `signing` check.
