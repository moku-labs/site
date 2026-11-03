---
title: runtime
description: "The core plugin behind the seam. Detects the shell once and puts it on every plugin's ctx."
section: Plugins
order: 19
---

## What it does

`runtime` is a core plugin. It is always registered and has no import. It detects the shell once and
injects `ctx.runtime` on every plugin's context. It is the one override point for the whole seam.

Your application code never needs it. Plugin authors read it, and tests force it.

## How it works

| Field | Value |
|---|---|
| `kind` | `"tauri"` when `globalThis.isTauri === true` or `__TAURI_INTERNALS__` exists, `"web"` otherwise. |
| `platform` | From the user agent: `macos`, `windows`, `linux`, `ios`, `android`, or `unknown`, also on a server. |

## Config

`pluginConfigs.runtime`.

| Option | Type | Default | Description |
|---|---|---|---|
| `forceKind` | `"tauri" \| "web" \| null` | `null` | Forces the kind. `null` detects it. |
| `forcePlatform` | `RuntimePlatform \| null` | `null` | Forces the platform. `null` detects it. |

`runtime` is not one of the typed `pluginConfigs` keys, because those come from the plugins you
compose. Hoist the object instead of inlining it, and TypeScript accepts the extra key.

## API

`ctx.runtime` in a plugin, `app.runtime` on the app.

| Member | Type | Description |
|---|---|---|
| `kind` | `RuntimeKind` | The active shell. |
| `platform` | `RuntimePlatform` | The OS within it. |

## Events

None.

## Depends on

Nothing.

## Example

```ts file="tests/setup.ts" check
import { createApp } from "@moku-labs/system";
import { storePlugin } from "@moku-labs/system/store";

const pluginConfigs = {
  store: { name: "test-db" },
  runtime: { forceKind: "web", forcePlatform: "windows" } // [!note] Hoisted on purpose: inline, this key would not compile.
} as const;

const app = createApp({ plugins: [storePlugin], pluginConfigs });
console.log(app.runtime.kind, app.runtime.platform); // "web" "windows"
```

To force `tauri` in a test, stub the marker before the app starts and mock the `@tauri-apps/*` modules
your capabilities load:

```ts file="tests/tauri.ts" no-check="vi comes from the reader's test runner"
vi.stubGlobal("__TAURI_INTERNALS__", {});
```

:::gotchas
- **Do not branch on it in islands.** Call the capability and read the result. A branch is the second code path this package exists to remove.
:::

## Related

- [How it works](/docs/system/how-it-works/): where detection fits.
