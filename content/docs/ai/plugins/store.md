---
title: store
description: "The content-addressed artifact store: durable writes, verified reads and gc. Injected as ctx.store."
section: Pipeline
order: 16
---

## What it does

**Core plugin.** `store` keeps artifact bytes under their sha256, at `{dir}/{hash[0..2]}/{hash}`.
A write goes to a temp file, then `fsync`, `rename` and an `fsync` of the folder. The same bytes
are stored once.

## Config

`pluginConfigs.store`.

| Option | Type | Default | Description |
|---|---|---|---|
| `dir` | `string` | `".moku/store"` | The root folder. Created on the first `put`. |
| `algo` | `"sha256"` | `"sha256"` | The only value today. |

## API

Mounted at `app.store` and `ctx.store`. A malformed hash throws.

| Method | Signature | Description |
|---|---|---|
| `put` | `(content: Uint8Array) => Promise<PutResult>` | `{ hash, path, existed }`. |
| `has` | `(hash: string) => Promise<boolean>` | Whether the object exists. |
| `pathOf` | `(hash: string) => string` | The absolute path. Does not check it. |
| `read` | `(hash: string) => Promise<Uint8Array>` | The bytes, with the hash verified. |
| `hashOf` | `(content: Uint8Array) => string` | The hash, with no write. |
| `gc` | `(keep: ReadonlySet<string>) => Promise<GcResult>` | Removes every object not in `keep`. `{ removed, bytesFreed }`. |

```ts file="read.ts" check
import { app } from "./app";

await app.start();
const { hash } = await app.store.put(new TextEncoder().encode("hello"));
console.log(new TextDecoder().decode(await app.store.read(hash)));
await app.stop();
```

:::callout{tone="warn"}
`gc` removes what `keep` does not list. A removed artifact is built, and billed, again.
:::

## Events

### Emits

None.

### Listens to

None.

## Depends on

Nothing.
