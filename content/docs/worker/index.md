---
title: "@moku-labs/worker"
description: "Cloudflare Workers backend. D1, KV, R2, Queues, DO — each one a plugin."
section: Get started
---

## Overview

`@moku-labs/worker` is the Cloudflare Workers backend for Moku. Every Cloudflare primitive is a
plugin that resolves its binding per request from the Worker `env`. A `server` plugin owns HTTP
routing and dispatch. The build-time `deploy` and `cli` plugins ship the Worker but stay out of the
runtime bundle.

- **Every primitive is a plugin.** KV, D1, R2, Queues and Durable Objects. Add only what you use;
  the rest tree-shakes away.
- **`env` is a call argument, never state.** One isolate serves many requests at once, so a
  binding lives on the call stack and cannot leak between them.
- **Thin typed wrappers.** The plugins add types over the real Cloudflare APIs.

| Plugin | What it does |
| --- | --- |
| `bindings` | Resolves bindings from the per-request `env`. A default. |
| `server` | HTTP routing and request dispatch. A default. |
| `kv`, `d1`, `storage`, `queues`, `durableObjects` | KV, D1, R2, Queues and Durable Objects. |
| `deploy`, `cli` | Provision, generate the wrangler config, deploy. Node only. |

## Install

```sh terminal
bun add @moku-labs/worker
bun add -d @cloudflare/workers-types
```

## Quick start

Declare the routes as data. `bindings` and `server` are defaults: you never list them.

```ts file="app.ts" check
import { createApp, endpoint } from "@moku-labs/worker";

export const app = createApp({
  config: { name: "my-api", compatibilityDate: "2026-06-17" },
  pluginConfigs: {
    server: {
      endpoints: [
        endpoint("/health").get(() => new Response("ok")),
        endpoint("/api/data/{lang:?}").get(({ params }) =>
          Response.json({ lang: params.lang ?? "en" }) // [!note] {lang:?} is optional, typed string | undefined.
        ),
        endpoint("/users/{userId}").get(({ params }) => new Response(`user=${params.userId}`))
      ]
    }
  }
});
```

The Worker entry is yours. It hands every request to `app.server`:

```ts file="worker.ts" no-check="imports ./app from the reader's project"
import { app } from "./app";

export default {
  fetch: (request: Request, env: Record<string, unknown>, ctx: ExecutionContext) =>
    app.server.handle(request, env, ctx)
} satisfies ExportedHandler;
```

A request to `/api/data/fr` returns `{ "lang": "fr" }`. An unmatched path returns `404`.

:::callout{tone="warn"}
Do not list a default plugin again. `plugins` appends after `[log, env, bindings, server]`, so a
second `bindingsPlugin` is a duplicate name and the kernel refuses to start. Configure a default
through `pluginConfigs` instead.
:::

## Start with Claude

```text prompt
Build a blog with tags and an RSS feed on @moku-labs/web
```

```text prompt
Add a D1-backed comments API with @moku-labs/worker
```

```text prompt
Make a couch quiz game: TV shows questions, phones answer
```

```text prompt
Ship this app to macOS and iOS
```
