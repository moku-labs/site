---
title: Events
description: "The global and per-plugin events of the agent, server and tools cores, with payloads and listeners."
section: API reference
order: 42
---

## How events work

Each core has its own events. An event is **global** only when its listener cannot depend on its
emitter. Every other event is **per-plugin**: it is declared by its emitter with `register<T>()`,
and a plugin hooks it by listing the emitter in `depends`.

Two events are global for that reason. The recorder hooks `overlay:changed`, but it is a
dependency of the overlay, so the reverse edge would be a cycle. The bridge is opt-in, so no
default plugin may depend on it.

## Global events

| Core | Event | Payload | Emitted by | Hooked by |
|---|---|---|---|---|
| agent | `bridge:status` | `{ status: LinkStatus; session?: string; link?: DeviceLink }`; `link` in device mode only | bridge | overlay |
| agent | `overlay:changed` | `OverlayChanged` = `{ mode: "hidden" \| "pill" \| "card"; tab }` | overlay | recorder |
| agent | `overlay:connect` | `{ address: string }` | overlay, the Link tab | bridge |
| server | `hub:session` | `HubSession` = `{ id, game, open, reason?: "bye" \| "game_reloaded" }` | hub | your plugins |
| server | `files:written` | `FilesWritten` = `{ path, bytes, kind: WrittenKind }` | files | none yet |
| server | `files:project` | `ProjectState` | files | hub, published as `editor.project` |
| tools | `link:status` | `{ status: LinkStatus; session?: string }` | link | workspace, panels, all six views |
| tools | `link:project` | `{ state: ProjectState; delta: ProjectDelta }` | link | flowView, gameView, renderView, filesView |
| tools | `workspace:changed` | `{ ws: WorkspaceId }` | workspace | panels, flowView, gameView, renderView, filesView |
| tools | `workspace:ran` | `RanEvent` = `{ id, input, origin, at }` and `{ ok: true, result }` or `{ ok: false, error }` | workspace, panels | stateView, consoleView |
| tools | `workspace:density` | `{ density: "compact" \| "comfortable" }` | workspace | flowView |
| tools | `workspace:open-file` | `{ path: string; line?: number }` | flowView, gameView | filesView |
| tools | `workspace:select-node` | `{ id: string }` | filesView | flowView |
| tools | `workspace:focus-frame` | `{ frame: number }` | consoleView | flowView |
| tools | `workspace:reveal` | `{ ref: ElementRef }` | gameView | renderView |
| tools | `workspace:inspect` | `{ ref: ElementRef }` | renderView | gameView |
| tools | `workspace:open-sheet` | `{ index: string }` | filesView | gameView |

## Per-plugin events

| Core | Event | Payload | Emitter | Hooked by |
|---|---|---|---|---|
| agent | `registry:command` | `RegistryCommandEvent` = `{ id, input, via, ok }`; `via` is `"overlay"`, `"tools"`, `"mcp"`, `"bridge"` or `"local"` | registry | recorder |
| agent | `recorder:status` | `RecorderStatusEvent` = `{ state, lines, bytes, sent, pending }` | recorder | overlay, bridge |
| server | `hub:device` | `HubDeviceEvent`: `listening`, `connected`, `lines`, `closed`, `stopped` | hub | collector, connect |
| server | `connect:telemetry` | `DeviceTelemetry` = `{ v: 1, device, serial, at, wired, gpu, cpu, memory, heap }` | connect | collector |
| server | `collector:session` | `CollectorSessionEvent` = `{ device, file, state, lines, lost, last }` | collector | pages |
| tools | `activeSource:changed` | `SourceChange` = `{ from, to, reason, at }`; `reason` is `"connected"`, `"user"`, `"lost"`, `"rejoined"`, `"stopped"` or `"adopted"` | activeSource | workspace, renderView |
| tools | `activeSource:connect-requested` | `{ tab: "wire" \| "network" \| undefined }` | activeSource | renderView |

## LinkStatus

| Status | Means |
|---|---|
| `connecting` | The socket is opening. |
| `live { frame }` | The game runs and beats. |
| `paused { frame }` | The game is paused. |
| `silent { since, lastFrame }` | No heartbeat for `hub.silentAfterMs`. Tools side only. |
| `lost { reason, lastFrame, retryInMs }` | The link dropped. |
| `empty` | No session. Tools side only. |

The bridge only ever reports `connecting`, `live`, `paused` and `lost`.

## Hook an event

A global event is open to any plugin of its core. A per-plugin event needs the emitter in
`depends`, which also types the payload.

```ts file="src/watch.ts" check
import { createPlugin } from "@moku-labs/editor/tools";

export const watchPlugin = createPlugin("watch", {
  hooks: ctx => ({
    "workspace:changed": ({ ws }) => ctx.log.info("workspace", { ws }),
    "link:status": ({ status }) => ctx.log.info("link", { kind: status.kind })
  })
});
```

```ts file="src/audit.ts" check
import { createPlugin, hubPlugin } from "@moku-labs/editor/server";

export const auditPlugin = createPlugin("audit", {
  depends: [hubPlugin],
  hooks: ctx => ({
    "hub:session": session => ctx.log.info("audit:session", { id: session.id, open: session.open })
  })
});
```

:::gotchas
- **Events are notifications.** Ask a plugin for a value with `ctx.require(plugin)` and its API.
- **No view depends on another view.** Views talk through the global `workspace:*` events.
:::

## Related

- [How it works](/docs/editor/how-it-works/): the cores and the wire.
- [Writing a plugin](/docs/editor/guides/writing-a-plugin/): hooks in context.
