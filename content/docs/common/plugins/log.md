---
title: log
description: "Always-on in-memory trace, pluggable sinks and an expect() DSL. Injected as ctx.log."
section: Plugins
order: 11
---

## What it does

`log` records every call in an in-memory list and sends it to the sinks you have. The list is always
on, so a test or a health check can ask what happened: `app.log.expect().toHaveEvent("build:complete")`.

Entries are events, not sentences: a name such as `mailer:sent` and any data. That is what makes them
easy to assert on.

## How it works

Each call appends `{ level, event, data, ts }` to the trace, then calls `write(entry)` on each sink,
in the order they were added. In `onInit` the plugin picks a default console sink from `mode`.

| `mode` | Console sink prints | Trace |
|---|---|---|
| `"production"` | `info` and above | on |
| `"dev"` | everything | on |
| `"test"` | nothing | on |
| `"silent"` | nothing | on |

The default sink prints the entry object through `console.log`, `console.warn` or `console.error`. A
terminal tool swaps it for [`brandedSink`](/docs/common/guides/branded-cli/).

## Config

`pluginConfigs.log`.

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `"test" \| "dev" \| "production" \| "silent"` | `"production"` | Which console sink `onInit` installs. |

## API

Mounted at `ctx.log` on every regular plugin, at `app.log`, and in the app callbacks.

| Method | Signature | Description |
|---|---|---|
| `info` | `(event: string, data?: unknown) => void` | Records an `info` entry. |
| `debug` | `(event: string, data?: unknown) => void` | Records a `debug` entry. |
| `warn` | `(event: string, data?: unknown) => void` | Records a `warn` entry. |
| `error` | `(event: string, data?: unknown, error?: Error) => void` | Records an `error` entry. An `error` argument is merged into `data` as `error: { message, stack }`. |
| `trace` | `() => readonly LogEntry[]` | A frozen copy of the entries so far. |
| `expect` | `() => ExpectChain` | Assertions over the live trace. |
| `addSink` | `(sink: LogSink) => void` | Adds an output target. |
| `clearSinks` | `() => void` | Removes every sink. The trace stays. |
| `reset` | `() => void` | Empties the trace. The sinks stay. |

`LogEntry` is `{ level, event, data?, ts, plugin? }`. `ts` is `Date.now()`. `plugin` is reserved: the
plugin does not set it. `LogSink` is `{ write(entry: LogEntry): void }`.

### expect()

Each method returns the same chain, and throws a `LogExpectAssertionError` on failure. The chain reads
the live trace at each call, so it also sees entries added after `expect()` was called.

| Method | Passes when |
|---|---|
| `toHaveEvent(event, partial?)` | An entry has this name and, when given, its data contains `partial`. |
| `toHaveEventInOrder(events)` | All names appear in this relative order. Other entries in between are fine. |
| `toNotHaveEvent(event, partial?)` | No entry matches. With `partial`, an entry of that name with other data is fine. |

`partial` is a subset match. Objects match recursively and extra keys are ignored. Arrays must match
in length and element by element. Other values compare with `Object.is`.

## Events

### Emits

None. A core plugin cannot emit.

### Listens to

None. A core plugin cannot have hooks.

## Depends on

Nothing.

## Example

```ts file="src/app.ts" check
import { type LogEntry, logPlugin } from "@moku-labs/common";
import { createCoreConfig } from "@moku-labs/core";

type Config = {};
type Events = {};

const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin]>("demo", {
  config: {},
  plugins: [logPlugin]
});

const checkoutPlugin = coreConfig.createPlugin("checkout", {
  api: ctx => ({
    pay: (orderId: string, card: string) => {
      ctx.log.info("checkout:started", { orderId });
      try {
        if (card === "bad") throw new Error("Declined");
        ctx.log.info("checkout:paid", { orderId, attempts: 1 });
      } catch (error) {
        ctx.log.error("checkout:failed", { orderId }, error as Error); // [!note] The message and the stack land in `data.error`.
      }
    }
  })
});

const { createApp } = coreConfig.createCore(coreConfig, { plugins: [checkoutPlugin] });
const app = createApp({ pluginConfigs: { log: { mode: "test" } } });

const errors: LogEntry[] = [];
app.log.addSink({
  write: entry => {
    if (entry.level === "error") errors.push(entry); // [!note] A sink can send entries anywhere: a file, a metric, a service.
  }
});

app.checkout.pay("a1", "good");
app.checkout.pay("a2", "bad");

app.log
  .expect()
  .toHaveEvent("checkout:paid", { orderId: "a1" }) // [!note] `attempts` is not in `partial`, and that is fine.
  .toHaveEventInOrder(["checkout:started", "checkout:paid", "checkout:failed"])
  .toNotHaveEvent("checkout:paid", { orderId: "a2" });

console.log(errors.length); // 1
```

:::gotchas
- **The trace grows forever.** Nothing trims it. A long-running process should call `reset()` from time to time.
- **A sink that throws reaches the caller.** The sink loop has no guard, so `ctx.log.info(...)` throws and later sinks are skipped. The entry is already in the trace.
- **`error()` keeps only object data with an `Error`.** With a third argument, `data` that is not a plain object is dropped.
- **Data is not copied.** The entry holds your reference, so a later change to that object shows up in the trace.
- **`trace()` is a copy, `expect()` is live.** Keep the array from `trace()` as a snapshot; do not expect it to update.
- **A new sink gets no history.** `addSink` does not replay the trace. To see everything, add it from a regular plugin's `onInit`, the earliest place you can reach `ctx.log`.
:::

## Related

- [env plugin](/docs/common/plugins/env/): the other core plugin.
- [Branded CLI](/docs/common/guides/branded-cli/): `brandedSink` for terminal tools.
- [Write a framework](/docs/core/guides/write-a-framework/): a test built on `expect()`.
