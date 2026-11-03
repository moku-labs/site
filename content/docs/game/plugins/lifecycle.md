---
title: lifecycle
description: "Logic. A stack of pause reasons. The game is paused while the stack is not empty."
section: Plugins
order: 21
---

## What it does

`lifecycle` keeps a stack of pause reasons. The game is paused while the stack is not empty, and
runs again when the last reason leaves. It pauses [time](/docs/game/plugins/time/) by a direct
call.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| logic, in every app | Standard | `time` | `lifecycle:changed` |

A stack, not a flag, so two causes never fight. The tab goes to the background while a system
dialog is open: the game resumes only when both are gone. A reason already on the stack is
ignored, so two plugins that pause for the same reason never pause twice.

Named reasons: `"background"`, `"devtools"`, `"system-dialog"`, `"device-lost"`. Any other string
is allowed. The engine pushes some of them itself: [platform](/docs/game/plugins/platform/) pushes
`"background"` when the app leaves the foreground, and the renderer pushes one when the GPU device
is lost.

## Config

None. The plugin has no config.

## API

Mounted at `app.lifecycle`, reachable with `ctx.require(lifecyclePlugin)`.

| Method | Signature | Description |
|---|---|---|
| `push` | `(reason: Lifecycle.PauseReason) => void` | Pushes a reason. A reason already on the stack is ignored. |
| `pop` | `(reason: Lifecycle.PauseReason) => void` | Pops a reason. A reason not on the stack is ignored. |
| `reasons` | `() => readonly Lifecycle.PauseReason[]` | The stack as a frozen copy, in insertion order. |
| `isPaused` | `() => boolean` | True while the stack is not empty. |

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `lifecycle:changed` | `{ reason, action: "push" \| "pop", reasons, paused, resumed }` | The stack really changed. `resumed` is true only on the change that emptied it. |

### Listens to

None.

## Example

```ts file="pause-log.ts" check
import { createApp, createPlugin, lifecyclePlugin } from "@moku-labs/game";

// A game plugin that reacts to the pause declares the dependency and hooks the event.
const pauseLog = createPlugin("pauseLog", {
  depends: [lifecyclePlugin],
  hooks: ctx => ({
    "lifecycle:changed": ({ reason, action, paused, resumed }) => {
      ctx.log.info("pause", { reason, action, paused, resumed });
    }
  })
});

const app = createApp({ plugins: [pauseLog] });
await app.start();

app.lifecycle.push("system-dialog");
app.lifecycle.push("background");
app.lifecycle.pop("system-dialog");
app.lifecycle.isPaused(); // true: "background" is still on the stack
app.lifecycle.reasons(); // ["background"]
app.lifecycle.pop("background"); // the stack is empty: this change carries resumed: true
```

:::gotchas
- **Pop what you pushed.** A reason stays until someone pops it, and the game stays paused.
- **The clock resumes with a normal delta.** `time.resume()` drops the stale timestamp, so the first frame after a pause does not carry the whole pause.
:::

## Related

- [time](/docs/game/plugins/time/): the loop that is paused.
- [clock](/docs/game/plugins/clock/): `elapsed` is delivered again when the game resumes.
- [platform](/docs/game/plugins/platform/): the phone's pause and resume.
