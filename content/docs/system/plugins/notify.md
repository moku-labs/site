---
title: notify
description: "Notifications with an explicit permission flow. show() never prompts."
section: Plugins
kind: optional
order: 12
---

## What it does

`notify` shows an OS notification. Asking for permission is a separate call you make on purpose:
`show()` never prompts, and answers `denied` when permission is not granted.

## How it works

The web provider uses the `Notification` global. Without it (an old browser, an insecure context, a
server render) every method answers `unsupported`. The Tauri provider uses
`@tauri-apps/plugin-notification`.

## Config

None.

## API

Mounted at `app.notify`.

| Method | Signature | Description |
|---|---|---|
| `isPermissionGranted` | `() => Promise<SystemResult<boolean>>` | The current state. Never prompts. |
| `requestPermission` | `() => Promise<SystemResult<boolean>>` | Prompts the user. `value` is the state after the prompt. |
| `show` | `(options: { title: string; body?: string }) => Promise<SystemResult<void>>` | Shows the notification, or `denied`. |

## Events

None.

## Depends on

- The core `runtime` plugin.
- In the shell: `@tauri-apps/plugin-notification`, and `{ name: "notification" }` in `config.system` of native.

## Example

```ts file="src/export-done.ts" check
import { createApp } from "@moku-labs/system";
import { notifyPlugin } from "@moku-labs/system/notify";

const system = createApp({ plugins: [notifyPlugin] });
await system.start();

const granted = await system.notify.isPermissionGranted();
if (granted.ok && !granted.value) {
  await system.notify.requestPermission(); // [!note] Browsers want a user gesture here. Call it from a click.
}

const shown = await system.notify.show({ title: "Done", body: "Export finished." });
if (!shown.ok && shown.reason === "denied") console.log("Turn notifications on in settings");
```

:::gotchas
- **The name differs in native.** This plugin is `notify`. In `config.system` it is `notification`.
:::

## Related

- [How it works](/docs/system/how-it-works/): `denied` and the other reasons.
