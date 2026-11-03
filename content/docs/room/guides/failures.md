---
title: Failures and reloads
description: "What the app sees when the network fails, a phone dies, or the stage reloads, and what Room does not recover."
section: Guides
order: 11
---

## Surface network warnings

Room cannot fix a network that blocks peer connections. It tells you, and the UX is yours.

```ts file="src/warnings.ts" check
import { createApp, createPlugin, stagePlugin } from "@moku-labs/room";

const messages = {
  "ice-failed": "Phones cannot reach this screen on this Wi-Fi.",
  "rendezvous-unreachable": "Cannot reach the signaling network.",
  "channel-closed": "A player's connection dropped.",
  "room-evicted": "This room expired."
};

const statusPlugin = createPlugin("status", {
  depends: [stagePlugin],
  hooks: ctx => ({
    "room:network-warning": ({ reason }) => ctx.log.warn(messages[reason])
  })
});

export const app = createApp({ plugins: [stagePlugin, statusPlugin] });
```

| Reason | Trigger |
|---|---|
| `ice-failed` | The channel failed to open after the capped retries, 3 s each by default. |
| `rendezvous-unreachable` | The signaling adapter threw on join. |
| `channel-closed` | No `pong` for `heartbeatTimeoutMs` (6 s). |
| `room-evicted` | The hub tore an idle room down. `serverSignaling` only. |

## A phone disappears

The heartbeat pings every 2 s. After 6 s of silence the stage removes the phone from the roster and
emits `room:peer-left`. The heartbeat is the only detector, because iOS does not fire the channel's
`onclose`.

## An intent cannot be delivered

Intents are retransmitted until the stage acknowledges them: after 1 s, 2 s, 4 s and 8 s by default.
Then the phone gives up, and every queued intent drops with its own event.

```ts file="src/pad.ts" check
import { controllerPlugin, createApp, createPlugin } from "@moku-labs/room";

const padPlugin = createPlugin("pad", {
  depends: [controllerPlugin],
  hooks: ctx => ({
    "room:intent-undeliverable": ({ name, cSeq }) => ctx.log.warn("pad:lost", { name, cSeq })
  })
});

export const app = createApp({ plugins: [controllerPlugin, padPlugin] });
```

An acknowledgement means "received", not "applied". A dropped invalid intent is still acknowledged.

## The stage reloads

What happens on the phone:

:::steps
1. **The heartbeat fails.** `recoveryPhase()` becomes `host-absent`, and `channel-closed` fires.
2. **It waits** `reconnectTimeoutMs` (10 s).
3. **iOS:** the phase becomes `degraded`. Show "scan the code again". **Others:** it rejoins the same code once, and a failed rejoin also ends in `degraded`.
4. **The channel opens again.** The phase returns to `stable`, and the phone gets a new snapshot.
:::

`room:host-reconnecting` does not reach phones. Poll `app.session.recoveryPhase()` there.

What happens on the stage:

:::steps
1. **While playing.** After a broadcast, Room saves `{ roomCode, hostToken, snapshot, sSeq }` to IndexedDB (debounced), and to `localStorage` when the page is hidden or the app stops.
2. **On load.** `createApp` finds the saved record. Role becomes `host`, the room code comes back, signaling reconnects, and `room:host-reconnecting` fires.
:::

So a stage page must check before it creates a room.

```ts file="src/boot.ts" check
import { app } from "./stage";

await app.start();

app.sync.registerSlice("scores", {}); // [!note] The slices do not come back by themselves. Register them on every load.

const { role, roomCode } = app.session.self();
const code = role === "host" ? roomCode : app.stage.createRoom().code; // [!note] `createRoom` throws "A room is already active" after a reload.
console.log(code);
```

:::gotchas
- **The game state is not restored.** The record is saved, but the package never loads it back. After a reload `sync.read` returns `undefined` until you register slices. Keep state you must not lose yourself, then pass it to `sync.importSnapshot(snapshot, sSeq)`.
- **The record is never deleted.** `leave()` and `stop()` write it, and nothing removes it. Every later load of that page on that device restores the old room. To truly start over, remove the `moku.room.reentry.*` keys from `localStorage` before `createApp`.
- **Intents are not buffered while the stage is away.** The buffer API exists, but no plugin calls `setBuffering`. Intents sent in that window end in `room:intent-undeliverable`. `bufferedCount()` stays `0`.
- **`rejoin` throws without a stored room.** Call it only when `recoveryPhase()` is `degraded`.
:::

## Related

- [session plugin](/docs/room/plugins/session/): `recoveryPhase`, `rejoin`, `leave`.
- [hub plugin](/docs/room/plugins/hub/): reclaiming a warm room on your own signaling.
