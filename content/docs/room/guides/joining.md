---
title: Joining a room
description: "Show the code and the QR on the stage, read it on the phone, handle a failed join."
section: Guides
order: 10
---

## On the stage

`createRoom` is synchronous. The QR is not: its encoder loads on first use. `descriptor.qr` is
always `null`. Ask `stage.qr()` for the matrix.

Room gives you a matrix of booleans, not an image. Draw it however you like.

```ts file="src/lobby.ts" check
import { app } from "./stage";

await app.start();

const { code, joinUrl } = app.stage.createRoom();
console.log(code, joinUrl);

const qr = await app.stage.qr(); // [!note] `null` when `generateQr` is false or no room is open.

if (qr) {
  const rects = qr.modules.flatMap((dark, index) => {
    const x = index % qr.size;
    const y = Math.floor(index / qr.size);
    return dark ? [`<rect x="${x}" y="${y}" width="1" height="1"/>`] : [];
  });
  document.body.innerHTML = `<svg viewBox="0 0 ${qr.size} ${qr.size}">${rects.join("")}</svg>`;
}
```

## Point the URL at the phone page

The join URL is `joinUrlBase` plus `?room=CODE`. The default base is the stage page's origin.
Set `joinUrlBase` when the phone page lives elsewhere.

```ts file="src/stage-config.ts" check
import { createApp, stagePlugin } from "@moku-labs/room";

export const app = createApp({
  plugins: [stagePlugin],
  pluginConfigs: { session: { joinUrlBase: "https://party.example/pad/" } }
});
```

That app builds `https://party.example/pad/?room=H9NSHM`.

## On the phone

Room does not parse the URL. Read the code and pass it on. `joinRoom` resolves when the channel to
the stage is open, and throws an `Error` when it is not.

```ts file="src/join.ts" check
import { app } from "./phone";

await app.start();

const code = new URLSearchParams(location.search).get("room") ?? "";

try {
  await app.controller.joinRoom(code);
  await app.controller.requestWakeLock(); // [!note] `false` where the browser has no wake lock. Harmless.
} catch (error) {
  console.error("Could not join", error);
  await app.session.leave(); // [!note] Without this, the next `joinRoom` fails at once.
}
```

## What a failed join looks like

| Case | Result |
|---|---|
| Unknown code | Waits `reconnectTimeoutMs` (10 s), then throws `unreachable`. Signaling cannot tell a wrong code from an empty room. |
| Signaling join throws | Throws `not-found`, and `room:network-warning` fires with `rendezvous-unreachable`. |
| Already in a room, or a failed join not left | Throws `unreachable` at once. |
| Room over `maxControllers` | **`joinRoom` resolves.** The stage then closes the channel. The phone is not in the roster. |

:::gotchas
- **`full` is in the type, but nothing returns it.** The `JoinResult` type names `full`. The client code never produces it, on any adapter. Do not build a "room full" screen on it.
- **Detect a full room yourself.** On the stage, check `stage.roster().length` in `room:peer-joined`, and publish a slice the phone can read.
- **A wrong code takes 10 seconds to fail.** Lower `reconnectTimeoutMs` for a faster answer. It also sets the reconnect window.
- **`requestWakeLock` needs a secure context.** On plain `http://` it resolves `false`. An iPhone that locks suspends its channel.
- **Roster entries have no name.** Nothing fills `RosterEntry.name`. Send a name as an intent and keep it in a slice.
:::

## Related

- [session plugin](/docs/room/plugins/session/): the code, QR and roster API.
- [Failures and reloads](/docs/room/guides/failures/): after the join.
