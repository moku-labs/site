---
title: Writing a plugin
description: "Each entry exports createPlugin bound to its core: an agent command, a server hook, a tools panel."
section: Guides
order: 16
---

## How it works

Each core entry exports its own `createPlugin`, bound to that core's config and events. An agent
plugin runs on the game page, a server plugin in Bun, a tools plugin on the tools page. Every
plugin context has `ctx.log` and `ctx.env`, from the core plugins of `@moku-labs/common`.

| Entry | Write a plugin to |
|---|---|
| `@moku-labs/editor/agent` | Add an editor command or source to the registry. |
| `@moku-labs/editor/server` | React to sessions, writes and devices. |
| `@moku-labs/editor/tools` | Add a panel to a workspace. |

## An agent command

A plugin adds a command to the registry in its `onInit`. Every surface sees it: the tools page,
MCP and a test. The tools page sees a later add only on the next bridge hello.

```ts file="src/ping.ts" group="agent" check
import { createPlugin, registryPlugin } from "@moku-labs/editor/agent";

export const pingPlugin = createPlugin("ping", {
  depends: [registryPlugin],
  onInit: ctx => {
    ctx.require(registryPlugin).add({
      descriptor: { id: "ping.echo", title: "Ping", input: { text: "string?" }, effect: "read" }, // [!note] An id is camelCase words joined by dots. A kind ending in `?` is optional.
      run: async raw => ({ value: raw, state: ctx.require(registryPlugin).envelope() }) // [!note] `envelope()` is where the game stands now: `{ path, frame, tainted }`.
    });
  }
});
```

```ts file="src/editor.ts" group="agent" check
import { createApp } from "@moku-labs/editor/agent";
import { app } from "./game";
import { pingPlugin } from "./ping";

const editor = createApp({ plugins: [pingPlugin], pluginConfigs: { registry: { game: app } } });
await editor.start();
await editor.channel.run("ping.echo", { text: "hi" });
```

`add` throws for an invalid or used id, an unknown input kind, a `cheat` or `raw` effect, or an
`overlay` marker: the overlay lists only the game's own commands.

## A server hook

React to sessions with the hub's `hub:session` event. The hook is typed because the plugin lists
`hubPlugin` in `depends`.

```ts file="src/audit.ts" check
import { createPlugin, hubPlugin } from "@moku-labs/editor/server";

export const auditPlugin = createPlugin("audit", {
  depends: [hubPlugin],
  hooks: ctx => ({
    "hub:session": session => ctx.log.info("audit:session", { id: session.id, open: session.open })
  })
});
```

## A tools panel

A tools view is a plugin that registers a `definePanel` spec with `panels` in its `onInit`. The
panel names its sources and commands. The `panels` host watches the sources, waits for the first
values, marks stale data and tears everything down. The view never polls.

```tsx file="src/position-view.tsx" group="tools" check
import { definePanel } from "@moku-labs/editor";
import { createPlugin, panelsPlugin } from "@moku-labs/editor/tools";

const positionPanel = definePanel({
  id: "position",
  title: "Position",
  workspace: "state", // [!note] One of `flow`, `game`, `render`, `state`, `files`, `console`.
  sources: { position: "game.position", history: ["game.history", { last: 1 }] }, // [!note] A source is an id, or an id with its input.
  commands: { step: "game.step" },
  view: (values, tools) => (
    <section>
      <pre>{JSON.stringify(values.position)}</pre>
      <button type="button" onClick={() => tools.run.step({ frames: 1 })}>
        Step
      </button>
    </section>
  )
});

export const positionViewPlugin = createPlugin("positionView", {
  depends: [panelsPlugin],
  onInit: ctx => {
    ctx.require(panelsPlugin).register(positionPanel);
  }
});
```

```ts file="src/tools.ts" group="tools" check
import { createApp } from "@moku-labs/editor/tools";
import { positionViewPlugin } from "./position-view";

const tools = createApp({ plugins: [positionViewPlugin] });
await tools.start();
```

Each `tools.run` call emits `workspace:ran`, so the Console and State workspaces see it.

## From the app

From the app, every plugin's API is mounted under its name. From another plugin, use
`ctx.require(plugin)`.

```ts file="src/apis.ts" check
import { bridgePlugin, createApp as createAgent } from "@moku-labs/editor/agent";
import { createApp as createServer } from "@moku-labs/editor/server";
import { createApp as createTools } from "@moku-labs/editor/tools";
import { app } from "./game";

const editor = createAgent({ plugins: [bridgePlugin], pluginConfigs: { registry: { game: app } } });
await editor.channel.run("game.step", { frames: 1 });
editor.bridge.status(); // { kind: "live", frame: 1840 }
editor.recorder.start({ label: "boss run" }); // nothing records until someone starts it
editor.recorder.mark("boss enters"); // true while a log records

const server = createServer({ pluginConfigs: { files: { root: "." } } });
server.hub.sessions(); // [{ id: "s-7f3a", game: "my-game", … }]
await server.files.list("src");

const tools = createTools();
const ran = await tools.link.run("game.step", { frames: 1 }); // ran.state.frame is the frame after the step
tools.workspace.show("game");
tools.activeSource.current(); // { kind: "local", session: "s-1" } while the local preview is the source
```

:::gotchas
- **Add commands in `onInit`.** The tools page sees a later add only after the next bridge hello.
- **No view depends on another view.** Talk to another view with a global tools event, such as `workspace:open-file`.
- **Each entry's `createPlugin` is bound to its core.** Its hooks see that core's events.
:::

## Related

- [Events](/docs/editor/events/): what each core emits and who may hook it.
- [Plugins](/docs/editor/plugins/agent/): the APIs to `ctx.require`.
- [API reference](/docs/editor/api/): `definePanel` and the wire helpers.
