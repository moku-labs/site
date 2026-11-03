---
title: bindings
description: "Default. Resolves a Cloudflare binding off the per-request env and throws a clear error when it is missing."
section: Plugins
order: 20
---

## What it does

**Default.** `bindings` reads a value off the `env` of the current invocation. A KV namespace, a D1
database, a secret or a plain var: `env` holds them all. Every resource plugin resolves its binding
through this plugin, and your own plugins can too.

## How it works

Both methods are pure functions over the `env` you pass. There is no state.

`null` and `undefined` count as unbound. Falsy values such as `""`, `0` and `false` are bound and come
back as they are.

## Config

`pluginConfigs.bindings`.

| Option | Type | Default | Description |
|---|---|---|---|
| `required` | `string[]` | `[]` | A list of binding names. No code in the package reads it: a missing name does not fail `createApp` or a request. |

## API

Mounted at `app.bindings`, reachable with `ctx.require(bindingsPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `require` | `<T>(env: WorkerEnv, name: string) => T` | The binding, cast to `T`. Throws when it is unbound. |
| `has` | `(env: WorkerEnv, name: string) => boolean` | Whether the binding is bound. Never throws. |

A missing binding throws:

```text
[worker] binding "MY_KV" is not bound.
  Declare it in wrangler config and pass it in via the request env.
```

## Events

### Emits

None.

### Listens to

None.

## Depends on

Nothing. `server` and every resource plugin depend on it.

## Example

```ts file="src/plugins/flags.ts" check
import type { WorkerEnv } from "@moku-labs/worker";
import { bindingsPlugin, createPlugin } from "@moku-labs/worker";

export const flagsPlugin = createPlugin("flags", {
  depends: [bindingsPlugin],
  api: ctx => ({
    secret: (env: WorkerEnv) => ctx.require(bindingsPlugin).require<string>(env, "API_SECRET"),
    enabled: (env: WorkerEnv) => ctx.require(bindingsPlugin).has(env, "FEATURE_X") // [!note] `has` is the branch for an optional binding.
  })
});
```

:::gotchas
- **Do not list it.** It is a default. Listing `bindingsPlugin` in `plugins` throws `Duplicate plugin name: "bindings"`. Reach its config through `pluginConfigs`.
- **`required` is not a check.** To fail on a missing binding, call `require` where you need it.
- **The type is your word.** `require<T>` casts. It does not check that the binding is really a `T`.
:::

## Related

- [How it works](/docs/worker/how-it-works/): why `env` is an argument.
- [kv plugin](/docs/worker/plugins/kv/): the same resolver behind a typed surface.
