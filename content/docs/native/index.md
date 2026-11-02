---
title: "@moku-labs/native"
description: "Compose system plugins, get installers for 5 targets."
section: Get started
---

## Overview

`@moku-labs/native` is the node-only native packager of the Moku family. It wraps Tauri 2 end to
end: it generates a gitignored Tauri project, generates the permission surface from the system
plugins your app composed, and drives `tauri build` for macOS, Windows, Linux, iOS and Android. It
ships nothing inside your app.

- **The composition is the permission surface.** Declare `{ name: "notification" }` once, and the
  registry resolves the dependencies, the Rust init and the capability JSON.
- **Generated, gitignored, regenerable.** `.moku/tauri/` is build output, not source. Delete it and
  the next build writes it again.
- **Secrets stay in env vars.** Config holds the names of env vars only. `doctor` checks that they
  exist without reading them.

## Install

```sh terminal
bun add @moku-labs/native @moku-labs/core @moku-labs/common
```

A real `node` binary on `PATH` is required: `@tauri-apps/cli` does not run under Bun.

## Quick start

A native app is its own `createApp`, next to your web app:

```ts file="src/native.ts" check
import { createApp } from "@moku-labs/native";

export const native = createApp({
  config: {
    app: { name: "MyApp", identifier: "com.example.myapp" }, // [!note] No icon yet: a placeholder is generated.
    web: {
      build: "bun run build",
      devCommand: "bun run dev",
      devUrl: "http://localhost:5173",
      dist: "dist"
    },
    system: [{ name: "store" }, { name: "deep-link" }],
    capabilities: { "deep-link": { mode: "scheme", scheme: "myapp" } },
    targets: ["macos", "ios"] // [!note] Default: the host's own desktop target. Mobile is opt-in.
  }
});
```

One thin script per verb:

```ts file="scripts/native-build.ts" check
import { native } from "../src/native";

await native.start();
await native.cli.build({ target: "macos" }); // installers land in dist-native/macos/
await native.stop();
```

:::callout{tone="warn"}
Add `.moku/` and `dist-native/` to `.gitignore`. The generated Tauri project is never committed.
:::

## Start with Claude

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
