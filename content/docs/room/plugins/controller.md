---
title: controller
description: "The phone's facade. Join, read the replica, send intents, hold a wake lock. Added by the app."
section: Plugins
kind: optional
order: 21
---

## What it does

**Added by the app, on the phone.** `controller` is the mirror of `stage`: a thin surface over the
engines, with no config. Its only state of its own is the wake lock handle.

## How it works

It depends on all four engines and re-declares the six `room:*` events for typed hooks. It turns
`session.joinRoom`'s result into a promise that throws. It wraps
`navigator.wakeLock` so that a missing API or a refusal gives `false` instead of an error.

## Config

None.

## API

Mounted at `app.controller`, reachable with `ctx.require(controllerPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `joinRoom` | `(code: string) => Promise<void>` | Resolves when the channel to the stage opens. Throws an `Error` whose message is `not-found` or `unreachable`. |
| `read` | `(ns: string) => Readonly<Record<string, JsonValue>> \| undefined` | The replica of a slice. `undefined` before it arrives. |
| `on` | `(ns: string, cb: (value) => void) => () => void` | Calls back on each change, and at once if the slice is there. Returns the unsubscribe. |
| `intent` | `(name: string, payload: JsonValue) => void` | Sends an input to the stage. Fire and forget. |
| `requestWakeLock` | `() => Promise<boolean>` | Keeps the screen on. `false` when unsupported or denied. |
| `releaseWakeLock` | `() => Promise<void>` | Releases the lock. No-op when none is held. |

## Events

### Emits

None of its own. Re-declares all six `room:*` events for types.

### Listens to

None.

## Depends on

`transport`, `session`, `intent`, `sync`.

## Example

```ts file="src/pad.ts" check
import { controllerPlugin, createApp, createPlugin } from "@moku-labs/room";

const padPlugin = createPlugin("pad", {
  depends: [controllerPlugin],
  hooks: ctx => ({
    "room:sync-ready": () => {
      ctx.log.info("pad:round", { round: ctx.require(controllerPlugin).read("round") });
    },
    "room:network-warning": ({ reason }) => ctx.log.warn("pad:network", { reason })
  })
});

export const app = createApp({ plugins: [controllerPlugin, padPlugin] });
await app.start();

await app.controller.joinRoom("H9NSHM");
await app.controller.requestWakeLock();

const off = app.controller.on("round", round => console.log(round));
app.controller.intent("move", { dx: 1, dy: 0 });
off();
```

:::gotchas
- **`room:peer-joined` and `room:peer-left` do not fire here.** They fire on the stage. Read the roster with `app.session.roster()`, which mirrors the stage.
- **`room:host-reconnecting` does not fire here either.** Poll `app.session.recoveryPhase()`.
- **The OS releases the wake lock when the tab hides.** Request it again on `visibilitychange`. Room does not.
- **The replica is read-only.** Change state only with an intent.
:::

## Related

- [Joining a room](/docs/room/guides/joining/): the join errors.
- [stage plugin](/docs/room/plugins/stage/): the other side.
