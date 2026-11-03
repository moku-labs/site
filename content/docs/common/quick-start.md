---
title: Quick start
description: "Add log and env to a framework, read a validated secret and assert on the log trace."
section: Get started
order: 2
---

## Log and env in four steps

This page is for a framework author. If you build on `@moku-labs/web` or another framework,
`ctx.log` and `ctx.env` are already there: you only configure them through `pluginConfigs`.

:::steps
1. **Install.** `@moku-labs/core` is a peer dependency.

   ```sh terminal title="install"
   $ bun add @moku-labs/common @moku-labs/core
   ```

2. **Register both plugins.** In `createCoreConfig`, with their types in the third generic.
3. **Use them.** `ctx.log` and `ctx.env` are on every plugin.
4. **Configure them per app.** The app picks the providers, the variables and the log mode.
:::

## The code

```ts file="my-framework/config.ts" group="quick-start" check
import { envPlugin, logPlugin } from "@moku-labs/common";
import { createCoreConfig } from "@moku-labs/core";

type Config = { stage: "production" | "development" };
type Events = {};

export const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin, typeof envPlugin]>( // [!note] The tuple types `ctx.log` and `ctx.env`.
  "my-framework",
  {
    config: { stage: "production" },
    plugins: [logPlugin, envPlugin]
  }
);

export const { createPlugin, createCore } = coreConfig;
```

```ts file="my-framework/plugins/mailer.ts" group="quick-start" check
import { createPlugin } from "../config";

export const mailerPlugin = createPlugin("mailer", {
  api: ctx => ({
    send: (to: string) => {
      const from = ctx.env.require("MAIL_FROM"); // [!note] Throws when the variable has no value.
      ctx.log.info("mailer:sent", { from, to }); // [!note] The name is `domain:action` by convention. The data is any value.
    }
  })
});
```

```ts file="my-framework/index.ts" group="quick-start" check
import { coreConfig, createCore } from "./config";
import { mailerPlugin } from "./plugins/mailer";

export const { createApp, createPlugin } = createCore(coreConfig, { plugins: [mailerPlugin] });
```

```ts file="app.ts" group="quick-start" check
import { dotenv, processEnv } from "@moku-labs/common";
import { createApp } from "./my-framework";

const app = createApp({
  pluginConfigs: {
    log: { mode: "silent" }, // [!note] Records everything, prints nothing.
    env: {
      providers: [dotenv(), processEnv()], // [!note] The first provider with a value wins, so `.env.local` beats the shell.
      schema: {
        MAIL_FROM: { public: false, required: true }, // [!note] Missing here means `createApp` throws. The app never starts half-configured.
        PUBLIC_SITE_URL: { public: true, default: "https://example.com" }
      }
    }
  }
});

app.mailer.send("ada@example.com");

app.log.expect().toHaveEvent("mailer:sent", { to: "ada@example.com" }); // [!note] Throws when the trace has no match.
console.log(app.log.trace().map(entry => entry.event));
console.log(app.env.getPublic());
```

```sh file=".env.local"
MAIL_FROM=hello@example.com
```

## Run

```sh terminal title="run"
$ bun app.ts
[ "mailer:sent" ]
{
  PUBLIC_SITE_URL: "https://example.com",
}
```

Remove `MAIL_FROM` from `.env.local` and `createApp` throws, before `app.mailer.send` ever runs.

## Pick the providers for the target

The env plugin has no providers until you pass some, on every entry.

| Target | Providers | Import from |
|---|---|---|
| Node or Bun | `[dotenv(), processEnv()]` | `@moku-labs/common` |
| Browser | `[browserEnv()]` | `@moku-labs/common/browser` |
| Cloudflare Worker | `[cloudflareBindings()]`, `[workerSafeProcessEnv()]` | `@moku-labs/common` |

:::gotchas
- **`ctx.log` and `ctx.env` are not on a core plugin's context.** They reach regular plugins, `app`, and the app callbacks.
- **Pass the tuple.** With `Config` and `Events` written out, TypeScript stops inferring the third generic, and `plugins` no longer compiles without it.
- **`production` is the default log mode.** It prints `info` and above to the console. Use `test` or `silent` in tests.
:::

## Next

- [How it works](/docs/common/how-it-works/): the catalog, the entries, the order of a run.
- [log plugin](/docs/common/plugins/log/) and [env plugin](/docs/common/plugins/env/): config, API, examples.
- [Branded CLI](/docs/common/guides/branded-cli/): a console and prompts for a command-line tool.
- [Write a framework](/docs/core/guides/write-a-framework/): the rest of the package.
