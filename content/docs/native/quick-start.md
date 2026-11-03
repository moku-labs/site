---
title: Quick start
description: "From a built web app to an installer in dist-native/, with one script per command."
section: Get started
order: 2
---

## An installer in six steps

:::steps
1. **Install.** `@moku-labs/core` and `@moku-labs/common` are peers. A real `node` binary must be on `PATH`: `@tauri-apps/cli` does not run under Bun.

   ```sh terminal title="install"
   $ bun add @moku-labs/native @moku-labs/core @moku-labs/common
   ```

2. **Ignore the output.** The generated Tauri project and the installers are never committed.

   ```text file=".gitignore"
   .moku/
   dist-native/
   ```

3. **Compose the native app.** It is its own `createApp`, next to your web app. It never runs in the page.

4. **Add one script per command.** The `cli` plugin has no argument parser. Each script calls one method.

5. **Ask the doctor.** It tells you what the host is missing for each target, with the command that fixes it.

6. **Build.** The installers land in `dist-native/<target>/`.
:::

## The code

```ts file="src/native.ts" group="start" check
import { createApp } from "@moku-labs/native";

export const native = createApp({
  config: {
    app: { name: "MyApp", identifier: "com.example.myapp" }, // [!note] Both are required. No icon yet: a placeholder is generated.
    web: {
      build: "bun run build",
      devCommand: "bun run dev",
      devUrl: "http://localhost:5173",
      dist: "dist"
    },
    system: [{ name: "store" }] // [!note] Names drive dependencies, Rust init and permissions. An unknown name throws at `createApp`.
  }
});
```

```ts file="scripts/native-doctor.ts" group="start" check
import { native } from "../src/native";

await native.start();
const ok = await native.cli.doctor();
await native.stop();
if (!ok) process.exitCode = 1; // [!note] `doctor` returns the verdict. Setting the exit code is yours.
```

```ts file="scripts/native-build.ts" group="start" check
import { native } from "../src/native";

await native.start();
await native.cli.build(); // [!note] No target: the host's own desktop target.
await native.stop();
```

```sh terminal title="build"
$ bun scripts/native-doctor.ts
$ bun scripts/native-build.ts
```

On a Mac this leaves a `.dmg` and a `.app` in `dist-native/macos/`. The first build compiles Rust, so
it takes minutes.

## The dev loop

```ts file="scripts/native-dev.ts" check
import { native } from "../src/native";

await native.start();
await native.cli.dev(); // [!note] Runs until you stop it. Ctrl-C ends the whole process group.
await native.stop();
```

`dev` runs `web.devCommand`, waits for `web.devUrl` to answer and opens the app window on it.

## Add a phone

Mobile is opt-in. Name the target and ask the doctor again:

```ts file="scripts/native-ios.ts" check
import { native } from "../src/native";

await native.start();
await native.cli.doctor({ target: "ios" });
await native.cli.build({ target: "ios", simulator: true }); // [!note] Unsigned, for the simulator. No Apple account needed.
await native.stop();
```

## Related

- [How it works](/docs/native/how-it-works/): the generated project and the pipeline.
- [iOS simulator](/docs/native/guides/ios-simulator/): the tools this needs.
- [Signing and store builds](/docs/native/guides/signing/): when you ship.
