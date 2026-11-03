---
title: back
description: "The Android hardware Back button. Handlers run newest first, and exit() closes the app."
section: Plugins
kind: optional
order: 16
---

## What it does

`back` lets you handle the hardware Back press. Only Tauri on Android has one. Everywhere else your
handlers are kept and never called, and `exit()` answers `unsupported`.

## How it works

A press walks the handlers from newest to oldest. The first one that returns `true` takes the press.
If none does, the platform default runs: the webview goes back, or the app closes when there is no
history.

Registering any native listener replaces the Android default. So the plugin holds the native listener
only while at least one handler exists. The last remover gives Back to the system again.

## Config

None.

## API

Mounted at `app.back`.

| Method | Signature | Description |
|---|---|---|
| `onPress` | `(fn: () => boolean) => () => void` | Registers a handler. Local and synchronous. Returns the remover. A second call of the remover does nothing. |
| `exit` | `() => Promise<SystemResult<void>>` | Closes the app on Android. `unsupported` elsewhere, `unavailable` after `stop()`. |

A handler that throws is logged as `back:subscriber-failed` and counts as not taking the press.

## Events

None.

## Depends on

- The core `runtime` plugin.
- In the shell: `@tauri-apps/api`, and `{ name: "back" }` in `config.system` of native. It adds one permission on Android, `core:app:allow-exit`.

## Example

```ts file="src/back.ts" check
import { createApp } from "@moku-labs/system";
import { backPlugin } from "@moku-labs/system/back";

let popupOpen = true;

const system = createApp({ plugins: [backPlugin] });
await system.start();

const off = system.back.onPress(() => {
  if (!popupOpen) return false; // [!note] Not taken: the next handler or the platform default runs.
  popupOpen = false;
  return true;
});

off();
```

:::gotchas
- **Return a boolean every time.** A handler that always returns `true` traps the user in the app.
:::

## Related

- [lifecycle](/docs/system/plugins/lifecycle/): pause and resume.
