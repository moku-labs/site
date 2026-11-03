---
title: API reference
description: "Every export of @moku-labs/ai, with signatures."
section: API reference
order: 70
---

## Entries

| Import | Format | For |
|---|---|---|
| `@moku-labs/ai` | ESM and CJS | Everything below. Node and Bun only. |

The package also ships the `moku` bin. See [cli](/docs/ai/plugins/cli/).

Signatures below are simplified for reading. The installed `dist/index.d.mts` is the source.

## createApp

```ts no-check="a simplified signature; the exports are checked against the package"
function createApp<const ExtraPlugins extends readonly AnyPluginInstance[] = readonly []>(options?: {
  plugins?: ExtraPlugins;
  config?: {};
  pluginConfigs?: { [pluginName: string]: Partial<PluginConfig> };
  onReady?: (ctx: AppCallbackContext) => void;
  onError?: (error: Error, ctx: AppCallbackContext) => void;
  onStart?: (ctx: AppCallbackContext) => void | Promise<void>;
  onStop?: (ctx: AppCallbackContext) => void | Promise<void>;
}): App;
```

Creates the app with every plugin. It is synchronous. Providers register their handlers here, so
`app.registry` is full when it returns. The global `config` is empty: all settings are per plugin.

| Member | What it is |
|---|---|
| `start()` | Opens the journal and starts the plugins. Call it before `app.runner` or the journal. |
| `stop()` | Pauses active runs, waits for them, closes the journal. |
| `emit(event, payload)` | Emits a typed event. |
| `require(plugin)`, `has(name)` | Finds a plugin. |
| `log`, `env`, `journal`, `store`, `limits` | The core plugins. |
| `registry`, `buildfile`, `runner`, `compose`, `cli` | The pipeline. |
| `voiceover`, `translate`, `promptGen`, `image`, `video`, `music`, `sfx`, `sprite`, `asset` | The task facades. |
| `elevenlabs`, `openai`, `anthropic`, `codex`, `claude`, `fal`, `apimodels`, `ark` | The providers. |

`journal`, `store` and `limits` read `pluginConfigs` like any other plugin.

## createPlugin

```ts no-check="a simplified signature; the exports are checked against the package"
function createPlugin<const Name extends string>(name: Name, spec: {
  depends?: readonly AnyPluginInstance[];
  config?: Config;
  createState?: (ctx) => State;
  api?: (ctx) => Api;
  events?: (register) => Events;
  hooks?: (ctx) => EventHandlers;
  onInit?: (ctx) => void;
  onStart?: (ctx) => void | Promise<void>;
  onStop?: (ctx) => void | Promise<void>;
}): PluginInstance;
```

The factory for your own plugins, bound to this framework. Its `ctx` has `journal`, `store`,
`limits`, `log` and `env`. Add a handler with [Add a provider or a task](/docs/ai/guides/custom-provider/).

## defineBuild

```ts no-check="a simplified signature; the exports are checked against the package"
function defineBuild(spec: BuildSpec): BuildSpec;
```

Validates a TypeScript build file through the YAML loader's schema. Throws
`[ai] Build file "<inline>" is invalid.` See [buildfile](/docs/ai/plugins/buildfile/).

## defineConfig

```ts no-check="a simplified signature; the exports are checked against the package"
function defineConfig<const P extends readonly AnyPluginInstance[] = readonly []>(config: ProjectConfig<P>): ProjectConfig<P>;
```

Types `moku.config.ts` and returns its argument. `ProjectConfig` is the `plugins` and
`pluginConfigs` of `createApp`. See [cli](/docs/ai/plugins/cli/#project-config).

## Plugin instances

Pass these to `ctx.require(...)` and to `depends`.

| Group | Exports |
|---|---|
| Core | `journalPlugin`, `storePlugin`, `limitsPlugin` |
| Pipeline | `registryPlugin`, `buildfilePlugin`, `runnerPlugin`, `composePlugin`, `cliPlugin` |
| Tasks | `voiceoverPlugin`, `translatePlugin`, `promptGenPlugin`, `imagePlugin`, `videoPlugin`, `musicPlugin`, `sfxPlugin`, `spritePlugin`, `assetPlugin` |
| Providers | `elevenlabsPlugin`, `openaiPlugin`, `anthropicPlugin`, `codexPlugin`, `claudePlugin`, `falPlugin`, `apimodelsPlugin`, `arkPlugin` |

## Tool loop

```ts no-check="a simplified signature; the exports are checked against the package"
function runToolLoop(options: RunToolLoopOptions): Promise<RunToolLoopResult>;
function isPromptGenUnavailable(error: unknown): boolean;
class PromptGenUnavailableError extends Error {
  readonly unavailable: true;
  readonly reason: "missing" | "auth" | "limit" | "unsupported";
}
class ToolArgumentsError extends Error {
  readonly toolName: string;
  readonly raw: string;
}
```

`runToolLoop` runs a tool loop that the caller journals. `PromptGenUnavailableError` makes
`promptGen` try the next provider in its `fallback`. See [Tool loop](/docs/ai/guides/tool-loop/).

## Assets

```ts no-check="a simplified signature; the exports are checked against the package"
const ASSET_MIME = "application/vnd.moku.asset+json";
function encodeAssetRecord(record: AssetRecord): Uint8Array;
function parseAssetRecord(bytes: Uint8Array): AssetRecord;
```

An `asset` artifact is a JSON record, not a picture. `AssetRecord` is
`{ assetId, provider, account, groupId, registeredAt }`. See [asset](/docs/ai/plugins/asset/).

## Type namespaces

Each plugin's types are one namespace: `Runner.RunResult`, `Voiceover.VoiceoverHandler`,
`Cli.EXIT_CODES`. Most hold `Config` and the plugin's API type.

| Group | Namespaces |
|---|---|
| Core | `Journal`, `Store`, `Limits` |
| Pipeline | `Buildfile`, `Runner`, `Compose`, `Cli` |
| Tasks | `Voiceover`, `Translate`, `PromptGen`, `Image`, `Video`, `Music`, `Sfx`, `Sprite`, `Asset` |
| Providers | `Elevenlabs`, `Openai`, `Anthropic`, `Codex`, `Claude`, `Fal`, `Apimodels`, `Ark` |

## Error namespaces

Each provider's error classes are one namespace. Most have `RetryableProviderError`,
`TerminalProviderError` and `FlaggedProviderError`. `CodexErrors` and `ClaudeErrors` have no flagged class.

| Namespace | Provider |
|---|---|
| `ElevenlabsErrors` | [elevenlabs](/docs/ai/plugins/elevenlabs/) |
| `OpenaiErrors` | [openai](/docs/ai/plugins/openai/) |
| `AnthropicErrors` | [anthropic](/docs/ai/plugins/anthropic/) |
| `CodexErrors` | [codex](/docs/ai/plugins/codex/) |
| `ClaudeErrors` | [claude](/docs/ai/plugins/claude-code/) |
| `FalErrors` | [fal](/docs/ai/plugins/fal/) |
| `ApimodelsErrors` | [apimodels](/docs/ai/plugins/apimodels/) |
| `ArkErrors` | [ark](/docs/ai/plugins/ark/) |

## Environment

| Variable | Used by |
|---|---|
| `ELEVENLABS_API_KEY` | `elevenlabs` |
| `OPENAI_API_KEY` | `openai` |
| `ANTHROPIC_API_KEY` | `anthropic` |
| `FAL_KEY` | `fal` |
| `APIMODELS_API_KEY` | `apimodels` |
| `ARK_API_KEY`, `ARK_ACCESS_KEY`, `ARK_SECRET_KEY` | `ark` |
| `NO_COLOR` | `cli`: plain output |

Keys are read when a request runs, from the shell or from `.env.local` in the working directory. The
shell wins. Estimates and validation need none. `codex` and `claude` find their CLI on `PATH`.
