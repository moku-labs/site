---
title: API reference
description: "Every export of @moku-labs/room and @moku-labs/room/server, with signatures."
section: API reference
order: 40
---

## Entries

| Import | Format | For |
|---|---|---|
| `@moku-labs/room` | ESM and CJS | The browser app: the framework, the plugins, the adapters. Also runs under Node and Bun with `inMemory()`. |
| `@moku-labs/room/server` | ESM only, no types | The worker: `hubPlugin` and the `Hub` class. Needs `@moku-labs/worker`. |

Signatures below are simplified for reading. The installed `dist/index.d.mts` is the source.

## createApp

```ts no-check="a simplified signature; the exports are checked against the package"
function createApp<const ExtraPlugins extends readonly AnyPluginInstance[] = readonly []>(options?: {
  plugins?: ExtraPlugins;
  pluginConfigs?: { [pluginName: string]: Partial<PluginConfig> };
  onReady?: (ctx: AppCallbackContext) => void;
  onError?: (error: Error, ctx: AppCallbackContext) => void;
  onStart?: (ctx: AppCallbackContext) => void | Promise<void>;
  onStop?: (ctx: AppCallbackContext) => void | Promise<void>;
}): App;
```

Creates and initializes an app, synchronously. The four engines and the core `log` and `env` plugins
are always there. Add `stagePlugin` or `controllerPlugin`, and your own plugins.

| Member | What it is |
|---|---|
| `start()` | Runs every `onStart`. Starts the broadcast and retry timers. |
| `stop()` | Runs every `onStop`. Closes connections and timers. |
| `transport`, `session`, `intent`, `sync` | The engine APIs. |
| `stage` or `controller` | The facade, when added. |
| `log`, `env` | The core plugin APIs. |

## createPlugin

```ts no-check="a simplified signature; the exports are checked against the package"
function createPlugin<Name extends string, Config, State, Api, Deps, Events, Hooks>(
  name: Name,
  spec: {
    config?: Config;
    depends?: Deps;
    createState?: (ctx) => State;
    events?: (register) => Events;
    api?: (ctx) => Api;
    hooks?: (ctx) => Hooks;
    onInit?: (ctx) => void;
    onStart?: (ctx) => void | Promise<void>;
    onStop?: (ctx) => void | Promise<void>;
  }
): PluginInstance<Name, Config, State, Api, Events>;
```

Writes a plugin bound to Room's core. Never pass type parameters. With `depends: [stagePlugin]`,
`hooks` has typed `room:*` events.

```ts file="src/plugins/lobby.ts" check
import { createPlugin, stagePlugin } from "@moku-labs/room";

export const lobbyPlugin = createPlugin("lobby", {
  depends: [stagePlugin],
  config: { minPlayers: 2 },
  api: ctx => ({
    ready: () => ctx.require(stagePlugin).roster().length >= ctx.config.minPlayers
  })
});
```

## Plugins

| Export | Name | Wiring | Page |
|---|---|---|---|
| `transportPlugin` | `transport` | Default | [transport](/docs/room/plugins/transport/) |
| `sessionPlugin` | `session` | Default | [session](/docs/room/plugins/session/) |
| `intentPlugin` | `intent` | Default | [intent](/docs/room/plugins/intent/) |
| `syncPlugin` | `sync` | Default | [sync](/docs/room/plugins/sync/) |
| `stagePlugin` | `stage` | Add on the shared screen | [stage](/docs/room/plugins/stage/) |
| `controllerPlugin` | `controller` | Add on the phone | [controller](/docs/room/plugins/controller/) |
| `hubPlugin` | `hub` | Worker app, from `/server` | [hub](/docs/room/plugins/hub/) |

`Hub` is the Durable Object class, from `@moku-labs/room/server`. Re-export it from your worker entry.

## Signaling adapters

```ts no-check="simplified signatures; the exports are checked against the package"
function publicRendezvous(options?: { backbone?: "nostr" | "torrent"; relayRedundancy?: number }): Signaling;
function inMemory(options?: { server?: boolean }): Signaling;
function serverSignaling(url: string): Signaling;
```

## Constants

| Export | Value | Meaning |
|---|---|---|
| `MAX_CONTROLLERS` | `8` | The default of `session.maxControllers`. |
| `ROOM_CODE_LENGTH` | `6` | The default of `session.codeLength`. |

## Types

All from `@moku-labs/room`.

| Type | What it is |
|---|---|
| `StageApi`, `ControllerApi` | The facades' APIs. |
| `RoomDescriptor` | `{ code, joinUrl, qr, hostToken }`. |
| `QrMatrix` | `{ size, modules }`: row by row, `true` is dark. |
| `JoinResult` | `{ ok: true, selfId }` or `{ ok: false, reason }`. |
| `RosterEntry` | `{ id, reconnectToken, name?, joinedAt }`. |
| `PeerId`, `Namespace` | Strings. |
| `JsonValue`, `Snapshot`, `Op` | State values, the whole state, one cell write. |
| `RoomEvents` | The six `room:*` events and their payloads. |
| `TransportConfig`, `IceServersProvider`, `IceCandidateInit` | Transport config. |
| `Signaling`, `SignalingSession`, `SignalingJoinOpts`, `SignalMsg` | The adapter contract. |
| `Wire`, `Frame` | The channel and its union. |
| `IntentFrame`, `IntentAckFrame`, `SyncSnapshotFrame`, `SyncDeltaFrame`, `SyncResyncFrame` | Gameplay frames. |
| `HeartbeatPingFrame`, `HeartbeatPongFrame` | Heartbeat frames. |
| `RecoveryHelloFrame`, `RecoveryWelcomeFrame`, `RecoveryFlushFrame` | Recovery frames. |

`SessionConfig`, `IntentConfig` and `IntentSchema` are not exported by name. To annotate a schema, use `Parameters<typeof app.intent.register>[1]`.
