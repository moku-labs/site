---
title: env
description: "Validated, frozen environment from ordered providers, with a checked public subset. Injected as ctx.env."
section: Plugins
order: 12
---

## What it does

`env` reads variables from a list of providers once, checks them against a schema, and freezes the
result. Plugins read it through `ctx.env`. A missing required variable stops `createApp`, so an app
never runs half-configured.

It also draws the line between secret and public. Only variables you mark `public` reach
`getPublic()` and `getPublicMap()`, and the prefix rule makes a slip fail early.

## How it works

All of it runs in `onInit`, inside `createApp`.

:::steps
1. **Load.** Each provider's `load()` runs once, in order. An empty string counts as absent. The first provider with a value wins.
2. **Cross-check the prefix.** A `public: true` variable must start with `publicPrefix`, and a variable with the prefix must be `public: true`. Either mistake throws.
3. **Fill and require.** A schema `default` fills a gap. A `required` variable with no value throws.
4. **Publish.** Schema variables with `public: true` and a value go to the public map.
5. **Freeze.** Both maps. `set`, `delete` and `clear` throw from now on.
:::

:::callout{tone="warn"}
The schema validates, it does not filter. `ctx.env.get("HOME")` returns a value with `processEnv()`
in the list, even when `HOME` is not in the schema. Only the public map is limited to the schema.
:::

## Config

`pluginConfigs.env`. Every field has a default.

| Option | Type | Default | Description |
|---|---|---|---|
| `schema` | `Record<string, EnvVarSpec>` | `{}` | The rules per variable. |
| `providers` | `EnvProvider[]` | `[]` | The value sources, in priority order. Empty means no values, on every entry. |
| `publicPrefix` | `string` | `"PUBLIC_"` | The prefix public variables must carry. |

`EnvVarSpec`:

| Field | Type | Description |
|---|---|---|
| `public` | `boolean` | Required. Whether the value may reach the browser. |
| `required` | `boolean` | Throw when no provider or default gives a value. |
| `default` | `string` | The value when no provider has one. |
| `secret` | `boolean` | A marker for readers and tools. It has no run-time effect. |

## API

Mounted at `ctx.env` on every regular plugin, at `app.env`, and in the app callbacks. Values are
always strings.

| Method | Signature | Description |
|---|---|---|
| `get` | `(key: string) => string \| undefined` | The value, or `undefined`. |
| `require` | `(key: string) => string` | The value. Throws when it has none. |
| `has` | `(key: string) => boolean` | Whether it has a value. |
| `getPublic` | `() => Readonly<Record<string, string>>` | The public variables as a frozen plain object. |
| `getPublicMap` | `() => ReadonlyMap<string, string>` | The frozen public map, for a build's `define` step. |

## Providers

A provider is `{ name: string; load(): Record<string, string | undefined> }`. Write your own in a
line or two.

| Provider | Reads | Runs on | Entry |
|---|---|---|---|
| `dotenv(path?)` | A `.env`-style file, `.env.local` by default. A missing file gives `{}`. | Node, Bun | `@moku-labs/common` |
| `processEnv()` | A copy of `process.env`. | Node, Bun | `@moku-labs/common` |
| `workerSafeProcessEnv()` | A copy of `process.env`, or `{}` when there is no `process`. | Node, Bun, Workers | `@moku-labs/common` |
| `cloudflareBindings()` | `globalThis.__CLOUDFLARE_ENV__`, or `{}`. You set that global. | Workers | `@moku-labs/common` |
| `browserEnv(options?)` | `import.meta.env`, then `globalThis.__ENV__`, which wins. `globalKey` renames the global. | Browser | `/browser` and root |

`dotenv` is a small parser. It handles blank lines, `#` comment lines, `CRLF`, and one pair of outer
quotes. It reads the path relative to the working directory.

## Events

### Emits

None. A core plugin cannot emit.

### Listens to

None. A core plugin cannot have hooks.

## Depends on

Nothing.

## Example

```ts file="src/app.ts" check
import { dotenv, type EnvProvider, envPlugin, logPlugin, processEnv } from "@moku-labs/common";
import { createCoreConfig } from "@moku-labs/core";

type Config = {};
type Events = {};

const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin, typeof envPlugin]>("demo", {
  config: {},
  plugins: [logPlugin, envPlugin]
});

const fixtures: EnvProvider = {
  name: "fixtures", // [!note] Used in tests in place of the real sources.
  load: () => ({ API_TOKEN: "test-token" })
};

const apiPlugin = coreConfig.createPlugin("api", {
  api: ctx => ({
    headers: () => ({ authorization: `Bearer ${ctx.env.require("API_TOKEN")}` }),
    baseUrl: () => ctx.env.get("PUBLIC_API_URL") ?? "/" // [!note] Always a string or `undefined`. Parse numbers and flags yourself.
  })
});

const { createApp } = coreConfig.createCore(coreConfig, { plugins: [apiPlugin] });

const app = createApp({
  pluginConfigs: {
    env: {
      providers: process.env.NODE_ENV === "test" ? [fixtures] : [dotenv(), processEnv()],
      schema: {
        API_TOKEN: { public: false, required: true, secret: true },
        PUBLIC_API_URL: { public: true, default: "https://api.example.com" }
      }
    }
  }
});

console.log(app.api.baseUrl()); // https://api.example.com
console.log(app.env.getPublic()); // { PUBLIC_API_URL: "https://api.example.com" }. The token is not in it.
```

:::gotchas
- **No providers by default, also in the browser.** `/browser` exports `browserEnv` but does not wire it. A framework can: `@moku-labs/web` does.
- **`KEY=` is absent.** An empty value falls through to the next provider, then to the default.
- **`dotenv` keeps a trailing comment.** `A=1 # note` gives the value `1 # note`. Put comments on their own line.
- **`dotenv` does not read `export`.** `export B=2` gives a variable named `export B`.
- **`cloudflareBindings` reads once.** `load()` runs in `createApp`, so set `__CLOUDFLARE_ENV__` before you create the app. An app made per request sees that request's bindings. One shared app keeps the first.
- **`secret` does not protect anything.** Nothing stops `{ public: true, secret: true }`, and a secret is still returned by `get`. The rule that protects you is the prefix.
- **Errors start with `[web]`.** In every framework: the prefix is fixed in the plugin.
:::

## Related

- [log plugin](/docs/common/plugins/log/): the other core plugin.
- [How it works](/docs/common/how-it-works/): the entries and the order of a run.
