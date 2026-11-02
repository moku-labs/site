---
title: Events
description: "Strict emit, the register callback, who sees what."
section: Concepts
order: 4
---

## Strict emit

Events are notifications: fire-and-forget, typed, no return value. Only known event names compile,
and the payload must match.

```ts
ctx.emit("auth:login", { userId: "123" }); // OK
ctx.emit("auth:login", { wrongKey: true }); // compile error: wrong payload
ctx.emit("unknown:event", {}); // compile error: unknown event
```

Handlers for one event run in plugin order, each awaited before the next. A handler error goes to
`onError`; it never stops the emitter.

## Declaring events

A plugin declares its own events with the register callback. The payload type comes from
`register<T>()`, so `createPlugin` still takes no generics.

```ts file="src/plugins/auth.ts" check
import { createApp, createPlugin } from "@moku-labs/web";

const authPlugin = createPlugin("auth", {
  events: register => ({
    "auth:login": register<{ userId: string }>("Triggered after user login") // [!note] The description is documentation; the type is the contract.
  }),
  api: ctx => ({
    login: (userId: string) => ctx.emit("auth:login", { userId })
  })
});

const auditPlugin = createPlugin("audit", {
  depends: [authPlugin], // [!note] depends makes auth's events visible to audit's hooks.
  createState: (): { entries: string[] } => ({ entries: [] }),
  hooks: ctx => ({
    "auth:login": ({ userId }) => {
      ctx.state.entries.push(`login:${userId}`);
    }
  }),
  api: ctx => ({ entries: () => [...ctx.state.entries] })
});

const app = createApp({
  plugins: [authPlugin, auditPlugin],
  pluginConfigs: { site: { name: "Demo", url: "https://example.com" } }
});

app.auth.login("ada");
```

With a separate event-map type, use `register.map`:

```ts
type AuthEvents = { "auth:login": { userId: string }; "auth:logout": { userId: string } };

events: register =>
  register.map<AuthEvents>({
    "auth:login": "Triggered after user login",
    "auth:logout": "Triggered after user logout"
  });
```

## Who sees which events

| Source | Declared in | Visible to |
| --- | --- | --- |
| Global events | the framework's `createCoreConfig<Config, Events>` | all plugins |
| Own events | `events: register => ({ ... })` on the plugin | this plugin |
| Dependency events | `events` on plugins listed in `depends` | plugins that declare the dependency |

## Events in @moku-labs/web

| Event | Emitted by |
| --- | --- |
| `build:phase`, `build:complete` | `build` |
| `content:ready`, `content:invalidated` | `content` |
| `deploy:complete` | `deploy` |
| `spa:navigate`, `spa:navigated`, `spa:island-mount`, `spa:island-unmount` | `spa` |

:::callout{tone="warn"}
Use `require`, not `emit`, for request and response. Events do not return values. Declaring
`events` as a plain object instead of the register callback is refused when the plugin is created:
see [What the kernel checks](/docs/concepts/kernel-checks/).
:::
