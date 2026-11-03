---
title: clipboard
description: "Read and write clipboard text. Support is probed, a refusal is denied."
section: Plugins
kind: optional
order: 13
---

## What it does

`clipboard` reads and writes text, and text only. There is no image or file support.

## How it works

The web provider probes `navigator.clipboard`. Without it, for example in an insecure context, every
method answers `unsupported`. A `NotAllowedError` from the browser becomes `denied`. The Tauri
provider uses `@tauri-apps/plugin-clipboard-manager`.

## Config

None.

## API

Mounted at `app.clipboard`.

| Method | Signature | Description |
|---|---|---|
| `readText` | `() => Promise<SystemResult<string>>` | The clipboard text. |
| `writeText` | `(text: string) => Promise<SystemResult<void>>` | Writes the text. |

## Events

None.

## Depends on

- The core `runtime` plugin.
- In the shell: `@tauri-apps/plugin-clipboard-manager`, and `{ name: "clipboard-manager" }` in `config.system` of native.

## Example

```ts file="src/copy.ts" check
import { createApp } from "@moku-labs/system";
import { clipboardPlugin } from "@moku-labs/system/clipboard";

const system = createApp({ plugins: [clipboardPlugin] });
await system.start();

const copied = await system.clipboard.writeText("https://moku-labs.com");
if (!copied.ok && copied.reason === "unsupported") {
  console.log("hide the copy button");
}
```

:::gotchas
- **Native grants two permissions on purpose.** `clipboard-manager:default` grants nothing, so the list is `allow-read-text` and `allow-write-text`.
:::

## Related

- [How it works](/docs/system/how-it-works/): the result contract.
