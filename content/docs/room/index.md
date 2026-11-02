---
title: "@moku-labs/room"
description: "Couch multiplayer. One screen, phones as controllers, no server."
section: Get started
---

## Overview

`@moku-labs/room` is a Moku framework for local multiplayer. A shared screen hosts the game state,
phones join by scanning a QR code, and everything flows over direct WebRTC DataChannels on the LAN.
No accounts, no lobby servers, no relay for gameplay.

- **Couch multiplayer, no server.** One shared screen hosts. Phones join by QR and talk to it
  directly over WebRTC.
- **The host owns the truth.** The stage validates controller intents, owns the game state and
  sends snapshots and deltas back. Phones render a read-only replica.
- **Two planes, never crossed.** Gameplay rides the typed wire. Only coarse `room:*` lifecycle
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

const { code, joinUrl } = app.stage.createRoom(); // [!note] Synchronous: a 6-character code and the join URL.
console.log(`Join ${code} at ${joinUrl}`);

app.stage.onIntent("score", (_payload, peerId) => {
  app.stage.mutate("scores", draft => ({ ...draft, [peerId]: Number(draft[peerId] ?? 0) + 1 }));
});
```

A phone is the same framework with `controllerPlugin`: `await app.controller.joinRoom(code)`, then
`app.controller.intent("score", {})`.

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
