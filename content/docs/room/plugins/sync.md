---
title: sync
description: "Default engine. The stage's state as namespaced slices: a snapshot on join, throttled deltas after."
section: Plugins
order: 24
---

## What it does

**Wired by default.** `sync` holds the shared state. On the stage it is writable. On a phone it is a
read-only replica. State is split into slices: a namespace mapping keys to JSON values.

## How it works

`mutate` runs your recipe and compares the result with the current cells. If they differ, the slice
is marked dirty. A timer started in `onStart` runs at `broadcastHz`. On each tick it sends the
**whole of every dirty slice** as a list of cell writes, and raises `sSeq`.

A joining phone gets a full snapshot, triggered by `room:peer-joined`. A phone applies deltas in
order. On a gap it marks itself stale, ignores deltas, and asks for a new snapshot. A phone with no
state at all asks again every `baselineRetryMs`, so a lost first snapshot heals by itself.

## Config

`pluginConfigs.sync`.

| Option | Type | Default | Description |
|---|---|---|---|
| `broadcastHz` | `number` | `30` | Ticks per second. Clamped to 5–60. 20–30 is the verified band. |
| `skipEmptyDeltas` | `boolean` | `true` | Sends nothing on a tick with no changes. |
| `maxOpsPerDelta` | `number` | `512` | Cells per frame before a split. `0` is no limit. |
| `resyncOnGap` | `boolean` | `true` | A phone asks for a snapshot on a gap. `false` also stops the retry loop. |
| `baselineRetryMs` | `number` | `1000` | How often a phone with no state asks. `0` turns it off. |

## API

Mounted at `app.sync`, reachable with `ctx.require(syncPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `registerSlice` | `(ns: string, initial: Cells) => void` | Stage. Same initial again is a no-op. A different one throws. |
| `mutate` | `(ns: string, recipe: (draft: Cells) => Cells) => void` | Stage. Throws on an unregistered slice. |
| `broadcast` | `(peerId?: PeerId) => void` | Stage. With an id: a snapshot to that phone. Without: dirty slices to all, now. |
| `onResyncRequest` | `(handler: (peerId: PeerId) => void) => () => void` | Stage. Observes gap reports. The snapshot is sent anyway. |
| `read` | `(ns: string) => Cells \| undefined` | A copy of the slice. |
| `subscribe` | `(ns: string, cb: (cells: Cells) => void) => () => void` | Calls back on each change, and at once if present. |
| `applyFrame` | `(frame: Frame) => void` | Applies a `sync-snap` or `sync-delta`. Wired for you. |
| `isReady` | `() => boolean` | Whether state is readable. Stays `true`. |
| `exportSnapshot` | `() => { snapshot: Snapshot; sSeq: number }` | The whole state. |
| `importSnapshot` | `(snapshot: Snapshot, sSeq: number) => void` | Replaces the state and registers its slices. |
| `startBroadcast`, `stopBroadcast` | `() => void` | The tick timer. `onStart` and `onStop` call them. |

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `room:sync-ready` | `{}` | Once. Stage: the first `registerSlice`. Phone: the first applied frame. |

### Listens to

| Event | Action |
|---|---|
| `room:peer-joined` | Sends the phone a full snapshot. |

## Depends on

`transport`, `session`.

## Example

```ts file="src/round.ts" check
import { app } from "./stage";

await app.start();

app.sync.registerSlice("round", { number: 1, phase: "lobby" });
app.sync.onResyncRequest(peerId => console.log("lagging", peerId));

const off = app.sync.subscribe("round", cells => console.log(cells));

app.sync.mutate("round", draft => ({ ...draft, phase: "playing" }));
app.sync.broadcast(); // [!note] Optional. Without it the next tick sends the change.

off();
```

:::gotchas
- **Set a cell to `null` to delete it.** Leaving a key out of the result does not remove it from phones, since the delta only writes the keys it has. The phone then deletes the `null` cell, while `read` on the stage still shows `null`.
- **Register before phones join.** A new slice reaches phones on its first `mutate`, or on the next snapshot. `registerSlice` alone sends nothing.
- **A slice is sent whole.** Each tick sends every cell of a dirty slice, changed or not. Split state that changes at different rates into separate slices.
- **Plain JSON only.** No `undefined`, `Map`, `Set` or class instances.
:::

## Related

- [How it works](/docs/room/how-it-works/): the flow of a change.
- [intent plugin](/docs/room/plugins/intent/): the way in.
