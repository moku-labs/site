---
title: intent
description: "Default engine. Typed phone-to-stage input: a schema check, de-duplication and retransmits."
section: Plugins
order: 23
---

## What it does

**Wired by default.** `intent` carries input from the phone to the stage, over the `Wire`. The stage
declares each intent with a schema. Anything else is dropped.

## How it works

The stage runs this pipeline on each `intent` frame:

:::flow
- Send `intent-ack`
- Is the name registered?
- Does the schema pass?
- Is `cSeq` new for this phone?
- Run the handler
:::

A failed step drops the frame without a word. The ack comes first, so a retransmit is always
answered, and a rejected intent still counts as delivered.

On the phone, delivery is stop-and-wait: one unacknowledged frame in flight, the rest queued in order.
The wait doubles on each retransmit, so the defaults give up after about 15 s.

The check is for correctness, not security. There is no authentication and no rate limit: Room
assumes friends in one room.

### Schemas

Every key in `fields` is required. The payload must be a plain object.

| Rule | Passes when |
|---|---|
| `{ type: "number", min?, max? }` | A finite number within the inclusive bounds. |
| `{ type: "string", maxLength? }` | A string no longer than the bound. |
| `{ type: "boolean" }` | A boolean. |
| `{ type: "enum", values }` | `===` one of the values. |

`additionalFields: false` rejects unknown keys. Rules cover one level: there is no nested rule, so a
nested object needs `additionalFields: true` and your own check in the handler.

## Config

`pluginConfigs.intent`.

| Option | Type | Default | Description |
|---|---|---|---|
| `bufferCap` | `number` | `256` | Cap of the queue. Past it the oldest intent drops with an event. |
| `bufferMaxAgeMs` | `number` | `10000` | Maximum age of an entry in the reconnect buffer. |
| `ackTimeoutMs` | `number` | `1000` | The first wait for an ack. Doubles on each retransmit. |
| `maxRetransmits` | `number` | `3` | Re-sends before the wire counts as dead. `0` never re-sends. |

## API

Mounted at `app.intent`, reachable with `ctx.require(intentPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `register` | `(name: string, schema: IntentSchema) => void` | Stage. Declares an intent. Registering again replaces the schema and keeps the handler. |
| `onIntent` | `(name: string, handler: (payload: JsonValue, meta: IntentMeta) => void) => () => void` | Stage. Sets the handler. `meta` is `{ peerId, cSeq }`. |
| `intent` | `(name: string, payload: JsonValue) => void` | Phone. Sends one intent. |
| `setBuffering` | `(on: boolean) => void` | Phone. `true` queues intents instead of sending them. |
| `drainBuffer` | `() => readonly BufferedIntent[]` | Phone. Returns and clears the buffer. |
| `bufferedCount` | `() => number` | Phone. The buffer's length. |

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `room:intent-undeliverable` | `{ name, cSeq }` | Phone. The retransmits ran out, or the queue overflowed. One event per dropped intent. |

### Listens to

None.

## Depends on

`transport`, `session`.

## Example

```ts file="src/moves.ts" check
import { app } from "./stage";

app.intent.register("move", {
  fields: {
    dx: { type: "number", min: -1, max: 1 },
    dy: { type: "number", min: -1, max: 1 },
    style: { type: "enum", values: ["walk", "run"] }
  },
  additionalFields: false
});

const off = app.intent.onIntent("move", (payload, { peerId, cSeq }) => {
  console.log(peerId, cSeq, payload);
});

off();
```

:::gotchas
- **Register first, always.** `onIntent` on an unknown name stores nothing. Registering later does not bring the handler back.
- **Nothing tells the phone an intent was rejected.** Publish the outcome in a slice if the phone must know.
- **No plugin calls `setBuffering`.** The buffer works only if you turn it on and send the drained intents yourself.
- **A slow stage slows every intent behind it.** Stop-and-wait means one round trip per intent. For a joystick, send at a rate the round trip allows.
:::

## Related

- [sync plugin](/docs/room/plugins/sync/): how the answer comes back.
- [Failures and reloads](/docs/room/guides/failures/): undeliverable intents.
