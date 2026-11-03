---
title: lifecycle
description: "Run code when the app goes to background and when it comes back, once per trip."
section: Plugins
kind: optional
order: 15
---

## What it does

`lifecycle` tells you when the app leaves the foreground and when it returns. Use it to pause a game
loop or flush work.

## How it works

The web provider watches `visibilitychange`. The Tauri provider watches the same event, plus
`tauri://suspended` and `tauri://resumed`. Two sources can report one trip, and your callback still
runs once. Every resume follows a pause: an app that never left reports no resume.

A page that is already hidden at start reports one pause.

## Config

None.

## API

Mounted at `app.lifecycle`.

| Method | Signature | Description |
|---|---|---|
| `onPause` | `(fn: () => void) => () => void` | Runs `fn` on each trip to background. Returns the remover. |
| `onResume` | `(fn: () => void) => () => void` | Runs `fn` on each return. Returns the remover. |

Both are local and synchronous, and may be called before `start()`. A `fn` that throws is logged as
`lifecycle:subscriber-failed`, and the others still run.

## Events

None.

## Depends on

- The core `runtime` plugin.
- In the shell: `@tauri-apps/api`. Nothing goes in `config.system` of native.

## Example

```ts file="src/loop.ts" check
import { createApp } from "@moku-labs/system";
import { lifecyclePlugin } from "@moku-labs/system/lifecycle";

let running = true;

const system = createApp({ plugins: [lifecyclePlugin] });

const offPause = system.lifecycle.onPause(() => {
  running = false;
});
const offResume = system.lifecycle.onResume(() => {
  running = true;
});

await system.start();
console.log(running);

offPause();
offResume();
```

:::gotchas
- **Each call is its own subscription.** The same `fn` subscribed twice runs twice per trip, and each remover removes one of them.
:::

## Related

- [keepAwake](/docs/system/plugins/keep-awake/): a wake lock that follows page visibility.
