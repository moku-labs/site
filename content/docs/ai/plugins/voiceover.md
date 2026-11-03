---
title: voiceover
description: "Task plugin for text-to-speech. Owns the voiceover contract and the one-off facade app.voiceover.*."
section: Tasks
order: 20
---

## What it does

`voiceover` is the task plugin for text-to-speech. It owns the contract every voiceover provider
implements: `VoiceoverRequest`, `VoiceoverResult` and `VoiceoverHandler`. It exposes a small typed
facade, `app.voiceover.*`, for one-off generation, cost estimates and provider discovery.

The plugin talks to no AI service. Provider plugins register a handler with `registry` under the
task `"voiceover"`. The facade resolves the handler by name and calls it.

Providers that serve this task today:

| Provider | Plugin |
|---|---|
| `elevenlabs` | [elevenlabs](/docs/ai/plugins/elevenlabs/) |
| `openai` | [openai](/docs/ai/plugins/openai/) |

## How it works

The registry carries handlers as `unknown`. This plugin checks the shape at run time and casts
once, at its own resolve site. A malformed registration fails with a clear error, never a crash.

Before dispatch the facade resolves the request. `format` defaults to `config.defaultFormat`.
The narration pack's per-provider defaults are merged under the request's own `params`. The
request wins on a key conflict.

The plugin is stateless. No lifecycle hooks, no events.

## Config

`pluginConfigs.voiceover`.

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultProvider` | `string` | `"elevenlabs"` | Provider the facade uses when a call names none. |
| `defaultFormat` | `"mp3" \| "wav" \| "ogg"` | `"mp3"` | Output format when a request omits `format`. |

```ts check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: {
    voiceover: { defaultProvider: "openai", defaultFormat: "wav" }
  }
});
```

:::callout{tone="warn"}
`defaultProvider` applies to the facade only. A build file item with no `provider` runs on the
build file's `defaults.provider`, else the task's first registered provider.
:::

## API

Mounted at `app.voiceover`, reachable with `ctx.require(voiceoverPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `generate` | `(request: VoiceoverRequest, opts?: { signal?: AbortSignal; provider?: string }) => Promise<VoiceoverResult>` | One-off generation. Direct, not journaled. |
| `estimate` | `(request: VoiceoverRequest, opts?: { provider?: string }) => { usd: number }` | Cost estimate without a call. Synchronous. Same handler `estimate()` the runner's budget gate uses. |
| `providers` | `() => string[]` | Registered voiceover providers, in registration order. |

An unknown provider, or a registered value that fails the shape check, throws:

```text
[ai] No voiceover provider named "<name>" is registered.
  Available: <comma list or "none">.
```

### `VoiceoverRequest`

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | `string` | yes | The text to speak. |
| `voice` | `string` | yes | Provider-scoped voice id or name. |
| `language` | `string` | no | BCP-47 tag, e.g. `"en-US"`, for providers that need a hint. |
| `model` | `string` | no | Provider-scoped model id. |
| `format` | `"mp3" \| "wav" \| "ogg"` | no | Output container. Defaults to `config.defaultFormat`. |
| `params` | `Record<string, unknown>` | no | Provider params. Merged over the pack defaults. |

### `VoiceoverResult`

| Field | Type | Description |
|---|---|---|
| `audio` | `Uint8Array` | The audio bytes. |
| `mimeType` | `string` | `audio/mpeg`, `audio/wav` or `audio/ogg`. |
| `costUsd` | `number` | Actual cost, USD. |
| `meta` | `Record<string, unknown>?` | Metadata only, e.g. `durationMs`, `characters`, `model`. |

## Example

The durable path is a build file item. The runner journals it, so a crash resumes and a second
run reuses the artifact:

```yaml file="lines.moku.yaml"
version: 1
name: lines
items:
  - id: intro
    task: voiceover
    input:
      text: "Welcome to the show."
      voice: "21m00Tcm4TlvDq8ikWAM"
      language: en-US
  - id: intro-wav
    task: voiceover
    provider: openai
    input:
      text: "Welcome to the show."
      voice: alloy
      format: wav
```

The facade is the direct path. Nothing is journaled, so there is no resume and no cost ledger
entry. Use it for scripts, tests and interactive one-offs:

```ts file="say.ts" check
import { app } from "./app";

await app.start();

const { usd } = app.voiceover.estimate({ text: "Welcome to the show.", voice: "alloy" }, { provider: "openai" });
if (usd > 0.01) throw new Error("too expensive for a smoke test");

const controller = new AbortController();
setTimeout(() => controller.abort(), 30_000);

const result = await app.voiceover.generate(
  { text: "Welcome to the show.", voice: "alloy", format: "wav" },
  { provider: "openai", signal: controller.signal }
);
await Bun.write("intro.wav", result.audio);
console.log(result.mimeType, result.costUsd);

console.log(app.voiceover.providers()); // ["elevenlabs", "openai"]
await app.stop();
```

A custom provider registers a `VoiceoverHandler` under `"voiceover"` in its `onInit`:

```ts file="acme-tts.ts" check
import { createPlugin, registryPlugin } from "@moku-labs/ai";
import type { Voiceover } from "@moku-labs/ai";

declare function synthesize(text: string, voice: string): Promise<Uint8Array>;

const handler: Voiceover.VoiceoverHandler = {
  estimate: request => ({ usd: request.text.length * 0.00003 }),
  execute: async request => ({
    audio: await synthesize(request.text, request.voice),
    mimeType: "audio/mpeg",
    costUsd: 0.001
  })
};

export const acmeTtsPlugin = createPlugin("acmeTts", {
  depends: [registryPlugin],
  onInit: ctx => {
    ctx.require(registryPlugin).register("voiceover", "acme", handler);
  }
});
```

:::gotchas
- **`generate` is not journaled.** No resume, no cost ledger entry. Build files and anything worth resuming go through [runner](/docs/ai/plugins/runner/).
- **Request params win.** The narration pack supplies per-provider defaults. A key in `request.params` replaces the pack's value.
- **Providers list in registration order.** `config.defaultProvider` does not change the order of `providers()`.
:::

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): `resolve("voiceover", provider)` and `providers("voiceover")`.

## Related

- [runner](/docs/ai/plugins/runner/): the durable path for the same handlers.
- [elevenlabs](/docs/ai/plugins/elevenlabs/), [openai](/docs/ai/plugins/openai/): the providers.
