---
title: One app, web and native
description: "Share one capability list, keep native code out of the web bundle, and let the code stay the same."
section: Guides
order: 10
---

## How it fits together

Your project has up to three apps:

- **The system app** runs in the page. It composes capability plugins from this package.
- **The web app** builds the page, if you use `@moku-labs/web`.
- **The native app** runs in Node and packages the page with [`@moku-labs/native`](/docs/native/).

The system app and the native app must agree on the capabilities. Keep that agreement in one file.

## Example

```ts file="src/system.ts" group="shared" check
export const systemPlugins = [
  { name: "store" },
  { name: "notification" },
  { name: "deep-link" }
]; // [!note] Names from `config.system` of native, not the plugin names of this package.
```

```ts file="src/native.ts" group="shared" check
import { createApp } from "@moku-labs/native";
import { systemPlugins } from "./system";

export const native = createApp({
  config: {
    app: { name: "MyApp", identifier: "com.example.myapp" },
    web: { build: "bun run build", devCommand: "bun run dev", devUrl: "http://localhost:5173", dist: "dist" },
    system: systemPlugins,
    capabilities: { "deep-link": { mode: "scheme", scheme: "myapp" } }
  }
});
```

```ts file="src/page.ts" group="shared" check
import { createApp } from "@moku-labs/system";
import { deepLinkPlugin } from "@moku-labs/system/deep-link";
import { notifyPlugin } from "@moku-labs/system/notify";
import { storePlugin } from "@moku-labs/system/store";

export const system = createApp({
  plugins: [storePlugin, notifyPlugin, deepLinkPlugin],
  pluginConfigs: {
    store: { name: "my-app" },
    deepLink: { schemes: ["myapp"] }
  }
});
```

## Install the peers

The packager checks the `@tauri-apps/*` versions your `package.json` declares. For the list above:

```sh terminal title="peers"
$ bun add @tauri-apps/api @tauri-apps/plugin-store @tauri-apps/plugin-notification @tauri-apps/plugin-deep-link
```

## Bundle for the web

Each capability loads its Tauri provider through a lazy import. A web build never runs those chunks,
but your bundler still has to resolve the specifiers. Install the optional peers, or mark them
external:

```ts file="scripts/bundle.ts" no-check="Bun.build needs the reader's Bun types"
await Bun.build({ entrypoints: ["src/main.ts"], outdir: "dist", external: ["@tauri-apps/*"] });
```

```ts file="vite.config.ts" no-check="vite is not a dependency of this site"
export default { build: { rollupOptions: { external: /^@tauri-apps\// } } };
```

## Handle each answer once

Read the reason where the feature lives. The same branch serves both runtimes.

```ts file="src/share.ts" check
import type { SystemResult } from "@moku-labs/system";

function copyButtonState(result: SystemResult<void>): "done" | "hidden" | "retry" | "explain" {
  if (result.ok) return "done";
  if (result.reason === "unsupported") return "hidden";
  if (result.reason === "denied") return "explain";
  return "retry";
}

console.log(copyButtonState({ ok: false, provider: "web", reason: "unsupported" })); // "hidden"
```

:::gotchas
- **Two names for one capability.** `notify` here is `notification` in native, `clipboard` is `clipboard-manager`, `deepLink` is `deep-link`.
- **`lifecycle` and `keepAwake` are not listed in native.** They need no native plugin.
- **An island must start the app.** A capability call before `start()` answers `unavailable`.
:::

## Related

- [native quick start](/docs/native/quick-start/): package the page.
- [How it works](/docs/system/how-it-works/): the full name and permission table.
