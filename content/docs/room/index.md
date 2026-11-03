---
title: "@moku-labs/room"
description: "Couch multiplayer. One screen, phones as controllers, no server."
section: Get started
---

## Overview

`@moku-labs/room` is a Moku framework for local multiplayer. A shared screen hosts the game state,
phones join by scanning a QR code, and everything flows over direct WebRTC DataChannels on the LAN.
No accounts, no lobby servers, no relay for gameplay.

- **Direct WebRTC.** One shared screen hosts. Phones join by QR and talk to it
  directly over WebRTC.
- **The host is the source of truth.** The stage validates controller intents, owns the game state and
  sends snapshots and deltas back. Phones render a read-only replica.
- **Gameplay and lifecycle use separate channels.** Gameplay rides the typed wire. Only coarse `room:*` lifecycle
  rides Moku events.

:::callout{tone="warn"}
Room is strictly peer-to-peer, with no TURN by default. On networks that isolate clients the
connection cannot be made, and the app gets `room:network-warning`. The design target is the home
Wi-Fi, with everyone in one room.
:::

## Install

```sh terminal
bun add @moku-labs/room @moku-labs/core @moku-labs/common
```

## Quick start

The stage is the shared screen. Add the host facade `stagePlugin` and a game plugin that depends on
it, so the `room:*` events are typed in its hooks.

```ts file="stage.ts" check
import { createApp, createPlugin, inMemory, stagePlugin } from "@moku-labs/room";

const gamePlugin = createPlugin("game", {
  depends: [stagePlugin],
  hooks: ctx => ({
    "room:peer-joined": ({ peerId }) => ctx.log.info("game:joined", { peerId }),
    "room:network-warning": ({ reason }) => ctx.log.warn("game:network", { reason })
  })
});

const app = createApp({
  plugins: [stagePlugin, gamePlugin],
  pluginConfigs: { transport: { signaling: inMemory(), iceServers: [] } } // [!note] In-process signaling for a local try-out. The default is publicRendezvous().
});
await app.start();

app.sync.registerSlice("scores", {}); // [!note] `mutate` throws on a slice that was never registered.
app.intent.register("score", { fields: {}, additionalFields: false }); // [!note] An intent with no schema is dropped without a word, and `onIntent` does nothing.

app.stage.onIntent("score", (_payload, peerId) => {
  app.stage.mutate("scores", draft => ({ ...draft, [peerId]: Number(draft[peerId] ?? 0) + 1 }));
});

const { code, joinUrl } = app.stage.createRoom(); // [!note] Synchronous: a 6-character code and the join URL.
console.log(`Join ${code} at ${joinUrl}`);
```

A phone is the same framework with `controllerPlugin`: `await app.controller.joinRoom(code)`, then
`app.controller.intent("score", {})`. The [quick start](/docs/room/quick-start/) has both sides.

## Start with Claude

```text prompt
Build a couch trivia game: the TV asks, phones buzz in
```

```text prompt
Show a QR code on the TV so phones can join the room
```

```text prompt
Let phones send moves that the shared screen checks and applies
```

```text prompt
Tell players when the Wi-Fi blocks phones from connecting
```
