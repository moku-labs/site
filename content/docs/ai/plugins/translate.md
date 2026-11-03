---
title: translate
description: "Task plugin for text translation. Owns the translate contract and the one-off facade app.translate.*."
section: Tasks
order: 21
---

## What it does

`translate` is the task plugin for text translation. It owns the contract every translate provider
implements: `TranslateRequest`, `TranslateResult` and `TranslateHandler`. It exposes a typed
facade, `app.translate.*`, for one-off translation, cost estimates and provider discovery.

The plugin talks to no AI service. Provider plugins register a handler with `registry` under the
task `"translate"`. The facade resolves the handler by name and calls it.

Providers that serve this task today:

| Provider | Plugin |
|---|---|
| `openai` | [openai](/docs/ai/plugins/openai/) |

## How it works

The registry carries handlers as `unknown`. This plugin checks that `estimate` and `execute` are
functions, then casts once at its own resolve site. A registered value that fails the check throws:

```text
[ai] Registered translate provider "<name>" does not implement TranslateHandler.
  It must expose estimate() and execute() functions.
```

The plugin is stateless. No lifecycle hooks, no events.

## Config

`pluginConfigs.translate`.

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultProvider` | `string` | `"openai"` | Provider the facade uses when a call names none. |

```ts check
import { createApp } from "@moku-labs/ai";

const app = createApp({
  pluginConfigs: { translate: { defaultProvider: "openai" } }
});
```

:::callout{tone="warn"}
`defaultProvider` applies to the facade only. A build file item with no `provider` runs on the
build file's `defaults.provider`, else the task's first registered provider.
:::

## API

Mounted at `app.translate`, reachable with `ctx.require(translatePlugin)`.

| Method | Signature | Description |
|---|---|---|
| `generate` | `(request: TranslateRequest, opts?: { signal?: AbortSignal; provider?: string }) => Promise<TranslateResult>` | One-off translation. Direct, not journaled. |
| `estimate` | `(request: TranslateRequest, opts?: { provider?: string }) => { usd: number }` | Cost estimate without a call. Synchronous. |
| `providers` | `() => string[]` | Registered translate providers, in registration order. |

An unknown provider throws:

```text
[ai] No translate provider named "<name>" is registered.
  Available: <comma list or "none">.
```

### `TranslateRequest`

| Field | Type | Required | Description |
|---|---|---|---|
| `text` | `string` | yes | The text to translate. |
| `targetLang` | `string` | yes | BCP-47 tag of the target language. |
| `sourceLang` | `string` | no | BCP-47 tag of the source. Omitted means auto-detect. |
| `model` | `string` | no | Provider-scoped model id. |
| `params` | `Record<string, unknown>` | no | Provider params. |

### `TranslateResult`

| Field | Type | Description |
|---|---|---|
| `text` | `string` | The translated text. |
| `detectedSourceLang` | `string?` | The detected source language, when the provider reports it. |
| `costUsd` | `number` | Actual cost, USD. |
| `meta` | `Record<string, unknown>?` | Metadata only: token counts, model. |

## Example

The durable path is a build file item:

```yaml file="strings.moku.yaml"
version: 1
name: strings
items:
  - id: greeting-es
    task: translate
    provider: openai
    input:
      text: "Hello, world!"
      targetLang: es
      sourceLang: en
```

The facade is the direct path. Nothing is journaled:

```ts file="translate.ts" check
import { app } from "./app";
import type { Translate } from "@moku-labs/ai";

await app.start();

const request: Translate.TranslateRequest = {
  text: "Hello, world!",
  targetLang: "es",
  sourceLang: "en"
};

const { usd } = app.translate.estimate(request); // [!note] No call is made. No key is needed.

const controller = new AbortController();
const result = await app.translate.generate(request, { signal: controller.signal });
console.log(usd, result.text, result.detectedSourceLang, result.costUsd);

await app.stop();
```

A custom provider registers a `TranslateHandler` under `"translate"` in its `onInit`:

```ts file="echo-provider.ts" check
import { createPlugin, registryPlugin } from "@moku-labs/ai";
import type { Translate } from "@moku-labs/ai";

const echoHandler: Translate.TranslateHandler = {
  estimate: request => ({ usd: request.text.length * 0.00001 }),
  execute: async request => ({ text: request.text, costUsd: 0 })
};

export const echoProvider = createPlugin("echoProvider", {
  depends: [registryPlugin],
  onInit: ctx => {
    ctx.require(registryPlugin).register("translate", "echo", echoHandler);
  }
});
```

:::gotchas
- **`generate` is not journaled.** No resume, no checkpoint, no retry. Build files go through [runner](/docs/ai/plugins/runner/).
- **`estimate` is synchronous.** It calls the handler's `estimate()`, never the API.
:::

## Events

### Emits

None.

### Listens to

None.

## Depends on

- [registry](/docs/ai/plugins/registry/): `resolve("translate", provider)` and `providers("translate")`.

## Related

- [runner](/docs/ai/plugins/runner/): the durable path for the same handlers.
- [openai](/docs/ai/plugins/openai/): the provider.
