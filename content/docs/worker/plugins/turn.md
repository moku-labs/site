---
title: turn
description: "Cloudflare Realtime TURN keys as a deploy resource. Declare one and the deploy creates and binds it."
section: Plugins
kind: optional
order: 27
---

## What it does

`turn` declares a Cloudflare Realtime TURN key, the relay a WebRTC app needs behind hostile networks.
The key's secret is returned once, at creation. With a `turn` instance declared, `deploy` creates the
key and binds its two values as Worker secrets.

It has no runtime surface. Your Worker, or a plugin such as the hub of `@moku-labs/room/server`, reads
the two secrets from `env`.

## How it works

`turn` is metadata. All the work happens in [deploy](/docs/worker/plugins/deploy/), in the same plan
as the other resources:

:::steps
1. **Check.** The deploy lists the Worker's secrets and the account's keys. It also calls `verifyPath` on the deployed Worker: a `200` with `iceServers` proves the key works, and a `502` or a `200` without them proves it is dead.
2. **Decide.** The key exists when a key with the declared name exists and both secrets are bound. A dead mint always counts as missing, so the deploy repairs it. If the token cannot list keys, bound secrets decide alone.
3. **Create.** A stale key of the same name is deleted and a new one is created. The values stay in memory.
4. **Bind.** Right after `wrangler deploy`, the values are set as secrets through the Cloudflare API. They never reach a command line or a file.
:::

A failure never fails the deploy. The plan shows a warning with the next step, and the report says
`turn: "degraded"`. The app should fall back to STUN until the key is bound.

### A key you create yourself

Creating a key needs `Calls: Edit` on `CLOUDFLARE_API_TOKEN`. If that call is refused, create the key
in the dashboard (Realtime, then TURN) and put the pair into `.env.local`:

```sh file=".env.local"
TURN_KEY_ID=...
TURN_KEY_API_TOKEN=...
```

With both set, the pair is the source. The deploy proves it with a live mint and binds it. It lists,
creates and deletes nothing. A pair that fails the mint gives `degraded`, with a clear reason.

## Config

`pluginConfigs.turn`, keyed by your logical name. The default is `{}`. Declare one instance: the
preflight reads the `.env.local` pair and `verifyPath` from the first.

| Option | Type | Default | Description |
|---|---|---|---|
| `[key].name` | `string` | required | The key name. A stage other than `production` suffixes it. |
| `[key].keyIdBinding` | `string` | `"TURN_KEY_ID"` | The secret for the key id. |
| `[key].apiTokenBinding` | `string` | `"TURN_KEY_API_TOKEN"` | The secret for the API token. |
| `[key].verifyPath` | `string \| false` | `"/api/ice"` | The Worker path that mints credentials, on the `workers.dev` URL. `false` turns the check off. |

## API

Mounted at `app.turn`.

| Method | Signature | Description |
|---|---|---|
| `deployManifest` | `() => { kind: "turn"; name: string; keyIdBinding: string; apiTokenBinding: string; verifyPath: string \| false }[]` | Build-time metadata, defaults resolved. |

## Events

### Emits

None. `deploy` announces the key with `provision:resource` and `provision:skip`, with `kind: "turn"`.

### Listens to

None.

## Depends on

Nothing. `deploy` looks for it by name. List it next to the other plugins in the deploy app.

## Example

```ts file="scripts/cli.ts" check
import {
  cliPlugin,
  createApp,
  d1Plugin,
  deployPlugin,
  durableObjectsPlugin,
  kvPlugin,
  queuesPlugin,
  storagePlugin,
  turnPlugin
} from "@moku-labs/worker";

const tools = createApp({
  plugins: [storagePlugin, kvPlugin, d1Plugin, queuesPlugin, durableObjectsPlugin, turnPlugin, deployPlugin, cliPlugin],
  config: { name: "my-game", compatibilityDate: "2026-06-17" },
  pluginConfigs: {
    turn: { relay: { name: "my-game-turn" } },
    deploy: { entry: "src/worker.ts", nodeCompat: true }
  }
});

const report = await tools.cli.deploy();
console.log(report.turn); // [!note] "skipped", "exists", "provisioned" or "degraded".
```

:::gotchas
- **A hand-bound key with another name gets replaced.** Existence follows the declared name. To manage secrets by hand, do not declare a `turn` instance: set them with `wrangler secret put`.
- **The first deploy cannot verify.** There is no Worker yet to call. An unverifiable check never counts against the key.
- **Teardown spares what it cannot attribute.** It deletes a key only when it matches the configured name. A `.env.local` key is never deleted.
- **The reduced CI token has no `Calls`.** A CI run with it cannot create a key. Create the key in a local deploy, or put the pair into the CI environment.
:::

## Related

- [deploy plugin](/docs/worker/plugins/deploy/): the plan and the report.
- [Build & deploy](/docs/worker/guides/deploy/): tokens.
