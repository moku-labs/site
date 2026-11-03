---
title: haptics
description: "Tap, outcome and selection feedback on phones. Web vibrates where it can."
section: Plugins
kind: optional
order: 17
---

## What it does

`haptics` plays short physical feedback: a tap, the pattern of an outcome, a selection tick.

## How it works

| Where | What happens |
|---|---|
| Tauri on iOS and Android | The native haptic, through `@tauri-apps/plugin-haptics`. |
| Tauri on desktop | `unsupported`. |
| A browser with `navigator.vibrate` | A short pattern. |
| A browser without it (iOS Safari, WKWebView) | `unsupported`. |

A browser refuses `vibrate` before the first user gesture. That answer is `unavailable`, so it can
succeed later.

| Call | Web pattern, in ms |
|---|---|
| `impact("light")`, `impact("medium")`, `impact("heavy")` | `10`, `20`, `35` |
| `notify("success")` | `[15, 60, 15]` |
| `notify("warning")` | `[30, 60, 30]` |
| `notify("error")` | `[40, 60, 40, 60, 40]` |
| `selection()` | `5` |

## Config

None.

## API

Mounted at `app.haptics`.

| Method | Signature | Description |
|---|---|---|
| `impact` | `(kind: "light" \| "medium" \| "heavy") => Promise<SystemResult<void>>` | One tap for a physical moment. |
| `notify` | `(kind: "success" \| "warning" \| "error") => Promise<SystemResult<void>>` | The pattern for an outcome. |
| `selection` | `() => Promise<SystemResult<void>>` | The tick for a changed selection. |

## Events

None.

## Depends on

- The core `runtime` plugin.
- In the shell: `@tauri-apps/plugin-haptics`, and `{ name: "haptics" }` in `config.system` of native.

## Example

```ts file="src/feedback.ts" check
import { createApp } from "@moku-labs/system";
import { hapticsPlugin } from "@moku-labs/system/haptics";

const system = createApp({ plugins: [hapticsPlugin] });
await system.start();

const tap = await system.haptics.impact("medium");
if (!tap.ok && tap.reason === "unsupported") console.log("hide the vibration toggle");

const done = await system.haptics.notify("success");
if (!done.ok && done.reason === "unavailable") console.log("tap once to turn vibration on");
```

## Related

- [native project plugin](/docs/native/plugins/project/): the four permissions it composes.
