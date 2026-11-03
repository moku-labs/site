---
title: tray
description: "Desktop tray icon and menu. Every method answers unsupported on the web and on phones."
section: Plugins
kind: optional
order: 11
---

## What it does

`tray` puts an icon with a menu in the desktop status area. The web provider and the Tauri iOS and
Android branch answer every method with `unsupported`, so your code stays the same.

## How it works

The OS icon is created lazily, by the first mutating call. `destroy()` removes it, and the next
mutating call creates it again. `app.stop()` removes it too.

## Config

`pluginConfigs.tray`.

| Option | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | `"moku-system"` | OS-level tray identity. A blank value throws a `TypeError` at `createApp`. |
| `icon` | `string \| Uint8Array \| number[]` | the app's default window icon | A path the app process can read, or raw image bytes. |

Leave `icon` out unless you need it. A relative path resolves against the working directory, and a
bundled app does not control that.

## API

Mounted at `app.tray`.

| Method | Signature | Description |
|---|---|---|
| `setMenu` | `(items: TrayMenuItem[]) => Promise<SystemResult<void>>` | Replaces the menu. |
| `setTooltip` | `(text: string) => Promise<SystemResult<void>>` | Sets the hover text. |
| `setIcon` | `(iconPath: string) => Promise<SystemResult<void>>` | Sets the icon by path. |
| `destroy` | `() => Promise<SystemResult<void>>` | Removes the icon. `ok` even if it never existed. |

`TrayMenuItem` is `{ id: string; text: string; enabled?: boolean; action?: () => void }`. `enabled`
defaults to `true`. `action` runs in the webview on click.

## Events

None. Clicks arrive through `action`.

## Depends on

- The core `runtime` plugin.
- In the shell: `@tauri-apps/api`, and `{ name: "tray" }` in `config.system` of native. It is a Cargo feature, not a plugin crate.

## Example

```ts file="src/tray.ts" check
import { createApp } from "@moku-labs/system";
import { trayPlugin } from "@moku-labs/system/tray";

const system = createApp({
  plugins: [trayPlugin],
  pluginConfigs: { tray: { id: "my-app-tray" } }
});
await system.start();

const menu = await system.tray.setMenu([
  { id: "open", text: "Open", action: () => console.log("open") },
  { id: "sync", text: "Sync", enabled: false },
  { id: "hide", text: "Hide tray", action: () => void system.tray.destroy() }
]);

if (!menu.ok && menu.reason === "unsupported") {
  console.log("no tray here"); // [!note] Web and phones. Hide the tray settings.
}
```

:::gotchas
- **Desktop only.** `unsupported` on the web, iOS and Android is the normal answer, not a bug.
- **The permission list is longer than the tray's own.** The default icon needs `core:app:allow-default-window-icon`. Native adds it for you.
:::

## Related

- [native project plugin](/docs/native/plugins/project/): the Cargo feature and the permissions.
