---
title: transport
description: "Default engine. WebRTC peers, the typed Wire, signaling adapters, chunking and the heartbeat."
section: Plugins
order: 25
---

## What it does

**Wired by default.** `transport` is the floor every other plugin stands on. It runs the
`RTCPeerConnection`s, owns the `Wire` and talks to the signaling adapter. A game rarely calls it.
It is the plugin you configure.

## How it works

- **Signaling.** Joins the adapter under the room code. The host offers, phones wait. A non-persistent session is left once connected.
- **Open retries.** A channel not open after `openTimeoutMs` is torn down and retried, up to 3 times. Then `ice-failed`.
- **Chunks.** A frame over `maxMessageBytes` is split and reassembled.
- **Backpressure.** Sends pause while the channel's buffer is over about 64 KiB.
- **Heartbeat.** Mandatory, because iOS does not report a closed channel. No `pong` for `heartbeatTimeoutMs` means dead.

## Config

`pluginConfigs.transport`.

| Option | Type | Default | Description |
|---|---|---|---|
| `signaling` | `Signaling` | `publicRendezvous()` | The rendezvous adapter. |
| `iceServers` | `readonly RTCIceServer[] \| IceServersProvider \| "auto"` | `"auto"` | See [ICE servers](/docs/room/how-it-works/#ice-servers). |
| `iceTransportPolicy` | `RTCIceTransportPolicy` | `"all"` | `"relay"` forces TURN only. With `"all"`, the page URL `?ice=relay` does the same for one session. |
| `heartbeatIntervalMs` | `number` | `2000` | Ping interval. |
| `heartbeatTimeoutMs` | `number` | `6000` | Silence before a peer is dead. |
| `openTimeoutMs` | `number` | `3000` | Wait for a channel to open. Also the longest wait for an ICE provider. |
| `maxMessageBytes` | `number` | `14336` | Chunk threshold. |

### Adapters

| Adapter | Signature | Description |
|---|---|---|
| `publicRendezvous` | `(options?: { backbone?: "nostr" \| "torrent"; relayRedundancy?: number }) => Signaling` | Trystero, loaded lazily. `relayRedundancy` has a floor of 3. |
| `inMemory` | `(options?: { server?: boolean }) => Signaling` | One process. See [Testing](/docs/room/guides/testing/). |
| `serverSignaling` | `(url: string) => Signaling` | One WebSocket to your [hub](/docs/room/plugins/hub/). Loaded lazily. |

Write your own by implementing `Signaling`: one `join(code, opts)` that returns a session with
`onPeer`, `onPeerLeave`, `send`, `onSignal` and `leave`.

## API

Mounted at `app.transport`, reachable with `ctx.require(transportPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `connect` | `(opts: ConnectOpts) => Promise<void>` | Joins signaling. Resolves when the session is live, not when peers connect. |
| `wire` | `() => Wire` | The same `Wire` each time. |
| `disconnect` | `(peerId: PeerId) => void` | Closes one peer. |
| `peers` | `() => readonly PeerId[]` | Connected peers. |
| `close` | `() => Promise<void>` | Closes everything, leaves signaling. |
| `reclaimToken` | `() => string \| null` | The hub's re-entry token, if any. |
| `onPeerConnected` | `(cb: (peerId: PeerId) => void) => () => void` | One slot. `session` uses it. Setting it breaks the roster. |
| `onPeerLost` | `(cb: (peerId: PeerId) => void) => () => void` | One slot. `session` uses it. Same warning. |

`Wire` has `send(peerId, frame)`, `broadcast(frame)` and `on(handler)`. `on` fans out to all
handlers, and returns the unsubscribe. A `Frame` is a closed union: a custom frame type does not exist. Send
game data through intents and slices.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `room:network-warning` | `{ reason }` | `ice-failed`, `rendezvous-unreachable`, `channel-closed`, `room-evicted`. |

### Listens to

None.

## Depends on

Nothing.

## Example

```ts file="src/network.ts" check
import { createApp, stagePlugin } from "@moku-labs/room";

export const app = createApp({
  plugins: [stagePlugin],
  pluginConfigs: {
    transport: {
      iceServers: async () => { // [!note] Called on each connect. Runs in parallel with the signaling join.
        const response = await fetch("/my-turn-credentials");
        return response.ok ? ((await response.json()) as RTCIceServer[]) : undefined; // [!note] `undefined` falls back to public STUN.
      },
      heartbeatTimeoutMs: 9000
    }
  }
});

await app.start();
console.log(app.transport.peers());
```

:::gotchas
- **`pluginConfigs` merges shallowly.** Each field replaces the default whole.
- **`"relay"` with no TURN server never connects.** That is by design, for testing the relay path.
- **`connect` resolving proves nothing about peers.** Wait for `room:peer-joined`, or the `joinRoom` promise.
- **The default adapter uses public relays.** The room code scopes the rendezvous. Anyone with the code can join.
:::

## Related

- [How it works](/docs/room/how-it-works/): adapters and ICE.
- [hub plugin](/docs/room/plugins/hub/): your own signaling.
