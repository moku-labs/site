---
title: Native
description: "The system shell, the store save, the phone through the platform plugin, and the native builds for iOS, Android and macOS."
section: Guides
order: 20
---

## Two optional peers

A game imports no native package. It names what it needs in `config.ts`, and the engine page wires
it. A web-only game installs neither peer.

| Package | When | Install |
|---|---|---|
| `@moku-labs/system` | `config.ts` names a `system` plugin, or `save` is `"store"` | `bun add @moku-labs/system` |
| `@moku-labs/native` | `moku-game native …` | `bun add -d @moku-labs/native` |

The `native-imports` [lint rule](/docs/game/guides/lint/) keeps both out of the logic, the root
`index.ts`, `config.ts` and `plugins/`.

## The system shell

`system` in `config.ts` names the system plugins the page wires:

| Name | The engine gets |
|---|---|
| `lifecycle` | Pause and resume: the `"background"` reason of `lifecycle`. |
| `back` | The hardware Back press and `exit()`. |
| `haptics` | The `haptic` effect. |
| `keepAwake` | The screen wake lock while the game runs. |
| `store` | The store save. Also wired when `save` is `"store"`. |

The generated `main.ts` imports `systemShellOf` from `@moku-labs/game/app/system` only when
`system` is not empty or `save` is `"store"`. It writes one `import()` for the package and one per
named plugin, so the page bundles only those. A game with `system: ["haptics"]` and a memory save
builds without the Tauri store plugin.

A game that builds its own shell takes the parts from `@moku-labs/game/app/system`:

```ts file="shell.ts" check
import { createSystemApp, fromSystem } from "@moku-labs/game/app/system";
import game from "./index";

const system = await createSystemApp(["lifecycle", "back", "haptics"], "com.example.dice", {
  system: () => import("@moku-labs/system"),
  lifecycle: () => import("@moku-labs/system/lifecycle"),
  back: () => import("@moku-labs/system/back"),
  haptics: () => import("@moku-labs/system/haptics")
});
await system.start();

const { app } = game.screen({ platform: fromSystem(system) }); // [!note] Back, pause and haptics reach the system app through the platform seam.
```

`storeSave(store, key, report)` makes the save provider over a system store, for the `provider`
seam. A store save that cannot be read rejects the load: the game never starts over a real save
as a new player.

## The phone: the platform plugin

`platform` is opt-in and last in the plugin list; `game.screen()` composes it and takes the
provider as its `platform` seam. Without a provider it is inert: a `haptic` effect resolves at
once, so the same node runs on the web and headless.

| Member | Does |
|---|---|
| `app.platform.back()` | The Back chain. First Escape: a popup with an `escape` button closes, `"popup"`. Then the intent `back` when the resting node lists it, `"intent"`. Then `provider.exit()`, `"exit"`. Without a provider, `"none"`. |
| `app.platform.exit()` | The last step alone, for a Leave button. |

A Leave button is an effect the game's plugin answers:

```ts file="plugins/leave.ts" check
import { createPlugin, flowPlugin, platformPlugin } from "@moku-labs/game";

export const leavePlugin = createPlugin("leave", {
  depends: [flowPlugin, platformPlugin],
  onStart: ctx => {
    ctx.require(flowPlugin).fx.handle("exit", () => ctx.require(platformPlugin).exit()); // [!note] A throw is logged. Without a provider `exit()` does nothing.
  }
});
```

Haptics are an effect: `await fx(haptic("success"))` in a node, or `haptic("light")` as a
timeline step. The kinds are `HAPTIC_KINDS`: `light`, `medium`, `heavy`, `selection`, `success`,
`warning`, `error`. A fast walk is silent.

## The native app

`native` in `config.ts` names the app. Left out, the game has no native build.

```ts file="config.ts" check
import type { GameConfig } from "@moku-labs/game/app";

export default {
  page: { title: "Dice", background: "#10161d", orientation: "portrait" },
  native: {
    name: "Dice",
    identifier: "com.example.dice",
    icon: "assets/icon.png", // [!note] A 1024 px PNG, relative to the game folder.
    signing: {
      android: { keystorePath: "~/keys/upload.jks", keystorePasswordEnv: "DICE_KEYSTORE_PASSWORD", keyAlias: "upload" }, // [!note] Env var names only, never a secret.
      apple: { teamId: "ABCDE12345" }
    },
    ios: { infoPlist: { ITSAppUsesNonExemptEncryption: false } },
    dev: { identifier: "com.example.dice.dev" }
  },
  system: ["lifecycle", "back", "haptics", "keepAwake"],
  save: "store"
} satisfies GameConfig;
```

| Key | What |
|---|---|
| `name`, `identifier` | The app name under the icon and the bundle identifier, reverse DNS. |
| `icon` | A 1024 px PNG. A placeholder by default. |
| `targets` | `ios`, `android`, `macos`. The target of the command by default. |
| `signing.android` | `keystorePath`, `keystorePasswordEnv`, `keyPasswordEnv?`, `keyAlias`. |
| `signing.apple` | `teamId`. Keys stay in the env; Tauri reads them. |
| `ios` | `minimumVersion`, `infoPlist`, `privacyManifest`. |
| `dev` | The test app of `--store --dev`: `identifier` ending in `.dev`, `name?`, `icon?`. |

`moku-game native` maps this to the config of `@moku-labs/native`: name, identifier and icon from
`native`; orientation and background colour from `page`; the web build is `moku-game build`, the
dev server `moku-game dev --port 5173`; one system row per name that needs a capability, `back`,
`haptics`, `store`. The Tauri project lives in `.moku/tauri`, the apps in `dist-native`.

## Build it

```json file="package.json"
{
  "scripts": {
    "native:ios-sim": "moku-game native build ios --simulator"
  }
}
```

| Command | Does |
|---|---|
| `moku-game native build <target> [--simulator]` | Builds the app: `ios`, `macos`, `android`. |
| `moku-game native build <android\|ios> --debug [--editor host:port]` | A debug app beside the store app, with the editor's agent. |
| `moku-game native build <ios\|android> --store --build-number <n>` | A store build: an `.aab` on Android, an `.ipa` for App Store Connect on iOS. |
| `moku-game native build <ios\|android> --store --dev --build-number <n>` | The test app of `native.dev`: store-signed, under its own `.dev` id, with the overlay, in `dist-native-dev`. |
| `moku-game native dev <target>` | Runs the native shell on the dev server. |
| `moku-game native doctor`, `native clean` | Checks or removes the native project. |

A store build takes the version from `package.json` and the build number from the flag, one number
for both stores. Everything wrong is refused at once, before anything compiles, in one
`[game] native --store: …` error with a line per problem: a missing signing block, a keystore that
is not a file, an unset password variable, a version that is not `x.y.z`, an identifier that ends
in `.soak`, `.debug`, `.dev`, `.test` or `.staging`.

:::gotchas
- **Keep `.moku/` in `.gitignore`.** The Tauri projects are generated there: `.moku/tauri`, and `.moku/tauri-dev` and `.moku/tauri-debug` for the test and debug apps.
- **A game has no `native.ts`, no `platform-bridge.ts` and no `web/`.** The engine page wires the shell from `config.ts`.
- **`--store` refuses `--debug`, `--editor` and `--simulator`.** A store build is never a debug build.
- **Without `native` in `config.ts`** every `moku-game native` verb stops: `[game] config.ts has no native section.`
:::

## Related

- [platform plugin](/docs/game/plugins/platform/): the provider, the Back chain, keep-awake.
- [The game shell](/docs/game/guides/game-shell/): every key of `config.ts`, the page.
- [State & save](/docs/game/guides/state-and-save/): the save kinds.
