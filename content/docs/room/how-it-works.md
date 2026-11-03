---
title: How it works
description: "A star of WebRTC channels: phones send intents, the stage owns the state, signaling only opens the door."
section: Get started
order: 3
---

## The picture

```text file="Star topology"
 phone ── intents ──►  ┌───────┐  ◄── intents ── phone
                       │ stage │
 phone ◄─ snapshot ──  │ state │  ── snapshot ─► phone
          + deltas     └───────┘     + deltas
```

One device is the host: the stage. Up to eight phones connect to it. Phones never connect to each
other. The stage holds the only writable copy of the state. A phone holds a replica and changes the
state only by asking.

:::steps
1. **Create.** `stage.createRoom()` mints the code and returns at once. The signaling join runs in the background.
2. **Rendezvous.** Stage and phone meet on the signaling adapter under the room code, and exchange SDP and ICE.
3. **Connect.** A direct WebRTC DataChannel opens. Public signaling is left once the channel is up.
4. **Baseline.** The stage sends the phone a full snapshot. `room:sync-ready` fires on the phone.
5. **Play.** The phone sends intents. The stage validates them, changes state, and broadcasts deltas up to 30 times a second.
:::

## Two planes

| Plane | Carries | API |
|---|---|---|
| The `Wire` | Intents, snapshots, deltas, heartbeats, the roster. Everything per-frame. | `onIntent`, `intent`, `mutate`, `read`, `on` |
| Moku events | Coarse lifecycle: six `room:*` events. No gameplay payload. | `hooks` in your plugin |

Events are local to the device that emits them. They do not cross the network.

| Event | Payload | Fires on | When |
|---|---|---|---|
| `room:peer-joined` | `{ peerId }` | stage | A phone's channel opened and it entered the roster. |
| `room:peer-left` | `{ peerId }` | stage | The heartbeat declared a phone dead. |
| `room:host-reconnecting` | `{}` | stage | The page loaded and found a saved room. |
| `room:sync-ready` | `{}` | both | Stage: the first `registerSlice`. Phone: the first applied frame. |
| `room:intent-undeliverable` | `{ name, cSeq }` | phone | An intent ran out of retransmits. |
| `room:network-warning` | `{ reason }` | both | `ice-failed`, `rendezvous-unreachable`, `channel-closed` or `room-evicted`. |

## Seven plugins

| Plugin | Mounted at | Wiring | Job |
|---|---|---|---|
| [transport](/docs/room/plugins/transport/) | `app.transport` | default | WebRTC, the `Wire`, signaling, heartbeat. |
| [session](/docs/room/plugins/session/) | `app.session` | default | Code, QR, roster, reload record. |
| [intent](/docs/room/plugins/intent/) | `app.intent` | default | Phone-to-stage input, validation, delivery. |
| [sync](/docs/room/plugins/sync/) | `app.sync` | default | Stage-to-phone state. |
| [stage](/docs/room/plugins/stage/) | `app.stage` | you add it | The host's short API. |
| [controller](/docs/room/plugins/controller/) | `app.controller` | you add it | The phone's short API. |
| [hub](/docs/room/plugins/hub/) | `app.hub` | worker app | Self-hosted signaling on Cloudflare. |

The facades add no behavior. They shorten the engines' API and re-declare the six events, so a
plugin with `depends: [stagePlugin]` gets typed hooks for all of them. The facades do not expose
`registerSlice` or `register`. Call those on `app.sync` and `app.intent`.

## What the signaling adapter changes

| Adapter | Rendezvous | After connect | Use |
|---|---|---|---|
| `publicRendezvous()` | Public Nostr relays through Trystero | Left | The default. No infrastructure. |
| `serverSignaling(url)` | One WebSocket to your [hub](/docs/room/plugins/hub/) | Stays open | Own infrastructure, eviction notice, room reclaim, TURN credentials. |
| `inMemory()` | One process | Left | Tests. No `RTCPeerConnection`. |

:::callout{tone="warn"}
Gameplay never passes through signaling, on any adapter. If two devices cannot reach each other
directly and no TURN server is configured, there is no connection. Room runs no relay. Networks
with client isolation fail this way, and the app gets `room:network-warning`.
:::

## ICE servers

`iceServers` defaults to `"auto"`.

| Value | Result |
|---|---|
| `"auto"` with `serverSignaling` | Fetches TURN credentials from the hub's `/api/ice`. Any failure falls back to public STUN. |
| `"auto"` with other adapters | One public STUN server. |
| `[]` | No servers. Host candidates only: same network. |
| An array | Your servers, for example your own TURN. |
| An async function | Called on each connect, for short-lived credentials. `undefined`, a throw or a timeout falls back to public STUN. |

## Related

- [Failures and reloads](/docs/room/guides/failures/): every failure path, and what the app sees.
- [Three layers](/docs/concepts/three-layers/): where a framework like Room sits in Moku.
