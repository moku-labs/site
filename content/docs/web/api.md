---
title: API reference
description: "Every export of @moku-labs/web and @moku-labs/web/browser, with signatures."
section: API reference
order: 40
---

## Entries

| Import | Format | For |
|---|---|---|
| `@moku-labs/web` | ESM and CJS | The Node app: the build, the deploy, the CLI. Everything below. |
| `@moku-labs/web/browser` | ESM only | The client bundle. No Node module in its import graph. `env` reads `browserEnv()` with no config. |
| `@moku-labs/web/testing` | ESM only | Island test helpers: `mountIsland`, `renderIsland`. |

Signatures below are simplified for reading. The installed `dist/index.d.mts` is the source.

## createApp

```ts no-check="a simplified signature; the exports are checked against the package"
function createApp<const ExtraPlugins extends readonly AnyPluginInstance[] = readonly []>(options?: {
  plugins?: ExtraPlugins;
  config?: { stage?: "production" | "development" | "test"; mode?: "ssg" | "spa" | "hybrid" };
  pluginConfigs?: { [pluginName: string]: Partial<PluginConfig> };
  onReady?: (ctx: AppCallbackContext) => void;
  onError?: (error: Error, ctx: AppCallbackContext) => void;
  onStart?: (ctx: AppCallbackContext) => void | Promise<void>;
  onStop?: (ctx: AppCallbackContext) => void | Promise<void>;
}): App;
```

Creates and initializes an app. It is synchronous: every plugin's config is resolved, every
`onInit` runs, and the frozen app is returned. Both entries export it, over the same five default
plugins (`site`, `i18n`, `router`, `head`, `spa`) and the core plugins `log` and `env`.

| Option | Default | Description |
|---|---|---|
| `plugins` | `[]` | Extra plugins, merged into the app and into its type. Order matters: a plugin comes after the plugins it depends on. |
| `config.stage` | `"production"` | Drafts are hidden only in `"production"`. |
| `config.mode` | `"hybrid"` | `"ssg"`, `"spa"` or `"hybrid"`. Read by plugins through `router.mode()`. |
| `pluginConfigs` | `{}` | Per-plugin overrides, keyed by plugin name, shallow-merged over the defaults. |
| `onReady`, `onError`, `onStart`, `onStop` | none | Lifecycle callbacks with the app context. |

The returned app:

| Member | What it is |
|---|---|
| `start()` | Runs every plugin's `onStart`. In the browser this boots `spa`. Call it once. |
| `stop()` | Runs every plugin's `onStop`. |
| `emit(event, payload)` | Emits a typed event. Only known names compile. |
| `require(plugin)`, `has(name)` | Plugin lookup. |
| `log`, `env` | The core plugin APIs. |
| `site`, `i18n`, `router`, `head`, `spa` | The default plugin APIs. |
| `<name>` | The API of every plugin in `plugins`, for example `app.build`, `app.content`. |

## createPlugin

```ts no-check="a simplified signature; the exports are checked against the package"
function createPlugin<Name extends string, Config, State, Api, Deps, Events, Hooks, Helpers>(
  name: Name,
  spec: {
    config?: Config;
    depends?: Deps;
    createState?: (ctx: { global; config }) => State;
    events?: (register) => Events;
    api?: (ctx: PluginContext) => Api;
    hooks?: (ctx: PluginContext) => Hooks;
    helpers?: Helpers;
    onInit?: (ctx: PluginContext) => void;
    onStart?: (ctx: PluginContext) => void | Promise<void>;
    onStop?: (ctx: { global; config; state }) => void | Promise<void>;
  }
): PluginInstance<Name, Config, State, Api, Events> & Helpers;
```

Writes a plugin bound to this framework's config, events and core plugins. Never pass the type
parameters: they are inferred from the spec. `ctx` carries `global`, `config`, `state`, `emit`,
`require`, `has`, `log` and `env`. A plugin listed in `depends` makes its events available to
`hooks`, with typed payloads.

```ts file="src/plugins/visits.ts" check
import { createPlugin, spaPlugin } from "@moku-labs/web/browser";

export const visitsPlugin = createPlugin("visits", {
  depends: [spaPlugin],
  config: { limit: 50 },
  createState: (): { urls: string[] } => ({ urls: [] }),
  events: register => ({
    "visits:full": register<{ count: number }>("The visit list reached its limit") // [!note] Plugin events are declared with `register`, never as a plain object.
  }),
  hooks: ctx => ({
    "spa:navigated": ({ url }) => {
      ctx.state.urls.push(url);
      if (ctx.state.urls.length === ctx.config.limit) ctx.emit("visits:full", { count: ctx.state.urls.length });
    }
  }),
  api: ctx => ({ recent: () => [...ctx.state.urls] })
});
```

## Routing

```ts no-check="a simplified signature; the exports are checked against the package"
function route<P extends string>(pattern: P): RouteBuilder<RouteState<P>>;
function defineRoutes<T extends RouteMap>(routes: T): T;
function createUrls<T extends RouteMap>(routes: T, defaultLocale?: string): Urls<T>;

interface RouteBuilder<S extends RouteState> extends RouteDefinition {
  load<D>(loader: (ctx: LoadContext<S>) => D | Promise<D>): RouteBuilder<{ params: S["params"]; data: Awaited<D> }>;
  generate(handler: (ctx: GenerateContext) => S["params"][] | Promise<S["params"][]>): RouteBuilder<S>;
  render(handler: (ctx: RouteContext<S>) => VNode): RouteBuilder<S>;
  head(handler: (ctx: RouteContext<S>) => HeadConfig): RouteBuilder<S>;
  layout(component: (ctx: LayoutContext<S>, children: ComponentChildren) => VNode): RouteBuilder<S>;
  meta(meta: Record<string, unknown>): RouteBuilder<S>;
  transition(mode: "none" | "crossfade" | "slide" | "morph"): RouteBuilder<S>;
  scroll(mode: "top" | "preserve"): RouteBuilder<S>;
  toJson(handler: (ctx: RouteContext<S>) => unknown): RouteBuilder<S>;
  toFile(handler: (params: S["params"]) => string): RouteBuilder<S>;
}

interface Urls<T extends RouteMap> {
  toUrl<K extends keyof T & string>(name: K, params?: Record<string, string>): string;
}
```

| Context | Members |
|---|---|
| `GenerateContext` | `locale`, `require(plugin)`, `has(name)` |
| `LoadContext` | `params`, `locale`, `require(plugin)`, `has(name)` |
| `RouteContext` | `params`, `data`, `locale`, `meta`, `url(name, params?)` |

`params` is inferred from the pattern: `{x}` is required, `{x:?}` optional. Only `load` widens
`data`. `toJson` stores a serializer on the route; no built-in plugin reads it in 2.4.11. See
[Routing](/docs/web/guides/routing/).

## Islands and navigation

```ts no-check="a simplified signature; the exports are checked against the package"
function createIsland<S extends object = object, A = unknown>(name: string, spec: IslandSpec<S, A>): IslandDef;

interface IslandSpec<S, A> {
  state?: (ctx: IslandContext<S>) => S;
  render?: (state: Readonly<S>, ctx: IslandContext<S>) => VNode | Node | string | null | void;
  events?: Record<string, (ctx: IslandContext<S>, event: Event, target: Element) => void>;
  api?: (ctx: IslandContext<S>) => A;
  onCreate?(ctx: IslandContext<S>): void;
  onMount?(ctx: IslandContext<S>): void;
  onNavStart?(ctx: IslandContext<S>): void;
  onNavEnd?(ctx: IslandContext<S>): void;
  onUnMount?(ctx: IslandContext<S>): void;
  onDestroy?(ctx: IslandContext<S>): void;
}

const lazyEmbed: IslandDef;
function navigate(path: string, options?: { scroll?: "top" | "preserve"; replace?: boolean }): void;
function hardNavigate(url: string): void;
function createChannel<T>(options: ChannelOptions<T>): Channel<T>;
```

`IslandContext` has `el`, `data`, `params`, `meta`, `locale`, `url`, `navigate`, `state`,
`set(patch)`, `flush()`, `cleanup(dispose)` and `island<T>(name)`. `createIsland` throws on an
empty name or an unknown hook. `lazyEmbed` activates the `::embed` facades of the content
pipeline. `navigate` and `hardNavigate` are no-ops before `app.start()`. See
[Islands](/docs/web/guides/islands/) and [SPA navigation](/docs/web/guides/spa/).

```ts no-check="a simplified signature; the exports are checked against the package"
interface ChannelOptions<T> {
  url: (id: string) => string;
  parse?: (raw: string) => T | undefined; // default: JSON.parse, dropping frames that fail
  keepAlive?: { send: string; ignore?: string; everyMs?: number }; // everyMs default 30000
  reconnect?: { baseMs?: number; maxMs?: number } | false; // default 500 → 8000, doubling
  bufferUntilSeed?: boolean; // default false
  shouldReconnect?: (event: CloseEvent) => boolean;
}

interface Channel<T> {
  subscribe(id: string, handler: (message: T) => void): () => void;
  seed(id: string): void;
  deliverLocal(id: string, message: T): void;
  send(raw: string): void;
  current(): string | undefined;
  disconnect(): void;
}
```

## Head helpers

```ts no-check="a simplified signature; the exports are checked against the package"
function meta(name: string, content: string): HeadElement;
function og(property: string, content: string): HeadElement;
function twitter(name: string, content: string): HeadElement;
function jsonLd(data: unknown): HeadElement;
function canonical(url: string): HeadElement;
function hreflang(locale: string, url: string): HeadElement;
function feedLink(title: string, url: string, type?: string): HeadElement;
function buildArticleHead(articleMeta: ArticleMeta, canonicalUrl: string): HeadElement[];

type HeadElement = { tag: "meta" | "link" | "title" | "script"; attrs?: Record<string, string>; children?: string; key?: string };
type ArticleMeta = { title: string; description?: string; author?: string; published?: string; modified?: string; section?: string; tags?: string[]; image?: string };
```

See [Head & SEO](/docs/web/guides/head/).

## Collections

```ts no-check="a simplified signature; the exports are checked against the package"
function collectionUrl(baseUrl: string, collection: string, shard: string): string;
function loadCollectionShard<T>(baseUrl: string, collection: string, shard: string): Promise<T>;
```

`collectionUrl("/", "bank", "en/animals")` is `"/bank/en/animals.json"`. `loadCollectionShard`
fetches and parses that URL and throws on a non-OK response. Both are browser-safe.

## Content (Node)

```ts no-check="a simplified signature; the exports are checked against the package"
function fileSystemContent(options: FileSystemContentOptions): ContentProvider;
function EmbedFacadeButton(props: EmbedFacadeProps): VNode;
function GalleryTrack(props: GalleryProps): VNode;
```

`fileSystemContent` is the Node content provider; its options are on the
[content plugin page](/docs/web/plugins/content/). `EmbedFacadeButton` and `GalleryTrack` are the
default inner components of `::embed` and `::gallery`, exported to compose your own.

## Plugins

| Export | `app.<name>` | Kind | `/browser` |
|---|---|---|---|
| `sitePlugin` | `site` | default | yes |
| `i18nPlugin` | `i18n` | default | yes |
| `routerPlugin` | `router` | default; also `.route`, `.defineRoutes`, `.createUrls` | yes |
| `headPlugin` | `head` | default; also the eight head helpers | yes |
| `spaPlugin` | `spa` | default | yes |
| `contentPlugin` | `content` | opt-in | yes, for `ctx.require` and types |
| `dataPlugin` | `data` | opt-in | yes |
| `collectionPlugin` | `collection` | opt-in | no |
| `buildPlugin` | `build` | Node-only | no |
| `deployPlugin` | `deploy` | Node-only | no |
| `cliPlugin` | `cli` | Node-only | no |

The default plugins are always in the app. Their exports are for `ctx.require(...)`, `depends` and
types. Each plugin's config, API and events are on its own page under Plugins.

## Plugin APIs on app

| Member | Plugin |
|---|---|
| `app.site.name()` `url()` `author()` `description()` `canonical(path)` | [site](/docs/web/plugins/site/) |
| `app.i18n.locales()` `defaultLocale()` `isLocale(x)` `localeName(l)` `ogLocale(l)` `t(l, key)` | [i18n](/docs/web/plugins/i18n/) |
| `app.router.match(path)` `toUrl(name, params)` `entries()` `manifest()` `clientManifest()` `mode()` | [router](/docs/web/plugins/router/) |
| `app.head.render(route, data)` `siteHead(input)` `composeTitle(head)` | [head](/docs/web/plugins/head/) |
| `app.spa.register(island)` `navigate(path, options?)` `hardNavigate(url)` `current()` `island(name)` | [spa](/docs/web/plugins/spa/) |
| `app.content.loadAll(options?)` `load(slug, locale)` `renderMarkdown(md)` `invalidate(paths)` `articleToCard(a)` `contentDir()` | [content](/docs/web/plugins/content/) |
| `app.data.at(path)` `write(entries, options?)` `urlFor(path)` `fileFor(path)` | [data](/docs/web/plugins/data/) |
| `app.collection.at(c, s)` `write(entries, options?)` `urlFor(c, s)` `fileFor(c, s)` | [collection](/docs/web/plugins/collection/) |
| `app.build.run(options?)` `phases()` | [build](/docs/web/plugins/build/) |
| `app.deploy.run(options?)` `init(options?)` `getLastDeployment()` `projectName()` `createProject()` | [deploy](/docs/web/plugins/deploy/) |
| `app.cli.build(options?)` `update(changes, options?)` `serve(options?)` `preview(options?)` `deploy(options?)` | [cli](/docs/web/plugins/cli/) |

## Core plugins and env providers

Re-exported from `@moku-labs/common`.

| Export | Signature | `/browser` |
|---|---|---|
| `logPlugin` | core plugin, mounted at `ctx.log` and `app.log` | yes |
| `envPlugin` | core plugin, mounted at `ctx.env` and `app.env`: `get`, `require`, `has`, `getPublic`, `getPublicMap` | yes |
| `browserEnv` | `(options?: { globalKey?: string }) => EnvProvider`: reads `import.meta.env` and `globalThis.__ENV__` | yes, the default provider there |
| `processEnv` | `() => EnvProvider`: a copy of `process.env` | no |
| `dotenv` | `(path?: string) => EnvProvider`: a `.env` file, default `.env.local`, re-read on every load | no |
| `cloudflareBindings` | `() => EnvProvider`: `globalThis.__CLOUDFLARE_ENV__` per request | no |

On Node, `env` has no provider until you compose one:
`pluginConfigs: { env: { providers: [processEnv(), dotenv(".env")] } }`. The first provider with
a non-empty value wins.

## Types

Every plugin's types are grouped in a namespace, used as `Router.RouteContext`,
`Content.Article` and so on. The namespaces are type-only.

| Namespace | Main members | `/browser` |
|---|---|---|
| `Router` | `RouteBuilder`, `RouteState`, `RouteContext`, `LoadContext`, `GenerateContext`, `LayoutContext`, `RouteDefinition`, `RouteMap`, `Urls`, `RouterApi`, `RouterConfig`, `TypedRoute`, `ClientRoute`, `HeadConfig`, `TransitionMode`, `ScrollMode`, `ExtractRouteParams` | yes |
| `Head` | `Config`, `Api`, `HeadConfig`, `HeadElement`, `ArticleMeta`, `ResolvedRoute`, `HeadDefaults` | yes |
| `Spa` | `IslandSpec`, `IslandDef`, `IslandContext`, `IslandHooks`, `IslandEvents`, `IslandRender`, `RenderResult`, `NavigateOptions`, `SpaApi`, `SpaConfig`, `SpaEvents`, `PageData`, `TransitionMode`, `ScrollMode` | yes |
| `Content` | `Article`, `ArticleCard`, `Frontmatter`, `ComputedFields`, `ContentProvider`, `FileSystemContentOptions`, `MermaidDiagramOptions`, `LoadAllOptions`, `ContentEvents`, `Api`, `Config` | yes |
| `Data` | `DataConfig`, `DataEntry`, `DataProvider`, `DataWriteSummary`, `DataState` | yes |
| `Collection` | `CollectionConfig`, `CollectionShard`, `CollectionProvider`, `CollectionWriteSummary`, `CollectionState` | yes |
| `Build` | `Config`, `Api`, `RunOptions`, `BuildRunOverrides`, `BuildResult`, `BuildEvents`, `PhaseName`, `OgImageConfig`, `OgFont`, `RichOgInput` | no |
| `Deploy` | `Config`, `Api`, `DeployResult`, `DeployRunOptions`, `DeployInitOptions`, `InitResult`, `CreateProjectResult`, `DeployErrorCode`, `WorkflowTrigger` | no |
| `Cli` | `Config`, `Api`, `BuildOptions`, `BuildSummary`, `ServeOptions`, `PreviewOptions`, `UpdateOptions`, `DeployOptions`, `DeployOutcome`, `CliErrorCode`, `CliRenderer`, `Command` | no |
| `Env`, `Log` | the `env` and `log` types from `@moku-labs/common` | yes |

Also exported as types: `Channel`, `ChannelOptions`, `ChannelKeepAlive`, `ChannelReconnect` (both
entries) and `EmbedFacade`, `EmbedFacadeProps`, `EmbedOptions`, `GalleryComponent`,
`GalleryOptions`, `GalleryProps`, `GallerySlide` (Node entry).

```tsx file="src/components/article-card.tsx" check
import type { Content, Router } from "@moku-labs/web/browser";

type CardContext = Router.RouteContext<Router.RouteState<"/{lang:?}/", Content.ArticleCard[]>>;

export function ArticleList(ctx: CardContext) {
  return (
    <ul>
      {ctx.data.map(card => (
        <li key={card.contentId}>
          <a href={card.url}>{card.title}</a>
        </li>
      ))}
    </ul>
  );
}
```

## Testing

```ts no-check="a simplified signature; the exports are checked against the package"
function mountIsland<S extends object = object, A = unknown>(definition: IslandDef, options?: MountIslandOptions): IslandHandle<S, A>;
function renderIsland<S extends object>(render: IslandRender<S>, input: { state: S; ctx?: Partial<IslandContext<S>> }): RenderIslandResult;
```

`mountIsland` mounts one island through the real spa internals, with no `createApp`. Options:
`html`, `el`, `params`, `meta`, `data`, `locale`, `url`, `persistent`, `islands`. The handle has
`el`, `state`, `api`, `emitted`, `fire(spec)`, `dispatch(selector, event)`, `flush()`,
`settle()`, `navStart()`, `navEnd(route?)` and `unmount()`. `renderIsland` renders a `render`
function against fixture state and returns `host`, `html()`, `find(selector)` and `unmount()`.
Both need a DOM in the test runner.
