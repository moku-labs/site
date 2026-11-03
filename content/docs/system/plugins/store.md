---
title: store
description: "Key-value persistence. A Tauri store file in the shell, IndexedDB on the web."
section: Plugins
kind: optional
order: 10
---

## What it does

`store` keeps JSON-safe values under string keys, on both runtimes. A resolved `set` means the value
is on disk: Tauri awaits `save()`, the web waits for the IndexedDB transaction.

## How it works

`name` is the namespace. It becomes the store file `<name>.json` in Tauri and the IndexedDB database
`<name>` on the web. The web provider writes and removes a probe key at startup. If that fails, for
example in a private window, every method answers `unavailable`.

## Config

`pluginConfigs.store`.

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `"moku-system"` | Letters, digits, `.`, `-` and `_`, starting with a letter or digit. Anything else throws a `TypeError` at `createApp`. |

## API

Mounted at `app.store`.

| Method | Signature | Description |
|---|---|---|
| `get` | `<T extends JsonValue>(key: string) => Promise<SystemResult<T \| undefined>>` | `ok` with `undefined` when the key is absent. |
| `set` | `<T extends JsonValue>(key: string, value: T) => Promise<SystemResult<void>>` | `ok` once the write is durable. |
| `delete` | `(key: string) => Promise<SystemResult<void>>` | `ok` whether the key existed or not. |
| `keys` | `() => Promise<SystemResult<string[]>>` | All keys in the namespace. |
| `clear` | `() => Promise<SystemResult<void>>` | Removes all keys in the namespace. |

## Events

None.

## Depends on

- The core `runtime` plugin.
- In the shell: `@tauri-apps/plugin-store`, and `{ name: "store" }` in `config.system` of native.

## Example

```ts file="src/settings.ts" check
import { createApp } from "@moku-labs/system";
import { storePlugin } from "@moku-labs/system/store";

const system = createApp({
  plugins: [storePlugin],
  pluginConfigs: { store: { name: "my-app" } }
});
await system.start();

await system.store.set("settings", { theme: "dark", sizes: [12, 14] });

const settings = await system.store.get<{ theme: string; sizes: number[] }>("settings");
if (settings.ok) console.log(settings.value?.theme); // "dark"

const keys = await system.store.keys();
if (keys.ok) console.log(keys.value); // ["settings"]
```

:::gotchas
- **JSON only.** A `Date` or a `Map` does not compile: the two providers would round-trip them differently.
- **`get` takes your word for the type.** `T` is not checked against what is stored.
- **`delete` does not say whether the key existed.** The two providers cannot agree on that answer.
:::

## Related

- [How it works](/docs/system/how-it-works/): the result contract.
