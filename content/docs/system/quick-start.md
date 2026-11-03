---
title: Quick start
description: "Save a counter that survives a reload, then see what a missing capability looks like."
section: Get started
order: 2
---

## A counter in four steps

:::steps
1. **Install.** `@moku-labs/core` and `@moku-labs/common` are required peers, so your app and every Moku framework share one copy.

   ```sh terminal title="install"
   $ bun add @moku-labs/system @moku-labs/core @moku-labs/common
   ```

2. **Compose the capabilities you use.** Plugins come from subpaths. A store-only app carries no code of the other capabilities.

3. **Start the app.** `start()` picks each capability's provider. A method called before it answers `unavailable`.

4. **Read the result.** Every method returns `SystemResult<T>`. Check `ok` before you read `value`.
:::

## The code

```ts file="src/counter.ts" check
import { createApp } from "@moku-labs/system";
import { storePlugin } from "@moku-labs/system/store";

const system = createApp({
  plugins: [storePlugin],
  pluginConfigs: { store: { name: "my-app" } } // [!note] The IndexedDB database on the web, the store file `my-app.json` in Tauri.
});

await system.start();

const saved = await system.store.get<number>("count");
const count = saved.ok ? (saved.value ?? 0) : 0; // [!note] An absent key is `ok` with `undefined`, not a failure.

const written = await system.store.set("count", count + 1);
if (!written.ok) console.warn(written.reason, written.message);

await system.stop();
```

The same file runs in a browser and in the native shell. Nothing in it names a runtime.

## When a capability is missing

A tray icon does not exist on the web. The call still answers, with data you can act on:

```ts file="src/tray.ts" check
import { createApp } from "@moku-labs/system";
import { trayPlugin } from "@moku-labs/system/tray";

const system = createApp({ plugins: [trayPlugin] });
await system.start();

const result = await system.tray.setTooltip("Syncing");
if (!result.ok && result.reason === "unsupported") {
  console.log(`no tray on ${result.provider}`); // [!note] In a browser: `no tray on web`. Hide the feature.
}
```

:::callout
Programmer errors still throw. An invalid `store.name` fails at `createApp` with a `TypeError`.
:::

## Add the native shell

The Tauri packages are optional peers. Install only the ones your capabilities load:

```sh terminal title="native only"
$ bun add @tauri-apps/api @tauri-apps/plugin-store
```

Then package the app with [`@moku-labs/native`](/docs/native/quick-start/). It generates the Tauri
permissions from the capabilities you list.

## Related

- [How it works](/docs/system/how-it-works/): the provider seam and the result contract.
- [One app, web and native](/docs/system/guides/web-and-native/): the bundler setup and the shared list.
