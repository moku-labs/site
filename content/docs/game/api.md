---
title: API reference
description: "Every export of @moku-labs/game and its fourteen other entries, with signatures."
section: API reference
order: 40
full: true
---

## Entries

| Import | Runs in | For |
|---|---|---|
| `@moku-labs/game` | anywhere | The engine: `createApp`, `defineGame`, the plugins, the helpers and the components. |
| `@moku-labs/game/testing` | anywhere | Headless and isolated games, the fake clock, the in-memory save. No `node:` import. |
| `@moku-labs/game/app` | anywhere | `defineGameApp`, `startMoment` and the types of a game's `index.ts` and `config.ts`. |
| `@moku-labs/game/app/page` | the browser | `startPage`, the page the generated `.moku/main.ts` calls. |
| `@moku-labs/game/app/system` | the browser, the native shell | The system shell over the optional peer `@moku-labs/system`. |
| `@moku-labs/game/cli` | Node and Bun | `runCli`, the bin `moku-game`, and the dev page seams of the editor. |
| `@moku-labs/game/visual` | Node and Bun | Visual tests: baselines of state, describe and pixels. |
| `@moku-labs/game/assets` | Node and Bun | Asset keys, the manifest, strings, the pack. The bin `moku-game-assets`. |
| `@moku-labs/game/inspect` | anywhere, production included | Read a running game. |
| `@moku-labs/game/control` | dev and debug builds | Drive a running game. |
| `@moku-labs/game/hot` | the Bun dev server | The Bun plugin that hot swaps views. |
| `@moku-labs/game/lint` | oxlint | The game lint rules, as an oxlint JS plugin. |
| `@moku-labs/game/project` | Node and Bun | The project index. The bin `moku-game-index`. |
| `@moku-labs/game/jsx-runtime` | anywhere | The JSX runtime `"jsxImportSource": "@moku-labs/game"` resolves to. |
| `@moku-labs/game/jsx-dev-runtime` | anywhere | The same, for dev builds. |

Bun only, ESM only. `pixi.js` is a peer dependency. `fonts/*` is a file pattern, not a module: it
holds the MSDF body font and its licence.

Signatures below are simplified for reading. The installed `dist/*.d.mts` files are the source.

## createApp and createPlugin

```ts no-check="a simplified signature; the exports are checked against the package"
const createApp: (options?: {
  plugins?: readonly AnyPluginInstance[];
  config?: { orientation?: "portrait" | "landscape"; referenceSide?: number; referenceLong?: number };
  pluginConfigs?: { [pluginName: string]: Partial<PluginConfig> };
  onReady?: (ctx: AppCallbackContext) => void;
  onError?: (error: Error, ctx: AppCallbackContext) => void;
  onStart?: (ctx: AppCallbackContext) => void | Promise<void>;
  onStop?: (ctx: AppCallbackContext) => void | Promise<void>;
}) => App;

const createPlugin: (name: string, spec: PluginSpec) => PluginInstance;
```

`createApp` composes the logic plugins `time`, `lifecycle`, `model`, `clock`, `flow`, and
`debug`, on the core plugins `log` and `env`. The screen set and the opt-in plugins come in
`plugins`. A game made with `defineGameApp` never calls it: the shell does.

| Global config | Default | Description |
|---|---|---|
| `orientation` | `"portrait"` | The orientation the game is designed for. |
| `referenceSide` | `1080` | Short side of the reference resolution. |
| `referenceLong` | `1920` | The long side the layout needs inside the safe area. |

`createPlugin` writes a game plugin bound to the engine's config and events. Types are inferred
from the spec; never pass them. `ctx.log` and `ctx.env` come from `@moku-labs/common`.

## defineGame

```ts no-check="a simplified signature; the exports are checked against the package"
function defineGame<Types extends Flow.GameTypes>(): GameKit<Types>;

type GameTypes = {
  player: Json;
  session: Json;
  assets: string;
  strings: Record<string, unknown>;
  bundles?: string;
  scenes?: string;
  textStyles?: string;
  textFormats?: string;
  emitters?: string;
  hud?: string;
};
```

Returns the authoring helpers, typed by the game. A texture key the game does not have, or an
effect id it did not declare, does not compile.

| Kit member | Typed by |
|---|---|
| `defineNode`, `defineFlow`, `defineFeature` | `player`, `session`, `scenes`. Not root exports: they come from the kit. |
| `projection`, `system` | `player`, `session`. |
| `sprite`, `Sprite`, `NineSlice`, `frames`, `Frames`, `sfx`, `music`, `defineStyle`, `Displacement` | `assets`. |
| `defineBundles`, `load`, `ready`, `defineScene` | `assets`, `bundles`, `player`, `session`. |
| `tr`, `key` | `strings`. |
| `label`, `bind`, `defineTextStyles`, `defineTextFormats` | `textStyles`, `textFormats`. |
| `defineEmitter`, `Emitter` | `emitters`. |
| `Overlay`, `HudPart` | `hud`. |
| `volumes` | `player`: the `audio` config's reader. |
| `defineAnimation`, `play`, `defineComponent`, `defineTokens`, `popup`, `intrinsics` | The same helpers, from the kit. |

## The graph

```ts no-check="a simplified signature; the exports are checked against the package"
function type<Payload = void>(): TypeTag<Payload>;
function exit<const Name extends string>(outcome: Name): Exit<Name>;
function to<const Target extends string, Payload, Output>(target: Target, map: (payload: Payload) => Output): Mapped<Target, Payload, Output>;
function slot<const Name extends string, const Tags extends OutcomeTags = {}>(name: Name, outcomes?: Tags): SlotNode<Tags, Name>;
function contribution(slot: SlotNode, spec: { flow: AnyFlow; order: number; when?: (snapshot: Snapshot) => boolean }): Record<string, ContributionSpec>;
function defineFeature(name: string, description: FeatureDescription): FeaturePlugin;
function flattenFeatures(list: readonly FeatureTree[]): FeatureTree[];

function schedule(moment: number | undefined): Descriptor<void>;
function guide(options: GuideOptions): Descriptor<void>;
function hint(kind: string, payload?: Json): Hint;
function defineEffect<Payload, Result>(kind: string, options?: { fast?: "run" | "skip"; cosmetic?: boolean }): Effect<Payload, Result>;

class SaveUnreadableError extends Error {
  savedVersion: number;
  schemaVersion: number;
}
```

| Export | What it does |
|---|---|
| `type` | The type tag of a payload: `outcomes: { done: type<{ id: string }>() }`. |
| `exit`, `to`, `slot` | Edge targets: leave a sub-flow with an outcome, map a payload into a node, a node features contribute to. |
| `contribution` | Builds a `contribute` entry and checks the flow's outcomes against the slot at compile time. |
| `defineFeature` | Turns a feature description into a plugin. `feature.logicOnly` keeps only the logic keys, for headless tests. |
| `flattenFeatures` | The plugin list of a feature tree, a parent before its children. |
| `schedule`, `guide`, `hint` | Effect descriptors: arm the clock, narrow the gate for a tutorial step, a cosmetic hint for `fx.emit`. |
| `defineEffect` | A game's own typed effect. `effect.handle(fx, handler)` registers its one handler. |
| `SaveUnreadableError` | Thrown by `model.store.load()` when the save cannot be read. |

See [Nodes and flows](/docs/game/guides/nodes-and-flows/) and [Features](/docs/game/guides/features/).

## Plugins

```ts no-check="a simplified signature; the exports are checked against the package"
const timePlugin: PluginInstance<"time">;
const lifecyclePlugin: PluginInstance<"lifecycle">;
const modelPlugin: PluginInstance<"model">;
const clockPlugin: PluginInstance<"clock">;
const flowPlugin: PluginInstance<"flow">;
const worldPlugin: PluginInstance<"world">;
const rendererPlugin: PluginInstance<"renderer">;
const inputPlugin: PluginInstance<"input">;
const assetsPlugin: PluginInstance<"assets">;
const scenesPlugin: PluginInstance<"scenes">;
const animPlugin: PluginInstance<"anim">;
const i18nPlugin: PluginInstance<"i18n">;
const textPlugin: PluginInstance<"text">;
const uiPlugin: PluginInstance<"ui">;
const effectsPlugin: PluginInstance<"effects">;
const audioPlugin: PluginInstance<"audio">;
const platformPlugin: PluginInstance<"platform">;
const debugPlugin: PluginInstance<"debug">;
const screen: readonly [worldPlugin, rendererPlugin, inputPlugin, assetsPlugin, scenesPlugin, animPlugin, i18nPlugin, textPlugin, uiPlugin];
```

The instances are for `plugins`, `depends` and `ctx.require` in game plugins. Each has its page:
[time](/docs/game/plugins/time/), [lifecycle](/docs/game/plugins/lifecycle/),
[model](/docs/game/plugins/model/), [clock](/docs/game/plugins/clock/),
[flow](/docs/game/plugins/flow/), [world](/docs/game/plugins/world/),
[renderer](/docs/game/plugins/renderer/), [input](/docs/game/plugins/input/),
[assets](/docs/game/plugins/assets/), [scenes](/docs/game/plugins/scenes/),
[anim](/docs/game/plugins/anim/), [i18n](/docs/game/plugins/i18n/),
[text](/docs/game/plugins/text/), [ui](/docs/game/plugins/ui/),
[effects](/docs/game/plugins/effects/), [audio](/docs/game/plugins/audio/),
[platform](/docs/game/plugins/platform/), [debug](/docs/game/plugins/debug/).

`screen` is the list of the nine screen plugins a game spreads in:
`plugins: [...screen, effectsPlugin, audioPlugin, platformPlugin]`, `platform` last.

`debugPlugin` is the editor's overlay from the game. It is always registered and a game never
lists it; the name `debug` is reserved. `app.debug.overlay` has `open({ mode?: "pill" | "card" })`,
`close()`, `toggle()` and `isOpen()`. Each answers `true` when an overlay took the call; without
the agent flag, in a release build or a test, every member answers `false`.

## World

```ts no-check="a simplified signature; the exports are checked against the package"
function component<Value extends object>(name: string, defaults: Value, options?: { owned?: readonly (keyof Value)[] }): ComponentType<Value>;
function tag(name: string): TagType;
function resource<Value extends object>(name: string, defaults: Value | (() => Value)): ResourceType<Value>;
function mut<Value extends object>(component: ComponentHandle<Value>): Mut<Value>;
function system<const Terms extends readonly QueryTerm[]>(definition: {
  name: string;
  phase: "input" | "animate" | "layout" | "sync";
  query: Terms;
  scenes?: readonly string[];
  run(entities: Iterable<QueryTuple<Terms>>, ctx: { world; res; snapshot; time; resumed }): void;
}): SystemDefinition<Terms>;
function projection<Item>(spec: ProjectionSpec<Item>): ProjectionSpec<Item>;

const Layer: ComponentType<{ name: string }>;
const Order: ComponentType<{ value: number }>;
const Tree: ComponentType<{ node: DescriptionNode }>;
const Exiting: TagType;
const Now: ResourceType<{ now: number }>;
```

| Export | What it is |
|---|---|
| `component`, `tag`, `resource` | Declare a component with defaults, a tag with no data, a resource of every world. |
| `mut` | A query term whose values are writable; every yielded entity is marked changed. |
| `system` | A system: one run a frame in its phase, skipped while its query is empty. |
| `projection` | Types a projection spec: committed state to keyed views. |
| `Layer`, `Order`, `Tree` | Engine components: the layer of a view, its draw order, the description of a JSX root. |
| `Exiting` | The tag of a view that plays its exit. |
| `Now` | The frame's moment: `const { now } = res(Now)` in a system. |

See [world](/docs/game/plugins/world/).

## Renderer

```ts no-check="a simplified signature; the exports are checked against the package"
const Transform: ComponentType<{ x: number; y: number; rotation: number; scale: number }>;
const Sprite: ComponentType<SpriteValue>;
const NineSlice: ComponentType<NineSliceValue>;
const Shape: ComponentType<ShapeValue>;
const Parent: ComponentType<{ entity: Entity }>;
const Display: ComponentType<DisplayValue>;
const Overlay: ComponentType<OverlayValue>;
const HudPart: ComponentType<{ key: string }>;
function sprite(options: SpriteOptions): [SpriteValue, TransformValue];

function frameAt(ring: FrameRing, age: number): FrameRecord | undefined;
const PERF_LOG_VERSION = 1;
const PERF_GAP_BUCKETS = 81;
const PERF_CAUSES: readonly ["gap", "js", "gpu", "compile", "upload", "longFrame", "gc?"];
const MONITOR_SECTIONS: readonly ["gpu", "passes", "shaders", "problems", "memory", "systems", "nodes", "longFrames"];
const DEMAND_REASONS: readonly ["always", "first", "resize", "restore", "layers", "debug", "wake", "capture", "request", "mark", "verify", "none", "overlay", "retake"];
const PASS_KINDS: readonly ["canvas", "texture", "filter"];
const CANVAS_RESTARTS: readonly ["none", "first", "filter", "mask", "depth", "empty"];
const SHADER_WHATS: readonly ["compile", "module"];
const PROBLEM_RULES: readonly ["filter-still", "target-churn", "retakes"];
```

| Export | What it is |
|---|---|
| `Transform`, `Sprite`, `NineSlice`, `Shape`, `Parent`, `Display` | The display components. `Shape` draws a rounded rectangle, a triangle or an arc. |
| `Overlay` | On the root of an overlay: keeps what is under it as one picture, draws the dim. |
| `HudPart` | Tags a HUD view an overlay keeps shown or lets fade. |
| `sprite` | The `Sprite` and `Transform` of a view in one call. |
| `frameAt` | One record of the performance monitor's frame ring. |
| `PERF_LOG_VERSION`, `PERF_GAP_BUCKETS`, `PERF_CAUSES`, `MONITOR_SECTIONS`, `DEMAND_REASONS`, `PASS_KINDS`, `CANVAS_RESTARTS`, `SHADER_WHATS`, `PROBLEM_RULES` | The constant lists of the performance log of an agent build, for tools that read it. |

See [renderer](/docs/game/plugins/renderer/).

## Input

```ts no-check="a simplified signature; the exports are checked against the package"
const Tappable: ComponentType<{ intent: string; payload: Json }>;
const Pressable: ComponentType<{ intent: string; payload: Json }>;
const Draggable: ComponentType<{ payload: Json; carry?: unknown; aim?: { x: number; y: number } | null }>;
const DropTarget: ComponentType<{ intent: string; payload: Json }>;
const Swipeable: ComponentType<{ intent: string; payload: Json }>;
const Traceable: ComponentType<{ intent: string; payload: Json }>;
const Touchable: TagType;
const Held: TagType;
const Hovered: TagType;
const PointerOver: TagType;
const Pressed: TagType;
const Traced: TagType;
const Pointer: ResourceType<PointerValue>;
```

`Tappable`, `Pressable`, `Draggable`, `DropTarget`, `Swipeable` and `Traceable` are gestures as
data. `Touchable` reaches the tap listeners and answers nothing. `Held`, `Hovered`, `PointerOver`,
`Pressed` and `Traced` are tags the engine sets. `Pointer` is the followed pointer. See
[input](/docs/game/plugins/input/).

## Assets and scenes

```ts no-check="a simplified signature; the exports are checked against the package"
function defineBundles<Key extends string>(map: Partial<Record<Key, { tier: Tier; files?: readonly string[]; release?: "budget" | "leave"; mipmaps?: true | readonly string[] }>>): BundleMap<Key>;
function load(bundle: string | readonly string[]): Descriptor<LoadResult | undefined>;
function ready(bundle: string | readonly string[]): Descriptor<boolean | undefined>;
function defineScene(id: string, scene: { bundle: string; bundles?: (state) => string[]; layers: LayerMap; projections: readonly Projection[]; music?: string; leave?: SceneLeave | false; enter?: SceneEnter }): SceneDefinition;
```

`defineBundles` describes the bundles of a feature. `load` and `ready` are effects a node awaits.
`defineScene` declares a scene. See [assets](/docs/game/plugins/assets/) and
[scenes](/docs/game/plugins/scenes/).

## Animation

```ts no-check="a simplified signature; the exports are checked against the package"
function defineAnimation<Tags extends SlotTags>(id: string, spec: { slots: Tags; build: (slots, tools: { at }) => Step }): AnimationDefinition<Tags>;
function sequence(...steps: readonly Step[]): Step;
function parallel(...steps: readonly Step[]): Step;
function stagger<Item>(items: readonly Item[], staggerMs: number, build: (item: Item, index: number) => Step): Step;
function tween<Value>(target: Target, component: ComponentHandle<Value>, to: Partial<Value>, options: { ms: number; ease?: Ease; delayMs?: number; additive?: boolean; space?: "local" | "root"; reduced?: "cut" | "keep"; segments?; repeat? }): Step;
function set<Value>(target: Target, component: ComponentHandle<Value>, patch: Partial<Value>): Step;
function wait(durationMs: number): Step;
function mark(name: string): Step;
function frames(target: Target, options: { keys: readonly string[]; fps: number; loop?: boolean }): Step;
function sfx(key: string, options?: { bus?: string; id?: string; fadeMs?: number }): SfxDescriptor;
function stopSfx(id: string, options?: { fadeMs?: number }): StopSfxDescriptor;
function haptic(kind: HapticKind): HapticDescriptor;
function use<Tags>(animation: AnimationDefinition<Tags>, slots: SlotValues<Tags>, tools?: BuildTools): Step;
function spawn(id: string, components: readonly ComponentValue[], options?: { layer?: string; order?: number }): Step;
function spawned(id: string): { spawned: string };
function play<Tags>(animation: AnimationDefinition<Tags>, slots: SlotValues<Tags>): PlayDescriptor;
function external(player: ExternalPlayer, clip: string): never;
function defineMotion(spec: { states?; transition?; on: { enter?; exit?; change? }; when?: "always" | "change" }): ProjectionMotion;
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number;

const Animation: ComponentType<AnimationValue>;
const Frames: ComponentType<{ keys: readonly string[]; fps: number; loop: boolean; playing: boolean }>;
const AnimPlayer: ResourceType<{ play(animation, slots): PlayHandle }>;
```

| Export | What it does |
|---|---|
| `defineAnimation` | Animation as frozen data, built from typed slots. |
| `sequence`, `parallel`, `stagger`, `tween`, `set`, `wait`, `mark`, `frames`, `use` | Steps of a timeline. |
| `sfx`, `stopSfx`, `haptic` | Descriptors `audio` and `platform` handle: as steps, or as effects a node awaits. |
| `spawn`, `spawned` | A temporary entity the timeline despawns when it ends, and a target for it. |
| `play` | The effect a node awaits: `await fx(play(animation, slots))`. |
| `external` | Throws until Spine arrives. |
| `defineMotion` | The enter, exit and change hooks of a projection or a ui tag. |
| `cubicBezier` | A CSS-style easing curve for `tween`'s `ease`. |
| `Animation`, `Frames` | Components: the engine's animation slot, and a sprite's frame loop for its whole life. |
| `AnimPlayer` | The resource a system plays through: `res(AnimPlayer).play(animation, slots)`. |

See [anim](/docs/game/plugins/anim/).

## Strings and text

```ts no-check="a simplified signature; the exports are checked against the package"
function tr(key: string, params?: Record<string, Argument>): Message;
function messageArgument(value: unknown, intl: IntlKit): Part;
function messageDuration(ms: number): Partial<Record<Intl.DurationFormatUnit, number>>;

const Text: ComponentType<TextValue>;
function label(options: { text: string | Message; style: string; at: Point; anchor?: Point }): [TextValue, TransformValue];
function defineTextStyles(map: Record<string, TextStyleInput>): TextStyles;
function defineTextFormats(map: Readonly<Record<string, (value: number) => { content; style }>>): TextFormats;
function bind<Value extends object>(component: ComponentHandle<Value>, field: BindField<Value>, options?: { format?: "int" | "mm:ss" | "h:mm:ss" | "duration" }): TextBind;
const Countdown: ComponentType<{ until: number; left: number }>;
```

| Export | What it does |
|---|---|
| `tr` | Builds a frozen `Message`. No locale is read at the call site. |
| `messageArgument`, `messageDuration` | Called by the compiled strings modules. `messageDuration(95_000)` gives `{ minutes: 1, seconds: 35 }`. |
| `Text`, `label` | Words on the screen, and the `Text` with its `Transform` in one call. |
| `defineTextStyles`, `defineTextFormats` | The text styles and number formats of a feature. |
| `bind`, `Countdown` | Show a numeric component field; count down to a `clock` moment. |

The root also exports the types `BindOptions`, `CountdownValue`, `TextFormat`, `TextFormats`,
`TextFormatAnswer`, `TextFormatFunction` and `FormattedNumber`. See [i18n](/docs/game/plugins/i18n/)
and [text](/docs/game/plugins/text/).

## Interface

```ts no-check="a simplified signature; the exports are checked against the package"
function defineComponent<Properties, Local, Outcomes>(name: string, spec: { local?: Local; outcomes?: Outcomes; view: (props: Properties, local: Local) => DescriptionNode }): ComponentDefinition;
function popup(component: PopupComponent, props: Properties, options?: { over?: string }): Descriptor<Answer>;
function defineStyle<const Given extends Style>(style: Given): Readonly<Given>;
function defineTokens<const Given extends Tokens>(tokens: Given): Readonly<Given>;
function resolve(style: Style | undefined, flags: StyleFlags, viewport: ViewportSize): ResolvedStyle;
function music(key: string | null, options?: { fadeMs?: number }): Descriptor<void>;

const Box: ComponentType<{ x: number; y: number; w: number; h: number }>;
const LocalWrite: ComponentType<LocalWriteValue>;
const ScrollState: ComponentType<{ offset: number; max: number; moving: boolean }>;
const DebugTrigger: TagType;
```

| Export | What it does |
|---|---|
| `defineComponent` | An interface component. With `outcomes` it is a popup. |
| `popup` | The effect that opens a popup and resolves with the pressed button's answer. |
| `defineStyle`, `defineTokens`, `resolve` | The style vocabulary, shared values, and a style computed for given flags. |
| `music` | The effect that switches the music track. |
| `Box`, `LocalWrite`, `ScrollState` | Components of ui elements: the rect, a write into local state, a scroll's offset. |
| `DebugTrigger` | Five taps on that view open the editor's overlay on a page with the agent. |

See [ui](/docs/game/plugins/ui/) and [audio](/docs/game/plugins/audio/).

## Effects

```ts no-check="a simplified signature; the exports are checked against the package"
function defineEmitter(id: string, config: EmitterConfig): EmitterDefinition;
const Emitter: ComponentType<{ effect: string; active: boolean }>;
function defineFilter<Uniforms>(id: string, spec: { wgsl: string; glsl: string; uniforms?: Uniforms; passes?; padding?; inputs?; fallback?; cache?; area? }): FilterComponent;
const Glow: FilterComponent<GlowValue>;
const Outline: FilterComponent<OutlineValue>;
const Blur: ComponentType<BlurValue>;
const ColorMatrix: ComponentType<ColorMatrixValue>;
const Noise: ComponentType<NoiseValue>;
const Displacement: ComponentType<DisplacementValue>;
const Alpha: ComponentType<AlphaValue>;
```

`defineEmitter` and `Emitter` are particles; `defineFilter` makes a filter component from a WGSL
body and its GLSL twin. `Glow`, `Outline`, `Blur`, `ColorMatrix`, `Noise`, `Displacement` and
`Alpha` are the built-in filters. All of them need `effectsPlugin`. See
[effects](/docs/game/plugins/effects/).

## Platform

```ts no-check="a simplified signature; the exports are checked against the package"
const HAPTIC_KINDS: readonly ["light", "medium", "heavy", "selection", "success", "warning", "error"];
```

`HAPTIC_KINDS` is the frozen list of haptic kinds; `HapticKind` is its type. The types
`PlatformProvider` and `BackResult` are root exports too. See [platform](/docs/game/plugins/platform/).

## Type namespaces

`Time`, `Lifecycle`, `Model`, `Clock`, `Flow`, `World`, `Renderer`, `Input`, `Assets`, `Scenes`,
`Anim`, `I18n`, `TextTypes`, `Ui`, `Audio`, `Effects`, `Platform` and `Debug` hold all public
types of one plugin. `Text` is the component, so the text types are `TextTypes`. At run time each
is an empty object.

```ts file="types.ts" check
import type { Anim, Clock, Flow, I18n, Lifecycle, Model, Time } from "@moku-labs/game";

export type Step = Flow.RouteStep; // { at, intent, payload? } or { at, result }
export type Context = Flow.NodeContext;
export type Save = Model.Json;
export type Provider = Model.PlayerStateProvider;
export type Source = Clock.ClockSource;
export type Phase = Time.Phase;
export type Reason = Lifecycle.PauseReason;
export type Target = Anim.Target;
export type Text = I18n.Message;
```

## @moku-labs/game/testing

```ts no-check="a simplified signature; the exports are checked against the package"
function createHeadless(app: HeadlessApp): Promise<HeadlessGame>;
function runRepro(app: HeadlessApp, repro: { player: Json; session?: Json; rng?: RngState; checkpoint?: string; route: Flow.RouteStep[] }): Promise<{ path: string[]; player: Json; session: Json }>;
function stepFrames(app: HeadlessApp, count: number, deltaMs: number): void;
function fakeClock(start?: number): ClockSource & { advance(ms: number): void; set(moment: number): void };
function fakeFx(options?: { answer?: (descriptor: Descriptor) => unknown }): { fx; awaited; started; emitted };
function memory(fixture?: { state: SaveDoc; version: number }): PlayerStateProvider & { calls: ProviderCall[] };
function saveOf(player: Json, seed?: number): SaveDoc;
function isolate(feature: FeaturePlugin, options: { flow: AnyFlow; player: Json; as?: string; shared?; stubs?; plugins?; session?: Json; seed?: number }): (seams?) => App;
function stub<const Name extends string>(outcome: Name, payload?: Json): Stub<Name>;
```

| Export | What it does |
|---|---|
| `createHeadless` | Takes an app that is not started, sets fast mode, starts it and runs the graph. Resolves at the first rest. `HeadlessGame` has `walk`, `answer`, `state`, `history`, `stop`. |
| `runRepro` | Replays a route from a given state. The app keeps running. |
| `stepFrames` | Calls `app.time.step(deltaMs)` `count` times. |
| `fakeClock` | A clock source for tests. `advance` fires due timers synchronously. |
| `fakeFx` | The `fx` of a node context for a unit test of one node. |
| `memory`, `saveOf` | The in-memory save provider with `calls`, and a save document for a fixture. |
| `isolate`, `stub` | Play one feature without the rest of the game; stand in for a node it does not run. |

See [Testing](/docs/game/guides/testing/).

## @moku-labs/game/app

```ts no-check="a simplified signature; the exports are checked against the package"
function defineGameApp(definition: {
  flow: AnyFlow;
  player: Json;
  session: Json;
  safeNode?: string;
  orientation?: "portrait" | "landscape";
  referenceSide?: number;
  referenceLong?: number;
  seed?: number;
  shared?: FeaturePlugin;
  features?: readonly FeaturePlugin[];
  plugins?: readonly AnyPluginInstance[];
  headless?: { features?: readonly FeaturePlugin[]; plugins?: readonly AnyPluginInstance[] };
  pluginConfigs?: GamePluginConfigs;
}): GameApp;
const startMoment = 1_000_000;
```

`defineGameApp` returns the game, `{ headless(seams?), screen(seams?) }`, and creates no app. Each
call gives a fresh `{ app, clock, provider }`, the app not started, on `fakeClock(startMoment)`
and a fresh `memory()` save. `startMoment` is the start of that default fake clock. The types
`GameConfig`, `GameDefinition`, `GameApp`, `GameHandle`, `GamePluginConfigs`, `HeadlessSeams`,
`ScreenSeams`, `MemoryProvider`, `Scenario`, `PageAgent`, `SaveKind` and `SystemName` come from
this entry. See [The game shell](/docs/game/guides/game-shell/).

## @moku-labs/game/app/page

```ts no-check="a simplified signature; the exports are checked against the package"
function startPage(game: GameApp, config: GameConfig, options?: { scenarios?; system?; agents?; devModules? }): Promise<StartedPage>;
```

`startPage` is the page the generated `.moku/main.ts` calls. It resolves the config, builds the
system shell and the save, makes `game.screen()` with the canvas on `#game`, starts the app, runs
the graph, and flushes the save on `pagehide`. It reads `?player=<name>` scenarios and
`?renderer=webgl`.

## @moku-labs/game/app/system

```ts no-check="a simplified signature; the exports are checked against the package"
function systemShellOf(modules: SystemModules): SystemShellFactory;
function fromSystem(system: SystemSlice): PlatformProvider;
function storeSave(store: StoreSlice, key: string, report: (problem: string) => void): PlayerStateProvider;
function createSystemApp(names: readonly SystemName[], namespace: string, modules: SystemModules): Promise<SystemApp>;
```

`systemShellOf` takes one loader per system plugin the `system` list of `config.ts` names. The
generated `main.ts` passes them, so a web-only page bundles no system code. `fromSystem` turns the
system app into the `PlatformProvider` of `platform`, `storeSave` the system store into the save
provider of `save: "store"`, and `createSystemApp` builds the system app. See
[Native](/docs/game/guides/native/).

## @moku-labs/game/cli

```ts no-check="a simplified signature; the exports are checked against the package"
function runCli(argv: readonly string[]): Promise<number>;
function preparePage(root: string, options?: { agents?: readonly string[]; preload?: readonly string[]; servePlugins?: readonly string[] }): Promise<{ html: string; bunfig: string; engine: EngineFingerprint }>;
function watchKeys(root: string, options?: { onError?: (message: string) => void }): Promise<{ close(): void }>;
function watchEngine(root: string, options?: { onChange?: (change: { before; after; restart: boolean }) => void; onError? }): { close(): void };
```

| Export | What it does |
|---|---|
| `runCli` | The bin `moku-game`: `dev`, `build`, `native`, `keys`, `pack`, `visual`, `help`. |
| `preparePage` | Writes the dev page of `moku-game dev` into `<root>/.moku/`, for a server the caller starts. The editor calls it. |
| `watchKeys` | Keeps `generated/` fresh while that page is open. |
| `watchEngine` | Tells when the installed engine changed: restart the page server, or run `bun install`. |

## @moku-labs/game/visual

```ts no-check="a simplified signature; the exports are checked against the package"
function defineVisualTest(name: string, test: { start: VisualStart; steps: readonly VisualStep[]; webgl?: boolean }): VisualTest;
function runVisualTests(setup: VisualSetup, tests: readonly VisualTest[], options?: VisualOptions): Promise<VisualReport>;
function parseVisualArgv(argv: readonly string[]): VisualFlags;
```

`defineVisualTest` describes one test: a start and steps, each a `/control` command or
`{ checkpoint: name }`. `runVisualTests` runs them against the baselines. `parseVisualArgv` reads
the flags of `moku-game visual`. See [Testing](/docs/game/guides/testing/).

## @moku-labs/game/assets

```ts no-check="a simplified signature; the exports are checked against the package"
function scanAssets(options: ScanOptions): Promise<ScanResult>;
function emitKeys(manifest: Manifest): string;
function emitManifest(manifest: Manifest): string;
function compileStrings(root: string, out: string, options?: CompileOptions): Promise<CompileReport>;
function checkStrings(root: string, out: string): Promise<boolean>;
function exportStrings(root: string, dir: string, options?: ExchangeOptions): Promise<ExportReport>;
function importStrings(root: string, dir: string, options?: ImportOptions): Promise<ImportReport>;
function packAssets(options: PackOptions): Promise<PackResult>;
function runCli(argv: string[], strings: StringsTools, ui?: ScanUi): Promise<number>;
```

| Export | What it does |
|---|---|
| `scanAssets` | Scans the `assets/` of every feature and layer into a manifest. |
| `emitKeys`, `emitManifest` | The typed keys module and the manifest file, as text. |
| `compileStrings`, `checkStrings` | Compile the `strings/<locale>.json` files; check the output is up to date. |
| `exportStrings`, `importStrings` | Exchange strings with translators. |
| `packAssets` | The production build: atlas pages, content-hashed names. |
| `runCli` | The bin `moku-game-assets`. A game with `config.ts` runs `moku-game keys` and `moku-game pack` instead. |

See [Assets](/docs/game/guides/assets/).

## @moku-labs/game/inspect

```ts no-check="a simplified signature; the exports are checked against the package"
function read<Output>(app: App, source: Source<Output>, input?: Input): Output;
function watch<Output>(app: App, source: Source<Output>, input: Input, fn: (value: Output) => void): () => void;
function defineSource(source: { id: string; title: string; input: InputSchema; changes: "frame" | "commit" | "edge"; read(app, input): Output }): Source;
const sources: Readonly<{ graph; position; history; tainted; cheats; model; entities; projections; ui; locate; render; sounds; audioMuted; effects; filters; assets; log; explain; diff; schema; at }>;
```

`read` reads a source once. `watch` reads on the `signals` phase when the source changes and
returns the stop function. `defineSource` declares a game's own source. `sources` is the frozen
catalogue; each id is `game.<key>`. Every source only reads, so the door is safe in a production
build. See [Doors for the editor](/docs/game/guides/doors/).

## @moku-labs/game/control

```ts no-check="a simplified signature; the exports are checked against the package"
function run<Output>(app: App, command: Command<Output>, input?: Input): Promise<{ value: Output; state: { path: string; frame: number; tainted: boolean } }>;
function defineCommand(command: { id: string; title: string; input: InputSchema; effect: "read" | "route" | "cosmetic" | "cheat" | "raw"; run(app, input); overlay?: "toggle" | "button" }): Command;
function controlRefused(): ControlRefusedError;
function controlReadOnly(id: string): ControlReadOnlyError;
const commands: Readonly<{ answer; tap; drag; key; walk; bookmark; restore; saveExport; saveImport; step; pause; resume; capture; debug; reducedMotion; fill; scroll; timeScale; frameRate; mute; trace; filter }>;
```

`run` runs a command and resolves `{ value, state }`. Commands run in dev and debug builds only.
`defineCommand` declares a game's own command. `controlRefused()` is the error a command body
throws outside a dev build; `controlReadOnly(id)` the error of a read-only debug page. `commands`
is the frozen catalogue. A `cheat` or `raw` command taints the session. See
[Doors for the editor](/docs/game/guides/doors/).

## @moku-labs/game/hot

```ts no-check="a simplified signature; the exports are checked against the package"
function hot(options?: { include?; exclude? }): HotPlugin;
```

`hot` makes the Bun plugin that hot swaps view files in a running page, for a game with a server
of its own and another layout: `export default hot({ include, exclude })`. The `default` export is
the plugin itself: a `bunfig.toml` lists `@moku-labs/game/hot` under `[serve.static] plugins`.
`moku-game dev` lists it for you. See [Hot swap](/docs/game/guides/hot-swap/).

## @moku-labs/game/lint

```ts no-check="a simplified signature; the exports are checked against the package"
function aliasTargetsOf(tsconfig: string, root: string, specifier: string): string[];
function globToRegExp(glob: string): RegExp;
```

The `default` export is the oxlint JS plugin `moku-game` with eleven rules: `lazy-imports`,
`native-imports`, `dev-imports`, `no-module-state`, `determinism`, `rules-siblings`,
`static-keys`, `layer-imports`, `feature-door`, `sub-features`, `test-suffix`. `aliasTargetsOf`
answers what the layout rules read for an import alias. `globToRegExp` turns a glob into the
expression a rule tests a path against. See [Lint](/docs/game/guides/lint/).

## @moku-labs/game/project

```ts no-check="a simplified signature; the exports are checked against the package"
function openProject(options: { root: string; manifest?: string; tsconfig?: string; debounceMs?: number }): Promise<ProjectApi>;
function runCli(argv: readonly string[], ui?: IndexUi): Promise<number>;
```

`openProject` indexes where every engine id of a game is defined: `index`, `find(key)`,
`watch(onIndex)`, `changed(path)`, `close()`. It needs the optional peer `typescript`. `runCli` is
the bin `moku-game-index`.

## JSX runtime

```ts no-check="a simplified signature; the exports are checked against the package"
function jsx(type: unknown, props: JsxProperties, key?: string): DescriptionNode;
const jsxs: typeof jsx;
function jsxDEV(type: unknown, props: JsxProperties, key?: string, isStatic?: boolean, source?: unknown, self?: unknown): DescriptionNode;
function Fragment(props: JsxProperties): DescriptionNode;
```

`jsx`, `jsxs` and `Fragment` come from `/jsx-runtime`; `/jsx-dev-runtime` adds `jsxDEV`. They
build plain description nodes, and the entry also carries the `JSX` namespace with the intrinsic
tags. A game never imports them by hand: it sets `"jsx": "react-jsx"` and
`"jsxImportSource": "@moku-labs/game"`.

## Example

A headless test of a whole game, from the definition to the committed state.

```ts file="dice.test.ts" check
import { defineGame, type } from "@moku-labs/game";
import { defineGameApp, startMoment } from "@moku-labs/game/app";
import { createHeadless } from "@moku-labs/game/testing";

const { defineNode, defineFlow } = defineGame<{
  player: { coins: number };
  session: { rolls: number };
  assets: string;
  strings: Record<string, unknown>;
}>();

const home = defineNode({ outcomes: { roll: type() }, rest: true, checkpoint: true });
const roll = defineNode({
  outcomes: { done: type() },
  run: ({ player, session, rng, out }) => {
    player.coins += rng.stream("dice").range(1, 6);
    session.rolls += 1;
    return out.done();
  }
});

const mainFlow = defineFlow("main", {
  nodes: { home, roll },
  start: "home",
  edges: { home: { roll: "roll" }, roll: { done: "home" } }
});

const game = defineGameApp({ flow: mainFlow, safeNode: "home", player: { coins: 0 }, session: { rolls: 0 } });

const { app, clock } = game.headless();
const run = await createHeadless(app);

clock.now() === startMoment; // true
await run.walk([{ at: "home", intent: "roll" }, { at: "home", intent: "roll" }]);
app.model.store.snapshot().session; // { rolls: 2 }
await run.stop();
```
