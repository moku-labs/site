---
title: How it works
description: "One seam: the runtime is detected once, each capability picks a provider, every call answers with data."
section: Get started
order: 3
---

## The picture

:::flow
- app.store.get()
- store plugin
- ctx.runtime
- Tauri or web provider
- SystemResult
:::

:::steps
1. **Compose.** `createApp` registers the `log`, `env` and `runtime` core plugins, then the capabilities you listed. Nothing touches the OS yet.
2. **Detect.** `runtime` reads the environment once: `tauri` when `globalThis.isTauri === true` or the `__TAURI_INTERNALS__` marker exists, `web` otherwise. The platform comes from the user agent.
3. **Resolve.** On `app.start()` each capability loads its provider, fire and forget. A failure here is not a startup throw. It folds into the result of the next call.
4. **Answer.** Each method awaits the provider and returns `SystemResult<T>`.
:::

## The result contract

```ts no-check="the shape of the exported types, shown for reading"
type SystemOk<T> = { ok: true; value: T; provider: "tauri" | "web" };
type SystemErr = { ok: false; provider: "tauri" | "web"; reason: SystemErrorReason; message?: string };
type SystemResult<T> = SystemOk<T> | SystemErr;
```

| `reason` | Meaning | Examples | What to do |
|---|---|---|---|
| `unsupported` | It does not exist here, for good. | Tray on the web or on a phone. Clipboard in an insecure context. | Hide the feature. |
| `denied` | The user or platform clearly refused. | Notification permission not granted. Clipboard `NotAllowedError`. | Explain, or ask again on purpose. |
| `unavailable` | It cannot work right now. | Provider failed to load. App not started, or stopped. Storage probe failed in private mode. | Retry later or degrade. |
| `error` | The provider threw. `message` keeps the text. | A native call failed. | Log it and recover. |

A thrown provider error never becomes `denied`. Tauri permission errors are thrown and ambiguous, so
`denied` is kept for clear signals only.

## The lifetime of an app

| Moment | What a method answers |
|---|---|
| Before `start()` | `unavailable`, message `app not started — call app.start() first`. |
| After `start()` | The provider's answer. A call made while the provider loads waits for it. |
| After `stop()`, a capability that holds a native resource | `unavailable`, message `app stopped`. This covers `store`, `tray`, `deepLink`, `back.exit()` and `keepAwake.set(true)`. |

`stop()` waits at most 5 seconds for a provider that is still loading, logs a warning and completes.

`onOpen`, `onPause`, `onResume` and `onPress` are local and synchronous. They always succeed and may be
called before `start()`.

## Which provider does what

| Capability | Web | Tauri |
|---|---|---|
| `store` | IndexedDB through `idb-keyval` | `@tauri-apps/plugin-store`, with an awaited save |
| `notify` | The `Notification` API | `@tauri-apps/plugin-notification` |
| `clipboard` | `navigator.clipboard` | `@tauri-apps/plugin-clipboard-manager` |
| `tray` | `unsupported` | Desktop tray. `unsupported` on iOS and Android |
| `deepLink` | The `?deeplink=` or `#deeplink=` parameter | `@tauri-apps/plugin-deep-link` |
| `lifecycle` | `visibilitychange` | The same, plus `tauri://suspended` and `tauri://resumed` |
| `back` | `unsupported` | Android only |
| `haptics` | `navigator.vibrate` where it exists | `@tauri-apps/plugin-haptics` on iOS and Android, `unsupported` on desktop |
| `keepAwake` | `navigator.wakeLock` | `navigator.wakeLock` in the webview |

## No native code in web bundles

The root entry exports `createApp`, `createPlugin`, `ok`, `err` and types. Plugin instances live at
subpaths. `@tauri-apps/*` packages are optional peers, loaded by dynamic import inside the Tauri
providers only.

A missing peer is named in the failure, for example:

```text
@tauri-apps/plugin-store is not installed. Add it to the app, or list "store" in @moku-labs/native config.system.
```

## Native permissions

Each capability needs a Tauri permission and sometimes a Rust plugin.
[`@moku-labs/native`](/docs/native/plugins/project/) generates them from `config.system`. The two
packages name capabilities differently:

| This package | `config.system` in native | Permissions |
|---|---|---|
| `store` | `store` | `store:default` |
| `notify` | `notification` | `notification:default` |
| `clipboard` | `clipboard-manager` | `clipboard-manager:allow-read-text`, `clipboard-manager:allow-write-text` |
| `tray` | `tray` | `core:tray:default`, `core:menu:default`, `core:image:default`, `core:resources:default`, `core:app:allow-default-window-icon` |
| `deepLink` | `deep-link` | `deep-link:default` |
| `back` | `back` | `core:app:allow-exit` |
| `haptics` | `haptics` | `haptics:allow-impact-feedback`, `haptics:allow-notification-feedback`, `haptics:allow-selection-feedback`, `haptics:allow-vibrate` |
| `lifecycle` | not listed | none |
| `keepAwake` | not listed | none |
