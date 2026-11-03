---
title: API reference
description: "Every export of @moku-labs/common, /browser and /cli, with signatures."
section: API reference
order: 40
---

## Entries

| Import | Format | For |
|---|---|---|
| `@moku-labs/common` | ESM and CJS | Node and Bun: every plugin and every provider. |
| `@moku-labs/common/browser` | ESM only | Client bundles. No Node module in its import graph. |
| `@moku-labs/common/cli` | ESM and CJS | Terminal tools: console, prompts, log sink, ANSI primitives. |

Signatures below are simplified for reading. The installed `dist/*.d.mts` files are the source.

## Plugins

Both come from `@moku-labs/common` and `@moku-labs/common/browser`.

```ts no-check="a simplified signature; the exports are checked against the package"
const logPlugin: CorePluginInstance<"log", LogConfig, LogState, LogApi>;
const envPlugin: CorePluginInstance<"env", EnvConfig, EnvState, EnvApi>;
```

Register them in `createCoreConfig({ plugins })`. Config, API and examples are on their pages:
[log](/docs/common/plugins/log/) and [env](/docs/common/plugins/env/).

## Env providers

```ts no-check="a simplified signature; the exports are checked against the package"
function dotenv(path?: string): EnvProvider;
function processEnv(): EnvProvider;
function cloudflareBindings(): EnvProvider;
function workerSafeProcessEnv(): EnvProvider;
function browserEnv(options?: { globalKey?: string }): EnvProvider;
```

| Provider | Name | Reads | Entry |
|---|---|---|---|
| `dotenv` | `dotenv:<path>` | The file at `path`, `.env.local` by default, on each `load()` | root |
| `processEnv` | `process-env` | A copy of `process.env` | root |
| `cloudflareBindings` | `cloudflare` | `globalThis.__CLOUDFLARE_ENV__` | root |
| `workerSafeProcessEnv` | `worker-process-env` | A copy of `process.env`, `{}` without `process` | root |
| `browserEnv` | `browser-env` | `import.meta.env`, then `globalThis[globalKey]`, default `__ENV__` | root and `/browser` |

## Type namespaces

`Log` and `Env` hold types only: `Log.LogApi`, `Env.EnvConfig`. At run time they are empty objects.
The same types are also exported flat, so a framework's inferred types can name them.

| Type | What it is |
|---|---|
| `LogConfig` | `{ mode }`. |
| `LogLevel` | `"debug" \| "info" \| "warn" \| "error"`. |
| `LogEntry` | `{ level, event, data?, ts, plugin? }`. |
| `LogSink` | `{ write(entry) }`. |
| `LogApi` | The API at `ctx.log`. |
| `ExpectChain` | What `expect()` returns. |
| `LogState` | `{ entries, sinks }`. Internal. |
| `EnvConfig` | `{ schema, providers, publicPrefix }`. |
| `EnvVarSpec` | `{ public, required?, default?, secret? }`. |
| `EnvProvider` | `{ name, load() }`. |
| `EnvApi` | The API at `ctx.env`. |
| `EnvState` | `{ resolved, publicMap }`. Internal. |

## CLI: console and prompts

From `@moku-labs/common/cli`. Members and options are on [Branded CLI](/docs/common/guides/branded-cli/).

```ts no-check="a simplified signature; the exports are checked against the package"
function createBrandConsole(options?: BrandConsoleOptions): BrandConsole;
function createBrandPrompts(options?: BrandPromptsOptions): BrandPrompts;
function brandedSink(minLevel?: LogLevel): LogSink;
```

## CLI: primitives

```ts no-check="a simplified signature; the exports are checked against the package"
const ANSI: { reset; bold; dim; red; green; yellow; blue; magenta; cyan; gray };
const BRAND_PINK: { r: 255; g: 30; b: 111 };
const CLEAR_LINE: string;
const CLEAR_BELOW: string;
const SPINNER_FRAMES: readonly string[];

function fg24(r: number, g: number, b: number): string;
function cursorUp(n: number): string;
function supportsColor(stream?: { isTTY?: boolean }, noColor?: string): boolean;
function supportsTruecolor(colorTerm?: string): boolean;
function spinnerFrameAt(elapsedMs: number, frameMs?: number): string;
function boxGlyphs(color: boolean): BoxGlyphs;
function visibleWidth(text: string): number;
function makePalette(color: boolean, truecolor?: boolean): Palette;
function box(lines: string[], color: boolean, minInnerWidth?: number): string[];
```

| Export | Description |
|---|---|
| `ANSI` | SGR codes, each with the ESC byte. |
| `BRAND_PINK` | The brand color as an RGB triple. |
| `CLEAR_LINE` | Erases the current line. |
| `CLEAR_BELOW` | Erases from the cursor to the end of the screen. |
| `SPINNER_FRAMES` | The braille spinner glyphs. |
| `fg24` | A 24-bit foreground escape. |
| `cursorUp` | Moves the cursor up `n` lines. `""` when `n` is 0 or less. |
| `supportsColor` | `true` on a TTY with `NO_COLOR` unset. |
| `supportsTruecolor` | `true` when `COLORTERM` is `truecolor` or `24bit`. |
| `spinnerFrameAt` | The frame for an elapsed time, 80 ms per frame by default. |
| `boxGlyphs` | Unicode corners and edges when `color` is true, ASCII when false. |
| `visibleWidth` | String length without ANSI codes. |
| `makePalette` | `paint`, `bold`, `dim`, `green`, `yellow`, `red`, `cyan`, `pink`. Each returns its input as it is when `color` is false. |
| `box` | Returns framed lines. It does not print. |

Types: `AnsiCode`, `BoxGlyphs`, `BrandConsole`, `BrandConsoleOptions`, `BrandPrompts`,
`BrandPromptsOptions`, `ColorStream`, `LockupOptions`, `Palette`.
