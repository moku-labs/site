---
title: session
description: "Default engine. Room code, QR, roster, role, and the record that survives a stage reload."
section: Plugins
order: 22
---

## What it does

**Wired by default.** `session` owns who is in the room: the code, the join URL, the QR, the roster
and this device's role. The facades call it. Call it directly for `self`, `leave`, `rejoin` and
`recoveryPhase`, which the facades do not expose.

## How it works

`createRoom` mints the code with `crypto.getRandomValues`, connects the transport as the active side
and returns without waiting. `joinRoom` connects as the passive side and resolves when the channel
to the host opens. When a phone's channel opens, the stage adds it to the roster, broadcasts the
roster on the `Wire` and emits `room:peer-joined`. Phones mirror that roster.

For what happens on a reload, see [Failures and reloads](/docs/room/guides/failures/).

## Config

`pluginConfigs.session`.

| Option | Type | Default | Description |
|---|---|---|---|
| `joinUrlBase` | `string` | `""` | The start of the join URL. Empty means `location.origin`. |
| `generateQr` | `boolean` | `true` | `false` makes `qr()` return `null`. |
| `maxControllers` | `number` | `8` | Phones allowed, without the host. Over the cap the stage closes the channel. |
| `snapshotDebounceMs` | `number` | `500` | Delay of the IndexedDB write of the reload record. |
| `reconnectTimeoutMs` | `number` | `10000` | How long a join waits, and how long a phone waits for a lost stage. |
| `intentBufferMax` | `number` | `256` | Cap of the session's reconnect buffer. |
| `intentBufferMaxAgeMs` | `number` | `8000` | Maximum age of a buffered intent. |
| `storageKeyPrefix` | `string` | `"moku.room"` | Prefix of the keys in `localStorage`. |
| `codeLength` | `number` | `6` | Characters in a new code. Use `8` on a public hub. |

## API

Mounted at `app.session`, reachable with `ctx.require(sessionPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `createRoom` | `() => RoomDescriptor` | Host entry. Throws when a room is active. |
| `qr` | `() => Promise<QrMatrix \| null>` | The QR matrix of the join URL. |
| `joinRoom` | `(code: string) => Promise<JoinResult>` | Phone entry. Resolves `{ ok: true, selfId }` or `{ ok: false, reason }`. |
| `leave` | `() => Promise<void>` | Closes the transport and resets the role. No-op outside a room. |
| `rejoin` | `() => Promise<JoinResult>` | Joins the stored code again. Throws when there is none. |
| `roster` | `() => readonly RosterEntry[]` | Phones, oldest first. A copy. |
| `self` | `() => SelfInfo` | `{ selfId, role, roomCode }`. Role is `host`, `controller` or `none`. |
| `hostId` | `() => PeerId` | The stage's id. `""` before the channel is up. |
| `persistSnapshot` | `(snapshot: Snapshot, sSeq: number) => void` | Saves the reload record. `sync` calls it. No-op on a phone. |
| `recoveryPhase` | `() => RecoveryPhase` | `stable`, `host-absent`, `verifying`, `reconciling` or `degraded`. |

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `room:peer-joined` | `{ peerId }` | Stage only. A phone entered the roster. |
| `room:peer-left` | `{ peerId }` | Stage only. The heartbeat declared a phone dead. |
| `room:host-reconnecting` | `{}` | Stage only. The page loaded with a saved room. |

### Listens to

None.

## Depends on

`transport`.

## Example

```ts file="src/seats.ts" check
import { app } from "./stage";

await app.start();

const { role } = app.session.self();
if (role === "none") app.session.createRoom();

for (const player of app.session.roster()) {
  console.log(player.id, player.joinedAt);
}

await app.session.leave();
```

:::gotchas
- **A failed join keeps the role.** `role` stays `controller`, and the next `joinRoom` returns `unreachable`. Call `leave()` first.
- **`full` never comes.** See [Joining a room](/docs/room/guides/joining/).
- **`reconnectToken` is empty in this version.** Nothing fills it. A phone that reloads joins with a new id, as a new player. Key your game state on your own player id if a seat must survive.
- **`leave` leaves the reload record behind.** See [Failures and reloads](/docs/room/guides/failures/).
:::

## Related

- [Joining a room](/docs/room/guides/joining/): the code and the QR.
- [Failures and reloads](/docs/room/guides/failures/): the phases.
