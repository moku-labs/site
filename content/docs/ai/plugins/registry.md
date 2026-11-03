---
title: registry
description: "The task, provider, handler map. It keeps tasks and providers from importing each other."
section: Pipeline
order: 12
---

## What it does

`registry` is a map from a task and a provider to a handler. Provider plugins fill it in `onInit`.
The runner and the task facades read it. It never looks inside a handler: the owning task plugin
or the runner narrows it.

## Config

None.

## API

Mounted at `app.registry`, reachable with `ctx.require(registryPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `register` | `(task: string, provider: string, handler: unknown) => void` | Adds a handler. Throws on a duplicate pair. |
| `resolve` | `(task: string, provider: string) => unknown` | The handler, or `undefined` when it is not registered. |
| `providers` | `(task: string) => string[]` | The providers of a task, in registration order. |
| `tasks` | `() => string[]` | Every task with at least one provider. |

```ts file="list.ts" check
import { app } from "./app";

for (const task of app.registry.tasks()) {
  console.log(task, app.registry.providers(task));
}
```

The first provider of a task is the fallback for a build file item with no `provider`.
To add one, see [Add a provider](/docs/ai/guides/custom-provider/).

## Events

### Emits

None.

### Listens to

None.

## Depends on

Nothing. Every task and provider plugin depends on it.
