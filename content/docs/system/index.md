---
title: "@moku-labs/system"
description: "One system API, two runtimes. A missing capability is data, not a throw."
section: Get started
---

## Overview

`@moku-labs/system` gives Moku apps system capabilities behind one API: `store`, `tray`, `notify`,
`clipboard`, `deep-link`, `lifecycle`, `back`, `haptics` and `keepAwake`. A Tauri provider runs when
the native shell is detected, a web provider otherwise. Your code never branches on the runtime.

- **One codebase, web and native.** Each capability picks its provider once at startup.
- **A degraded capability is data, never a throw.** Every method returns `SystemResult<T>`:
  `{ ok: true, value }` or `{ ok: false, reason }`.
- **Zero-leak bundles.** Plugins live at subpath exports, and the `@tauri-apps/*` packages are
  optional peers loaded only in the native shell.

| `reason` | Meaning | What to do |
| --- | --- | --- |
| `unsupported` | The capability does not exist here, for good. | Hide the feature. |
| `denied` | The user or platform refused permission. | Explain, or ask again on purpose. |
| `unavailable` | It cannot work right now. | Retry later. |
| `error` | The provider threw; the message is kept. | Log it and recover. |

## Install

```sh terminal
bun add @moku-labs/system @moku-labs/core @moku-labs/common
```

## Quick start

```ts file="store.ts" check
import { createApp } from "@moku-labs/system";
import { storePlugin } from "@moku-labs/system/store"; // [!note] Plugins come from subpaths, never from the root.

const system = createApp({
  plugins: [storePlugin],
  pluginConfigs: { store: { name: "my-app" } }
});

await system.start();

const result = await system.store.get<number>("count");
if (result.ok) {
  console.log(result.value ?? 0, `(from the ${result.provider} provider)`);
} else if (result.reason === "unsupported") {
  // hide the feature: this environment will never support it
} else {
  console.warn(result.reason, result.message);
}

await system.stop();
```

To build the native shell, compose the same capabilities in
[`@moku-labs/native`](/docs/native/). It generates the Tauri permissions from that list.

## Start with Claude

Describe what you want. The conductor picks the packages.

```text prompt
Build a blog with tags and an RSS feed on @moku-labs/web
```

```text prompt
Add a D1-backed comments API with @moku-labs/worker
```

```text prompt
Make a couch quiz game: TV shows questions, phones answer
```

```text prompt
Ship this app to macOS and iOS
```
