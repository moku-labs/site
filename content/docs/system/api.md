---
title: API reference
description: "Every export of @moku-labs/system and its nine capability subpaths, with signatures."
section: API reference
order: 40
---

## Entries

| Import | For |
|---|---|
| `@moku-labs/system` | `createApp`, `createPlugin`, `ok`, `err` and the types. No plugin instance. |
| `@moku-labs/system/store` | `storePlugin` |
| `@moku-labs/system/tray` | `trayPlugin` |
| `@moku-labs/system/notify` | `notifyPlugin` |
| `@moku-labs/system/clipboard` | `clipboardPlugin` |
| `@moku-labs/system/deep-link` | `deepLinkPlugin` |
| `@moku-labs/system/lifecycle` | `lifecyclePlugin` |
| `@moku-labs/system/back` | `backPlugin` |
| `@moku-labs/system/haptics` | `hapticsPlugin` |
| `@moku-labs/system/keep-awake` | `keepAwakePlugin` |

Signatures below are simplified for reading. The installed `dist/index.d.mts` is the source.

## createApp

```ts no-check="a simplified signature; the exports are checked against the package"
function createApp<const ExtraPlugins extends readonly AnyPluginInstance[] = readonly []>(options?: {
  plugins?: ExtraPlugins;
  pluginConfigs?: { [pluginName: string]: Partial<PluginConfig> };
  onReady?: (ctx: AppCallbackContext) => void;
  onError?: (error: Error, ctx: AppCallbackContext) => void;
  onStart?: (ctx: AppCallbackContext) => void | Promise<void>;
  onStop?: (ctx: AppCallbackContext) => void | Promise<void>;
}): App;
```

Creates an app from the capabilities you list. The `log`, `env` and `runtime` core plugins are always
there. Each plugin mounts its API at `app.<name>`: `app.store`, `app.deepLink`, `app.keepAwake`.

| Member | What it is |
|---|---|
| `start()` | Picks every capability's provider. Call it once. |
| `stop()` | Releases native resources. Waits at most 5 seconds for a provider that is still loading. |
| `log`, `env`, `runtime` | The core plugin APIs. |
| `<name>` | The API of every plugin in `plugins`. |

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

Writes a plugin bound to this framework. Its `ctx` carries `ctx.runtime`, `ctx.log` and `ctx.env`.

```ts file="src/plugins/shell-name.ts" check
import { createApp, createPlugin } from "@moku-labs/system";

const shellName = createPlugin("shellName", {
  api: ctx => ({ kind: () => ctx.runtime.kind })
});

const app = createApp({ plugins: [shellName] });
console.log(app.shellName.kind()); // "web" in a browser
```

## ok and err

```ts no-check="a simplified signature; the exports are checked against the package"
function ok<T>(value: T, provider: RuntimeKind): SystemOk<T>;
function err(provider: RuntimeKind, reason: SystemErrorReason, message?: string): SystemErr;
```

Build a `SystemResult` by hand, for your own capability plugin or a test double.

```ts file="src/result.ts" check
import { err, ok } from "@moku-labs/system";

const saved = ok(42, "web"); // { ok: true, value: 42, provider: "web" }
const refused = err("tauri", "denied", "no permission"); // { ok: false, provider: "tauri", reason: "denied", message: "no permission" }
console.log(saved.value, refused.reason);
```

## Plugins

| Export | Mounted at | Config key | Methods |
|---|---|---|---|
| `storePlugin` | `app.store` | `store: { name }` | `get`, `set`, `delete`, `keys`, `clear` |
| `trayPlugin` | `app.tray` | `tray: { id, icon? }` | `setMenu`, `setTooltip`, `setIcon`, `destroy` |
| `notifyPlugin` | `app.notify` | none | `show`, `requestPermission`, `isPermissionGranted` |
| `clipboardPlugin` | `app.clipboard` | none | `readText`, `writeText` |
| `deepLinkPlugin` | `app.deepLink` | `deepLink: { schemes }` | `getCurrent`, `onOpen` |
| `lifecyclePlugin` | `app.lifecycle` | none | `onPause`, `onResume` |
| `backPlugin` | `app.back` | none | `onPress`, `exit` |
| `hapticsPlugin` | `app.haptics` | none | `impact`, `notify`, `selection` |
| `keepAwakePlugin` | `app.keepAwake` | none | `set` |

Each has its own page under Plugins.

## Types

| Type | What it is |
|---|---|
| `SystemResult<T>`, `SystemOk<T>`, `SystemErr` | The outcome of every capability method. |
| `SystemErrorReason` | `"unsupported" \| "denied" \| "unavailable" \| "error"`. |
| `RuntimeKind` | `"tauri" \| "web"`. |
| `RuntimePlatform` | `"macos" \| "windows" \| "linux" \| "ios" \| "android" \| "unknown"`. |
| `JsonValue`, `JsonPrimitive` | What `store` accepts. |
| `Store`, `Tray`, `Notify`, `Clipboard`, `DeepLink`, `Lifecycle`, `Back`, `Haptics`, `KeepAwake` | One type namespace per capability: `Store.StoreApi`, `Tray.TrayMenuItem`, `Notify.NotifyOptions`. |
