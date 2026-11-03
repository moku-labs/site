---
title: stage
description: "The host's facade. Create the room, change the state, receive intents. Added by the app."
section: Plugins
kind: optional
order: 20
---

## What it does

**Added by the app, on the shared screen.** `stage` is a thin surface over the engines. It owns no
state, no config and no timers. Every method delegates to `session`, `sync` or `intent`.

## How it works

It depends on all four engines and re-declares the six `room:*` events. A game plugin with
`depends: [stagePlugin]` therefore gets typed hooks for all of them. The facade forwards nothing:
the event bus is global, so the engines' emits already reach your hooks.

## Config

None. Each option lives on the engine that owns it.

## API

Mounted at `app.stage`, reachable with `ctx.require(stagePlugin)`.

| Method | Signature | Description |
|---|---|---|
| `createRoom` | `() => RoomDescriptor` | Synchronous. Returns `{ code, joinUrl, qr: null, hostToken }`. Throws when a room is already active. |
| `qr` | `() => Promise<QrMatrix \| null>` | The matrix for the join URL. `null` with no room or with `generateQr: false`. |
| `mutate` | `(ns: string, recipe: (draft: Cells) => Cells) => void` | Returns the next cells of a slice. Sent on the next tick. Throws on an unregistered slice. |
| `broadcast` | `() => void` | Sends pending changes now as a delta. No-op when nothing changed. |
| `onIntent` | `(name: string, handler: (payload: unknown, peerId: PeerId) => void) => () => void` | Sets the handler of a registered intent. Returns the unsubscribe. |
| `roster` | `() => readonly RosterEntry[]` | Connected phones, oldest first. |

`register` and `registerSlice` are not here. Call them on `app.intent` and `app.sync`, once, before
`onIntent`, `mutate` and `createRoom`.

## Events

### Emits

None of its own. Re-declares all six `room:*` events for types.

### Listens to

None.

## Depends on

`transport`, `session`, `intent`, `sync`.

## Example

```ts file="src/game.ts" check
import { createApp, createPlugin, stagePlugin } from "@moku-labs/room";

const gamePlugin = createPlugin("game", {
  depends: [stagePlugin],
  onStart: ctx => {
    const stage = ctx.require(stagePlugin);
    ctx.log.info("game:players", { count: stage.roster().length });
  },
  hooks: ctx => ({
    "room:peer-joined": ({ peerId }) => {
      ctx.require(stagePlugin).mutate("players", draft => ({ ...draft, [peerId]: 0 }));
    },
    "room:peer-left": ({ peerId }) => {
      ctx.require(stagePlugin).mutate("players", draft => ({ ...draft, [peerId]: null })); // [!note] `null` deletes a cell on the phones.
    }
  })
});

export const app = createApp({ plugins: [stagePlugin, gamePlugin] });
await app.start();
app.sync.registerSlice("players", {});
app.stage.createRoom();
```

:::gotchas
- **`onIntent` before `register` does nothing.** The handler is not stored, and no error is raised. Register first.
- **`broadcast` sends no snapshot.** It flushes a delta. For a full snapshot to one phone, use `app.sync.broadcast(peerId)`.
- **`mutate` returns, it does not edit.** Return a new object. The draft is the live state.
:::

## Related

- [controller plugin](/docs/room/plugins/controller/): the phone's side.
- [sync plugin](/docs/room/plugins/sync/): what `mutate` does.
- [intent plugin](/docs/room/plugins/intent/): schemas.
