---
title: Testing
description: "Run the stage and phones in one process with inMemory(), no WebRTC and no browser."
section: Guides
order: 12
---

## One process, many apps

`inMemory()` is a signaling adapter that also opens an in-process channel. Share one instance
between apps, and real frames flow through the real engines. It needs no DOM.

```ts file="tests/score.test.ts" check
import { controllerPlugin, createApp, inMemory, stagePlugin } from "@moku-labs/room";

async function untilRead(read: () => unknown): Promise<unknown> {
  while (read() === undefined) await new Promise(resolve => setTimeout(resolve, 10));
  return read();
}

const transport = { signaling: inMemory(), iceServers: [] };

const stage = createApp({
  plugins: [stagePlugin],
  pluginConfigs: { transport, session: { generateQr: false } } // [!note] Skips the QR encoder.
});
await stage.start();
stage.sync.registerSlice("round", { number: 1 });
const { code } = stage.stage.createRoom();

const phone = createApp({ plugins: [controllerPlugin], pluginConfigs: { transport } });
await phone.start();
await phone.controller.joinRoom(code);

console.log(await untilRead(() => phone.controller.read("round"))); // { number: 1 }

await phone.stop(); // [!note] Stop both apps, or the timers keep the runner alive.
await stage.stop();
```

:::gotchas
- **Each `inMemory()` is its own bus.** Two calls never connect. Share one instance.
- **Deltas wait for a tick.** `mutate` does not send. Wait up to one tick (33 ms at 30 Hz), or call `app.sync.broadcast()`.
- **Timeouts are configurable.** Lower `reconnectTimeoutMs`, `heartbeatIntervalMs` and `heartbeatTimeoutMs` to test failure paths quickly.
- **It proves no WebRTC.** ICE, relays and iOS behavior need real devices.
:::

`inMemory({ server: true })` also simulates the hub protocol: sessions are persistent and expose
`onEvict`.

## Related

- [transport plugin](/docs/room/plugins/transport/): the adapters and the timing config.
