---
title: "@moku-labs/common"
description: "Shared plugins: log, env, branded CLI."
section: Get started
---

## Overview

`@moku-labs/common` is a catalog of shared plugins for the Moku family. You author a plugin once
and reuse it in every framework. It has no `createApp` and no defaults of its own: you register its
plugins in your framework's `createCoreConfig`.

- **Shared across frameworks.** Logging and env live here, not in every framework.
- **Core plugins.** Built with `createCorePlugin`, so their APIs land on every plugin's context as
  `ctx.log` and `ctx.env`.
- **A node-free browser entry.** `@moku-labs/common/browser` never pulls a `node:*` module into a
  client bundle. A CI gate proves it.

| Export | What it does |
| --- | --- |
| `logPlugin` | In-memory trace and an `expect()` DSL for testable workflows. Injected as `ctx.log`. |
| `envPlugin` | Validated, frozen environment from several providers. Injected as `ctx.env`. |
| `dotenv`, `processEnv`, `cloudflareBindings` | Env providers for Node and Workers. |
| `browserEnv` | Env provider for the browser, from `@moku-labs/common/browser`. |
| `createBrandConsole`, `createBrandPrompts` | The branded terminal kit, from `@moku-labs/common/cli`. |

## Install

```sh terminal
bun add @moku-labs/common @moku-labs/core
```

## Quick start

Register the plugins in your framework's `createCoreConfig`. Every plugin then gets `ctx.log` and
`ctx.env`.

```ts file="my-framework/config.ts" check
import { envPlugin, logPlugin } from "@moku-labs/common";
import { createCoreConfig } from "@moku-labs/core";

type Config = { stage: "production" | "development" };
type Events = {};

export const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin, typeof envPlugin]>(
  "my-framework",
  {
    config: { stage: "production" },
    plugins: [logPlugin, envPlugin] // [!note] ctx.log and ctx.env on every plugin.
  }
);

export const greeterPlugin = coreConfig.createPlugin("greeter", {
  api: ctx => ({
    greet: (name: string) => ctx.log.info("greeter:greet", { name })
  })
});
```

Pick the env provider that matches each target:

```ts check
import { dotenv, processEnv } from "@moku-labs/common"; // Node
import { browserEnv } from "@moku-labs/common/browser"; // browser, node-free
```

## Start with Claude

```text prompt
Register logPlugin and envPlugin from @moku-labs/common in my framework
```

```text prompt
Validate the API keys my framework needs with envPlugin
```

```text prompt
Test my signup workflow with the expect() DSL of logPlugin
```

```text prompt
Give my CLI a branded console and prompts from @moku-labs/common/cli
```
