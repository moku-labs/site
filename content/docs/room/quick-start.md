---
title: Quick start
description: "A shared screen and a phone: create a room, send an intent, read the synced state."
section: Get started
order: 2
---

## A room in five steps

:::steps
1. **Install.** `@moku-labs/core` and `@moku-labs/common` are peer dependencies. `trystero` and `qrcode` come with Room.

   ```sh terminal title="install"
   $ bun add @moku-labs/room @moku-labs/core @moku-labs/common
   ```

2. **Write the stage.** The screen everyone looks at. It registers its state and its intents, then creates the room.

3. **Write the phone.** It joins with the code from the URL, renders the state it receives, and sends intents.

4. **Serve both pages.** Room is a browser library. Bundle the two files with any tool and serve them on one origin the phones can reach.

5. **Open the stage, scan the code.** The phone joins the room directly over WebRTC.
:::

## The code

```ts file="src/stage.ts" group="app" check
import { createApp, stagePlugin } from "@moku-labs/room";

const app = createApp({ plugins: [stagePlugin] });
await app.start();

// [!note] Register before `createRoom`. A phone gets every registered slice in its first snapshot.
app.sync.registerSlice("scores", {});
app.intent.register("score", {
  fields: { points: { type: "number", min: 1, max: 10 } },
  additionalFields: false
});

app.stage.onIntent("score", (payload, peerId) => {
  const { points } = payload as { points: number };
  app.stage.mutate("scores", draft => ({
    ...draft,
    [peerId]: Number(draft[peerId] ?? 0) + points
  }));
});

const { code, joinUrl } = app.stage.createRoom();
console.log(`Join ${code} at ${joinUrl}`);
```

```ts file="src/phone.ts" group="app" check
import { controllerPlugin, createApp } from "@moku-labs/room";

const app = createApp({ plugins: [controllerPlugin] });
await app.start();

// [!note] Room does not read the URL. The join URL ends in `?room=CODE`, and your page passes the code on.
const code = new URLSearchParams(location.search).get("room") ?? "";
await app.controller.joinRoom(code);

app.controller.on("scores", scores => console.log(scores));
app.controller.intent("score", { points: 1 });
```

:::callout
Both files run in the browser. There is no build step or server of Room's own. By default the phones
find the stage through public Nostr relays.
:::

## Try it without phones

`inMemory()` connects apps in one process, with no WebRTC. This script runs under `bun`.

```ts file="try.ts" check
import { controllerPlugin, createApp, inMemory, stagePlugin } from "@moku-labs/room";

const signaling = inMemory(); // [!note] One adapter instance, shared by both apps.
const transport = { signaling, iceServers: [] };

const stage = createApp({ plugins: [stagePlugin], pluginConfigs: { transport } });
await stage.start();
stage.sync.registerSlice("scores", {});
stage.intent.register("score", { fields: {}, additionalFields: false });
stage.stage.onIntent("score", (_payload, peerId) => {
  stage.stage.mutate("scores", draft => ({ ...draft, [peerId]: 1 }));
});
const { code } = stage.stage.createRoom();

const phone = createApp({ plugins: [controllerPlugin], pluginConfigs: { transport } });
await phone.start();
await phone.controller.joinRoom(code);

phone.controller.on("scores", scores => console.log(scores));
phone.controller.intent("score", {});
```

```sh terminal title="output"
$ bun try.ts
{}
{ "a0a03192-f54c-4bc6-9a4b-952ec1c0bd7c": 1 }
```

The first line is the snapshot the phone got on join. The second is the delta after the intent.
The script keeps running until you stop the apps: the heartbeat and the broadcast loop hold it open.

## Next

- [How it works](/docs/room/how-it-works/): the star, the two planes, the join.
- [Joining a room](/docs/room/guides/joining/): the QR code and the join errors.
- [Failures and reloads](/docs/room/guides/failures/): what to show when the network breaks.
