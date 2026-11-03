---
title: API reference
description: "Every export of @moku-labs/native, with signatures and the full config."
section: API reference
order: 40
---

## Entries

| Import | For |
|---|---|
| `@moku-labs/native` | Everything below. Node only. |

Signatures below are simplified for reading. The installed `dist/index.d.mts` is the source.

## createApp

```ts no-check="a simplified signature; the exports are checked against the package"
function createApp<const ExtraPlugins extends readonly AnyPluginInstance[] = readonly []>(options?: {
  plugins?: ExtraPlugins;
  config?: Partial<Config>;
  pluginConfigs?: { tauri?: Partial<TauriConfig>; doctor?: Partial<DoctorConfig>; cli?: Partial<CliConfig> };
  onReady?: (ctx: AppCallbackContext) => void;
  onError?: (error: Error, ctx: AppCallbackContext) => void;
  onStart?: (ctx: AppCallbackContext) => void | Promise<void>;
  onStop?: (ctx: AppCallbackContext) => void | Promise<void>;
}): App;
```

Creates the native app, with `project`, `tauri`, `build`, `doctor` and `cli` already composed. It
throws at once on a missing `app.name`, a malformed `app.identifier`, an empty `web` field, an unknown
capability, or a `projectDir` or `outDir` it refuses.

## Config

`createApp({ config })`. Every plugin reads it. Config is shallow-merged per key.

| Field | Type | Default | Notes |
|---|---|---|---|
| `app.name` | `string` | `""` | Display name. Required. |
| `app.identifier` | `string` | `""` | Reverse-DNS bundle id. Required. |
| `app.version` | `string` | a starter version | Marketing version. Set it before you ship. |
| `app.icon` | `string` | none | 1024×1024 PNG, relative to the working directory. Unset: a placeholder is generated. |
| `app.category` | `string` | none | Store category. |
| `app.buildNumber` | `string` | none | Store build number. On Android, a whole number from 1 to 2100000000. |
| `app.orientation` | `"portrait" \| "landscape" \| "any"` | none | Build-time mobile orientation lock. |
| `app.backgroundColor` | `string` | none | Hex window colour during launch. On Android it also paints the splash, and the status bar icons follow it. |
| `app.adaptiveIconInset` | `number` | none | Android adaptive icon inset, percent per side, above 0 and up to 30. `19.44` keeps art in the safe zone. |
| `app.keepScreenOn` | `boolean` | none | iOS turns the idle timer off at launch. |
| `web.build` | `string` | `"bun run build"` | Runs before a build, in `web.cwd`. |
| `web.devCommand` | `string` | `"bun run dev"` | Runs before `dev`, in `web.cwd`. |
| `web.devUrl` | `string` | `"http://localhost:5173"` | The dev server, and the readiness poll target. |
| `web.dist` | `string` | `"dist"` | The web build output, from `web.cwd`. |
| `web.cwd` | `string` | the working directory | Root of the web package, for monorepos. |
| `system` | `ReadonlyArray<{ name: string }>` | `[]` | The composed capabilities. |
| `capabilities` | `Partial<CapabilityConfigMap>` | `{}` | Per-capability parameters. `deep-link` needs `{ mode: "scheme", scheme }`. |
| `targets` | `readonly Target[]` | the host's desktop target | Name `ios` and `android` to get them. |
| `projectDir` | `string` | `".moku/tauri"` | The generated project. |
| `outDir` | `string` | `"dist-native"` | Where installers land. |
| `signing.apple` | `AppleSigning` | none | See [Signing](/docs/native/guides/signing/). |
| `signing.android` | `{ keystorePath?, keystorePasswordEnv?, keyPasswordEnv?, keyAlias? }` | none | Env var names, never secrets. |
| `signing.windows` | `{ certificateThumbprint? }` | none | The certificate thumbprint. |
| `ios.infoPlist` | `Readonly<Record<string, PlistValue>>` | none | Keys merged into `Info.plist`. They beat a capability. `app.orientation` beats them. |
| `ios.privacyManifest` | `string` | none | Absolute path of the file bundled as `PrivacyInfo.xcprivacy`. |

## createPlugin

```ts no-check="a simplified signature; the exports are checked against the package"
function createPlugin<Name extends string, Config, State, Api, Deps, Events, Hooks>(
  name: Name,
  spec: {
    config?: Config;
    depends?: Deps;
    createState?: (ctx: { global; config }) => State;
    events?: (register) => Events;
    api?: (ctx: PluginContext) => Api;
    hooks?: (ctx: PluginContext) => Hooks;
    onInit?: (ctx: PluginContext) => void;
    onStart?: (ctx: PluginContext) => void | Promise<void>;
    onStop?: (ctx: { global; config; state }) => void | Promise<void>;
  }
): PluginInstance<Name, Config, State, Api, Events>;
```

Writes a plugin bound to this framework. Its `ctx` carries `global`, `log` and `env`. The global events
need no `depends`.

```ts file="src/plugins/timings.ts" check
import { createApp, createPlugin } from "@moku-labs/native";

const timings = createPlugin("timings", {
  hooks: ctx => ({
    "native:complete": ({ target, durationMs }) => {
      ctx.log.info(`${target} took ${durationMs} ms`);
    }
  })
});

export const native = createApp({
  plugins: [timings],
  config: {
    app: { name: "MyApp", identifier: "com.example.myapp" }
  }
});
```

## Constants and helpers

```ts no-check="a simplified signature; the exports are checked against the package"
const TARGETS: readonly ["macos", "windows", "linux", "ios", "android"];
const PHASE_ORDER: readonly ["scaffold", "codegen", "icons", "compile", "bundle", "collect"];
function hostTargets(platform: NodeJS.Platform): readonly Target[];
```

`hostTargets` returns the host's one desktop target (`darwin`, `win32`, `linux`), and an empty list on
any other host. It never returns a mobile target.

```ts file="src/targets.ts" check
import { hostTargets, PHASE_ORDER, TARGETS } from "@moku-labs/native";

const targets = [...hostTargets(process.platform), "android"];
console.log(targets, TARGETS.length, PHASE_ORDER[0]); // on a Mac: ["macos", "android"] 5 "scaffold"
```

## TauriError

```ts no-check="a simplified signature; the exports are checked against the package"
class TauriError extends Error {
  readonly kind: TauriErrorKind;
  readonly exitCode: number | null;
  readonly stderrTail: string;
}
```

Thrown on a non-zero exit of the Tauri CLI. `stderrTail` is already scrubbed. The kinds are listed in
[How it works](/docs/native/how-it-works/).

## Plugins

Composed for you. The instances are exported for `depends` and `ctx.require`.

| Export | Mounted at | API |
|---|---|---|
| `projectPlugin` | `app.project` | `generate`, `getCompleteness`, `patchMobile`, `detectPageAgent`, `clean`, `resolve` and more. |
| `tauriPlugin` | `app.tauri` | `icon`, `build`, `mobileInit`, `dev`, `getVersion`, `getRunner`. |
| `buildPlugin` | `app.build` | `prepare`, `run`, `runAll`. |
| `doctorPlugin` | `app.doctor` | `run`. |
| `cliPlugin` | `app.cli` | `build`, `dev`, `doctor`, `clean`. |

## Events

| Event | Payload | When |
|---|---|---|
| `native:phase` | `{ target, phase, status, durationMs?, detail? }` | Each phase's `start`, `progress`, `done` or `error`. |
| `native:complete` | `{ target, outPath, artifacts, durationMs, profile }` | Once per target, on success. |
| `doctor:check` | `{ id, target, status, message, fixIt? }` | As each check settles. Needs `depends: [doctorPlugin]`. |

## Types

| Type | What it is |
|---|---|
| `Config`, `Events` | The global config and events. |
| `Target`, `MobileTarget` | The five targets, and `"ios" \| "android"`. |
| `BuildFlavor`, `BuildProfile` | `{ simulator?, aab?, debug?, dev? }`, and `"store" \| "debug" \| "dev"`. |
| `NativePhase`, `NativePhaseEvent`, `NativeCompleteEvent` | The pipeline and its events. |
| `CapabilityConfigMap`, `Orientation`, `PlistValue` | Parts of the config. |
| `SigningConfig`, `AppleSigning`, `AppleExportMethod` | The signing config. |
| `TauriRunner` | The absolute `{ nodePath, tauriJsPath }` pair. |
| `Build`, `Cli`, `Doctor`, `Project`, `Tauri` | One type namespace per plugin: `Build.BuildResult`, `Doctor.DoctorReport`, `Tauri.TauriErrorKind`. |
