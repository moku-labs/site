---
title: keepAwake
description: "Keep the screen on while the page is visible, with the Screen Wake Lock API."
section: Plugins
kind: optional
order: 18
---

## What it does

`keepAwake` holds a screen wake lock. One provider serves both runtimes: `navigator.wakeLock`, in the
browser and in the Tauri webview.

## How it works

`set(true)` records a wish. The browser drops the lock when the page hides, and the plugin takes it
again when the page is visible.

| Call | Answer |
|---|---|
| `set(true)`, page visible | `ok`, the lock is held. |
| `set(true)`, page hidden | `unavailable`. The wish stays. |
| `set(true)`, `NotAllowedError` | `denied`, for example battery saver or a permissions policy. |
| `set(true)`, no `navigator.wakeLock` | `unsupported`. |
| `set(true)`, after `stop()` | `unavailable`. The lock was released. |
| `set(false)` | `ok`, also when nothing was held. |

## Config

None.

## API

Mounted at `app.keepAwake`.

| Method | Signature | Description |
|---|---|---|
| `set` | `(on: boolean) => Promise<SystemResult<void>>` | Keeps the screen on, or lets it sleep. |

## Events

None.

## Depends on

- The core `runtime` plugin. Nothing goes in `config.system` of native.

## Example

```ts file="src/recipe.ts" check
import { createApp } from "@moku-labs/system";
import { keepAwakePlugin } from "@moku-labs/system/keep-awake";

const system = createApp({ plugins: [keepAwakePlugin] });
await system.start();

const held = await system.keepAwake.set(true);
if (!held.ok && held.reason === "denied") console.log("Battery saver blocks keep-awake");

await system.keepAwake.set(false);
```

:::gotchas
- **iOS refuses the lock until the first tap.** For a packaged iOS app, set `app.keepScreenOn` in native. It turns the idle timer off at launch.
:::

## Related

- [native configuration](/docs/native/api/): `app.keepScreenOn`.
