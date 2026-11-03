---
title: API reference
description: "Every export of the five entries of @moku-labs/editor, with signatures."
section: API reference
order: 40
---

## Entries

| Import | Runs on | For |
|---|---|---|
| `@moku-labs/editor` | anywhere | The runtime-free wire protocol and `definePanel`. Types and pure helpers. |
| `@moku-labs/editor/agent` | the game page, or headless Bun | The `editor-agent` core: `createApp`, `createPlugin`, seven plugins, their types. |
| `@moku-labs/editor/agent/page` | the engine's dev page and debug builds | The engine's page agent, as the `default` export. |
| `@moku-labs/editor/server` | Bun | The `editor-server` core: `createApp`, `createPlugin`, five plugins, their types. |
| `@moku-labs/editor/tools` | the tools page | The `editor-tools` core: `createApp`, `createPlugin`, ten plugins, their types. |

The package is ESM only. Signatures below are simplified for reading. The installed
`dist/*.d.mts` files are the source.

## createApp and createPlugin

Each core entry, `/agent`, `/server` and `/tools`, exports its own pair, bound to that core.

```ts no-check="a simplified signature; the exports are checked against the package"
function createApp<const ExtraPlugins extends readonly AnyPluginInstance[] = readonly []>(options?: {
  plugins?: ExtraPlugins;
  pluginConfigs?: { [pluginName: string]: Partial<PluginConfig> };
  onReady?: (ctx: AppCallbackContext) => void;
  onError?: (error: Error, ctx: AppCallbackContext) => void;
  onStart?: (ctx: AppCallbackContext) => void | Promise<void>;
  onStop?: (ctx: AppCallbackContext) => void | Promise<void>;
}): App;

function createPlugin<Name extends string, Config, State, Api, Deps, Events, Hooks>(
  name: Name,
  spec: PluginSpec<Config, State, Api, Deps, Events, Hooks>
): PluginInstance<Name, Config, State, Api, Events>;
```

`createApp` is synchronous and returns the frozen app. Every plugin's API is mounted under its
name, for example `editor.registry`, `server.hub`, `tools.workspace`. `start()` runs every
plugin's `onStart`; `stop()` runs every `onStop`. The global config of each core is empty: every
option is per plugin, in `pluginConfigs`. See [Configuration](/docs/editor/configuration/).

`createPlugin` is bound to its core's config and events, and to the core plugins `log` and `env`.
Never pass the type parameters: they are inferred from the spec. See
[Writing a plugin](/docs/editor/guides/writing-a-plugin/).

## @moku-labs/editor

The wire protocol: JSON-RPC 2.0 text frames with a `channel` and, for forwarded game traffic, a
`session`. No runtime state, so it runs anywhere.

### Messages

```ts no-check="a simplified signature; the exports are checked against the package"
function encode(message: Message): string;
function decode(text: string): Message;
function request(id: number, channel: Channel, method: string, params?: Json, session?: string): Request;
function notification(channel: Channel, method: string, params?: Json, session?: string): Notification;
function success(id: number, result: Json): Response;
function failure(id: number, error: WireError): Response;
function isRequest(message: Message): message is Request;
function isNotification(message: Message): message is Notification;
function isResponse(message: Message): message is Response;
function isFailure(response: Response): boolean;
```

`Channel` is `"game"`, `"files"` or `"editor"`.

### Errors

```ts no-check="a simplified signature; the exports are checked against the package"
const ERROR_PREFIX = "[moku-editor] ";
const errorCode: {
  invalidRequest: -32600; unknownMethod: -32601; invalidInput: -32602; commandFailed: -32000;
  gameReloaded: -32001; timeout: -32002; noSession: -32003; forbiddenPath: -32004;
  versionConflict: -32005; notJson: -32006; unauthorized: -32007; notInstalled: -32008;
  noEditorPage: -32003; pageClosed: -32001; readOnly: -32009; devOnly: -32009;
};

class ProtocolError extends Error {
  readonly code: number;
  readonly data?: WireErrorData;
  constructor(code: number, message: string, data?: WireErrorData);
  get wire(): WireError;
}

function wireError(code: number, message: string, data?: WireErrorData): Error & WireError;
function isWireError(value: unknown): value is WireError;
function toWireError(error: unknown): WireError;
function fromWireError(error: WireError): ProtocolError;
function isRetryable(error: unknown): boolean;
function bareMessage(message: string): string;
```

`wireError` adds `ERROR_PREFIX` to the message. `isRetryable` is true for `gameReloaded`,
`timeout`, or `data.retryable: true`. `bareMessage` strips the prefix. The codes and their
reasons are on [How it works](/docs/editor/how-it-works/).

### Inputs, values and builds

```ts no-check="a simplified signature; the exports are checked against the package"
function isJson(value: unknown): value is Json;
function checkInput<S extends InputSchema>(schema: S, raw: Json): InputOf<S>;
function toWireValue(value: unknown): Json;
function refusalOf(profile: BuildProfile, effect: Effect): CommandRefusal | undefined;
function isAllowed(descriptor: CommandDescriptor): boolean;
```

An `InputSchema` maps a field to `"string"`, `"number"`, `"boolean"` or `"json"`; a kind ending in
`?` is optional. `toWireValue` makes any value wire-safe: a `Map` becomes `{ $map: [...] }`.
`refusalOf` tells whether a build profile refuses a command of an effect: `"read-only"`,
`"dev-only"` or `undefined`.

```ts file="src/wire.ts" check
import { checkInput, decode, encode, errorCode, isRetryable, request, wireError } from "@moku-labs/editor";

const frame = encode(request(1, "game", "read", { id: "game.position" }));
// '{"jsonrpc":"2.0","id":1,"channel":"game","method":"read","params":{"id":"game.position"}}'
decode(frame);

const input = checkInput({ frames: "number", label: "string?" }, { frames: 2 }); // { frames: 2 }
input.frames;

const error = wireError(errorCode.timeout, "game.step timed out"); // message "[moku-editor] game.step timed out"
isRetryable(error); // true
```

### Project index and selection

```ts no-check="a simplified signature; the exports are checked against the package"
function parseProjectState(value: unknown): ProjectState | undefined;
function parseFoundList(value: unknown): readonly ProjectFound[] | undefined;
function projectDelta(held: ProjectState | undefined, next: ProjectState): ProjectDelta;
function firstDefinition(state: ProjectState | undefined, key: string): string | undefined;
function anchorKey(ref: { kind: "text"; key: string } | { kind: "const" | "call"; name: string }, path: string): string;

function isSelectionInfo(value: unknown): value is SelectionInfo;
function parseSelectionInfo(value: unknown): SelectionInfo | undefined;
function parseSelectParams(value: unknown): SelectParams | undefined;

function isReloading(status: LinkStatus): boolean;
function isHotSwapEntry(value: Json): value is HotSwapEntry;
```

The parsers turn a value off the wire into a typed one, or `undefined`. `projectDelta` is the
change between two states of the [project index](/docs/editor/guides/project-index/).
`isHotSwapEntry` spots the engine's `ui:hot-swap` log line.

### Panels

```ts no-check="a simplified signature; the exports are checked against the package"
function definePanel<const S extends Readonly<Record<string, SourceRef>>, const C extends Readonly<Record<string, string>>>(input: {
  id: string;
  title: string;
  workspace: "flow" | "game" | "render" | "state" | "files" | "console";
  sources: S;
  commands?: C;
  view: (values: PanelValues<S>, tools: PanelTools<C>) => JSX.Element;
  compact?: (values: PanelValues<S>, tools: CompactTools<C>) => JSX.Element;
}): PanelSpec;
```

Returns a frozen spec that `panels.register` takes. A `SourceRef` is an id, or `[id, input]`.
`tools.run` holds one function per command; each call emits `workspace:ran`.

## @moku-labs/editor/agent

The `editor-agent` core. Defaults: `registry`, `channel`, `perf`, `recorder`, `overlay`. Opt-in:
`bridge`, `capture`. See [agent plugins](/docs/editor/plugins/agent/).

```ts no-check="a simplified signature; the exports are checked against the package"
const registryPlugin: PluginInstance<"registry", RegistryConfig, RegistryState, RegistryApi>;
const channelPlugin: PluginInstance<"channel", ChannelConfig, ChannelState, ChannelApi>;
const perfPlugin: PluginInstance<"perf", PerfConfig, PerfState, PerfApi>;
const recorderPlugin: PluginInstance<"recorder", RecorderConfig, RecorderState, RecorderApi>;
const overlayPlugin: PluginInstance<"overlay", OverlayConfig, OverlayState, OverlayApi>;
const bridgePlugin: PluginInstance<"bridge", BridgeConfig, BridgeState, BridgeApi>;
const capturePlugin: PluginInstance<"capture", CaptureConfig, CaptureState, {}>;
```

Each plugin's types come as a namespace:

| Namespace | Holds, for example |
|---|---|
| `Registry` | `Registry.RegistryApi`, `Registry.RegistryConfig`, `Registry.GameLike`, `Registry.DevModule`, `Registry.RegistryCommandEvent` |
| `Channel` | `Channel.ChannelApi`, `Channel.ChannelConfig` |
| `Perf` | `Perf.PerfApi`, `Perf.PerfConfig`, `Perf.PerfSecond` |
| `Recorder` | `Recorder.RecorderApi`, `Recorder.RecorderConfig`, `Recorder.RecorderStatusEvent` |
| `Overlay` | `Overlay.OverlayApi`, `Overlay.OverlayChanged` |
| `Bridge` | `Bridge.BridgeApi`, `Bridge.BridgeConfig`, `Bridge.DeviceLink` |
| `Capture` | `Capture.CaptureState`, `Capture.PictureFormat` |

## @moku-labs/editor/agent/page

The only export is `default`: the engine's `PageAgent`. The engine calls it after the game app
started, on the dev page (`moku-game dev`) and on a debug build. It starts the agent core with
bridge and capture and sets `globalThis.editor`.

| It takes | Meaning |
|---|---|
| `app` | The running game app. |
| `name` | The page title: the game's name in the manifest. |
| `modules` | The game's `.dev` modules; one without sources and commands is ignored. |

It resolves once the editor started, and at once when neither `__MOKU_GAME_DEV__` nor
`__MOKU_GAME_AGENT__` is true. Importing it starts nothing. A second call, such as a hot re-run of
the page, stops the previous editor first. A release build defines both flags `false` and drops
its body. See [Production builds](/docs/editor/guides/production-builds/).

## @moku-labs/editor/server

The `editor-server` core, on Bun. Defaults: `files`, `hub`, `connect`, `collector`, `pages`. See
[server plugins](/docs/editor/plugins/server/).

```ts no-check="a simplified signature; the exports are checked against the package"
const filesPlugin: PluginInstance<"files", FilesConfig, FilesState, FilesApi>;
const hubPlugin: PluginInstance<"hub", HubConfig, HubState, HubApi>;
const connectPlugin: PluginInstance<"connect", ConnectConfig, ConnectState, ConnectApi>;
const collectorPlugin: PluginInstance<"collector", CollectorConfig, CollectorState, CollectorApi>;
const pagesPlugin: PluginInstance<"pages", PagesConfig, PagesState, PagesApi>;
```

| Namespace | Holds, for example |
|---|---|
| `Files` | `Files.FilesApi`, `Files.FilesConfig`, `Files.FilesWritten` |
| `Hub` | `Hub.HubApi`, `Hub.HubConfig`, `Hub.HubSession` |
| `Connect` | `Connect.ConnectApi`, `Connect.DeviceDirectory`, `Connect.DeviceTelemetry` |
| `Collector` | `Collector.CollectorApi`, `Collector.CollectorSessionEvent` |
| `Pages` | `Pages.PagesApi`, `Pages.PagesConfig` |

## @moku-labs/editor/tools

The `editor-tools` core, on the tools page. Defaults: `link`, `activeSource`, `workspace`,
`panels` and six views. See [tools plugins](/docs/editor/plugins/tools/).

```ts no-check="a simplified signature; the exports are checked against the package"
const linkPlugin: PluginInstance<"link", LinkConfig, LinkState, LinkApi>;
const activeSourcePlugin: PluginInstance<"activeSource", ActiveSourceConfig, ActiveSourceState, ActiveSourceApi>;
const workspacePlugin: PluginInstance<"workspace", WorkspaceConfig, WorkspaceState, WorkspaceApi>;
const panelsPlugin: PluginInstance<"panels", PanelsConfig, PanelsState, PanelsApi>;
const flowViewPlugin: PluginInstance<"flowView", FlowViewConfig, FlowViewState, FlowViewApi>;
const gameViewPlugin: PluginInstance<"gameView", GameViewConfig, GameViewState, GameViewApi>;
const renderViewPlugin: PluginInstance<"renderView", RenderViewConfig, RenderViewState, RenderViewApi>;
const stateViewPlugin: PluginInstance<"stateView", StateViewConfig, StateViewState, StateViewApi>;
const filesViewPlugin: PluginInstance<"filesView", FilesViewConfig, FilesViewState, FilesViewApi>;
const consoleViewPlugin: PluginInstance<"consoleView", ConsoleConfig, ConsoleState, ConsoleApi>;
```

| Namespace | Holds, for example |
|---|---|
| `Link` | `Link.LinkApi` |
| `ActiveSource` | `ActiveSource.ActiveSourceApi`, `ActiveSource.SourceChange` |
| `Workspace` | `Workspace.WorkspaceApi`, `Workspace.WorkspaceId` |
| `Panels` | `Panels.PanelsApi` |
| `FlowView` | `FlowView.FlowViewApi`, `FlowView.FlowViewConfig` |
| `GameView` | `GameView.GameViewApi`, `GameView.ElementRef` |
| `RenderView` | `RenderView.RenderViewApi`, `RenderView.MissionState` |
| `StateView` | `StateView.StateViewApi`, `StateView.LastCommit` |
| `FilesView` | `FilesView.FilesViewApi`, `FilesView.UsedBy` |
| `ConsoleView` | `ConsoleView.ConsoleApi`, `ConsoleView.LogLine` |

```ts file="src/types.ts" check
import type { Registry } from "@moku-labs/editor/agent";
import type { Hub } from "@moku-labs/editor/server";
import type { Workspace } from "@moku-labs/editor/tools";

export type Session = Hub.HubSession;
export type WorkspaceName = Workspace.WorkspaceId; // "flow" | "game" | "render" | "state" | "files" | "console"
export type Ping = Pick<Registry.RegistryApi, "add" | "envelope">;
```

:::gotchas
- **ESM only.** There is no CommonJS build.
- **The server entry needs Bun.** The agent and tools entries run in the browser.
- **`/agent/page` has no named exports.** Import its `default`, or let the engine do it.
:::
