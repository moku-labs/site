---
title: deploy
description: "Node-only. Plans the resources, creates what is missing, writes wrangler.jsonc, uploads, and runs wrangler deploy."
section: Plugins
kind: node
order: 28
---

## What it does

**Node-only.** `deploy` turns the plugin config into a live Worker. It reads each resource plugin's
`deployManifest()`, creates what the account lacks, writes the wrangler config and runs
`wrangler deploy`. It also runs the local dev session, seeds D1 and tears a stage down. It runs in
your scripts, never inside the Worker.

## How it works

`run()` goes through fixed phases. Each one emits `deploy:phase`:

:::steps
1. **`auth`.** Verifies `CLOUDFLARE_API_TOKEN` and finds the account. `CLOUDFLARE_ACCOUNT_ID` pins it.
2. **`build`.** Only with a `webBuild` hook. Builds the site first.
3. **`detect`.** Assembles the manifest and applies the stage suffix.
4. **`provision`.** Lists what exists, shows the plan, asks, creates the rest. Durable Objects are never created here: they ship with the Worker.
5. **`wrangler-config`.** Merges the generated keys into the config file.
6. **`upload`.** Only when the first R2 instance has `upload`. One `wrangler r2 object put` per file.
7. **`deploy`.** Asks, then `wrangler deploy`. Emits `deploy:complete` with the `workers.dev` URL it finds in the output.
8. **`turn`.** Only with newly created or re-bound TURN values. Binds them as secrets.
9. **`migrate`, `seed`.** Only when asked for, and only after a live deploy.
:::

**Guided or automated.** On a terminal each failure offers a retry and each step asks first. A missing
token shows exactly which token to create, derived from your resources, and writes a `.env.local`
template. With `ci: true`, or when stdout is not a terminal, nothing asks and the first failure throws.
One exception: a failed migration or seed never throws. It lands in the report.

**The wrangler config** is merged, not replaced. Your other keys stay. Generated keys win over
`deploy.wrangler`, and existing ids of KV and D1 are kept. The file is written back as plain JSON, so
comments in it are lost.

| Plugin | wrangler section | Created by |
|---|---|---|
| `kv` | `kv_namespaces` | `wrangler kv namespace create` |
| `d1` | `d1_databases`, with `migrations_dir` | `wrangler d1 create` |
| `storage` | `r2_buckets` | `wrangler r2 bucket create` |
| `queues` | `queues.producers`, and `queues.consumers` with `onMessage` | `wrangler queues create` |
| `durableObjects` | `durable_objects.bindings`, and one `v1` migration | `wrangler deploy` |
| `turn` | none, Worker secrets | The Cloudflare API |

## Config

`pluginConfigs.deploy`.

| Option | Type | Default | Description |
|---|---|---|---|
| `configFile` | `string` | `"wrangler.jsonc"` | The config file to write and to pass with `--config`. |
| `entry` | `string` | none | The Worker module, written as `main`. A real deploy needs it, here or in the file. |
| `nodeCompat` | `boolean` | none | Writes `compatibility_flags: ["nodejs_compat"]`. Set it: a Worker on this package does not start without the flag. |
| `assets` | `{ binding; directory; spa? }` | none | The wrangler `assets` block. `spa: true` serves `index.html` for unknown paths. |
| `wrangler` | `Record<string, unknown>` | none | Any other top-level keys: `vars`, `routes`, `triggers`, `observability`. |
| `ci` | `boolean` | `false` | The default of `run({ ci })`. |
| `webBuild` | `() => Promise<unknown>` | none | The default build hook of `run` and `dev`. |
| `buildCommand` | `string` | `""` | The shell build `dev` falls back to. Empty uses `scripts/build.ts` when it exists. |
| `watch` | `string[]` | `["src/**/*.{ts,tsx,css}", "public/**/*"]` | What `dev` watches. Only the top directory of each glob counts. |
| `migrateLocal` | `boolean` | `true` | Apply local D1 migrations when `dev` starts. |
| `debounceMs` | `number` | `120` | How long `dev` gathers changes into one rebuild. |
| `seed` | `{ file; binding?; resetKv? }` | none | What `seed: true` loads, and which KV keys it deletes afterwards. |

## API

Mounted at `app.deploy`. Most scripts use [cli](/docs/worker/plugins/cli/) on top of it.

| Method | Signature | Description |
|---|---|---|
| `run` | `(opts?: { ci?, stage?, webBuild?, manifest?, migration?, seed? }) => Promise<DeployReport>` | The pipeline above. `manifest` replaces the assembled one, to ship any Worker. |
| `destroy` | `(opts?: { stage? }) => Promise<DeployReport>` | Deletes the stage's Worker and resources with their data. Terminal only, with two confirmations. |
| `dev` | `(opts?: { port?, stage?, webBuild?, onChange?, seed? }) => Promise<void>` | Writes the config, builds, migrates, runs `wrangler dev` (port 8787), rebuilds on change. Resolves on Ctrl+C. |
| `seed` | `(sqlFile: string, opts?: { stage?, binding?, remote? }) => Promise<void>` | Runs a SQL file on D1. Local by default, after local migrations. |
| `init` | `(opts?: { ci? }) => Promise<void>` | Writes a starter `configFile` if none exists. `ci` writes nothing extra in this version. |
| `checkInfra` | `() => Promise<InfraPlan>` | The read-only plan: `exists`, `missing`, `ships`. Uses `config.stage`. |
| `provisionInfra` | `(plan: InfraPlan) => Promise<ProvisionResult>` | Creates `plan.missing`. Failures are collected, not thrown. |
| `verifyAuth` | `() => Promise<AuthStatus>` | Checks the token. Throws when it is missing or inactive. |
| `requiredToken` | `() => TokenRequirement` | The permissions the first deploy needs. |
| `ciToken` | `() => PermissionGroup[]` | The smaller set for CI redeploys. |
| `tokenInstructions` | `() => string` | Both, as text. |
| `wrangler` | `(args: string[]) => Promise<void>` | Runs any wrangler command with inherited output. |

`run` resolves to a `DeployReport`:

| Field | Type | Description |
|---|---|---|
| `ok` | `boolean` | Live, and every requested step succeeded. Or fully destroyed. |
| `status` | `"deployed" \| "aborted" \| "failed" \| "destroyed"` | `aborted` means a prompt was declined or auth was not set up. Nothing shipped. |
| `stage` | `string` | The resolved stage. |
| `url` | `string` | Set once the Worker is live, even if a later step failed. |
| `resources` | `{ created; exists; bundled; failed }` | The provisioning tally. |
| `migration`, `seed` | `"skipped" \| "applied" \| "failed"` | The post-deploy steps. A failed migration fails the seed. |
| `turn` | `"skipped" \| "exists" \| "provisioned" \| "degraded"` | See [turn](/docs/worker/plugins/turn/). |
| `elapsedMs` | `number` | Duration. |
| `errors` | `string[]` | One message per failed step. |

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `deploy:phase` | `{ phase: string; detail?: string }` | Each phase above, plus `aborted` and `destroy`. `upload` fires after the files are up. |
| `deploy:complete` | `{ url: string }` | After `wrangler deploy`. |
| `auth:verified` | `{ account: string; accountId: string; scopes: string[] }` | After the token resolves. `scopes` is empty in this version. |
| `provision:plan` | `{ exists: number; missing: number; ships: number; account: string }` | After the listing. |
| `provision:resource` | `{ kind; name: string }` | One per created resource. |
| `provision:skip` | `{ kind; name: string }` | One per existing or shipped resource. |
| `dev:phase` | `{ phase: string; detail?: string }` | `build`, `migrate`, `seed`, `serve`, `rebuild`, `stopping`. |
| `dev:rebuilt` | `{ files: number; ms: number }` | After a rebuild in the session. |
| `dev:error` | `{ message: string }` | A failed rebuild. The session keeps serving. |

### Listens to

None.

## Depends on

- `storage`, `kv`, `d1`, `queues`, `durableObjects`: the `depends` list, all five required even when empty. See below.
- [turn](/docs/worker/plugins/turn/): read when it is composed.
- `CLOUDFLARE_API_TOKEN`, through the core `env` plugin. The default provider reads `process.env`, and Bun loads `.env.local` into it.
- `wrangler`, spawned as the bare command, so it has to be on the `PATH`.

## Example

```ts file="scripts/deploy.ts" check
import {
  createApp,
  d1Plugin,
  deployPlugin,
  durableObjectsPlugin,
  kvPlugin,
  queuesPlugin,
  storagePlugin
} from "@moku-labs/worker";

const tools = createApp({
  plugins: [storagePlugin, kvPlugin, d1Plugin, queuesPlugin, durableObjectsPlugin, deployPlugin], // [!note] The order matters: every resource plugin comes before `deploy`.
  config: { name: "tasks", compatibilityDate: "2026-06-17" },
  pluginConfigs: {
    d1: { main: { name: "tasks-db", binding: "DB", migrations: "db/migrations" } },
    kv: { cache: { name: "tasks-cache", binding: "CACHE" } },
    deploy: {
      entry: "src/worker.ts",
      nodeCompat: true,
      seed: { file: "db/seed.sql", resetKv: [{ binding: "CACHE", key: "tasks:index" }] },
      wrangler: { observability: { enabled: true } }
    }
  }
});

const report = await tools.deploy.run({ stage: "staging", migration: true, seed: true });
if (!report.ok) process.exitCode = 1;
console.log(report.status, report.url);
```

```sh terminal title="run it"
$ CLOUDFLARE_API_TOKEN=... bun run deploy
deployed https://tasks-staging.<your-subdomain>.workers.dev
```

:::gotchas
- **All five resource plugins are required.** `createApp({ plugins: [deployPlugin] })` throws. A plugin with no config adds no resource.
- **A new Durable Object class needs a hand-written migration.** Migrations are written only when the file has none.
- **`url` is a `workers.dev` address.** It is parsed from wrangler's output. A Worker with no such address reports an empty string.
- **Non-`production` stages rename everything.** Each stage has its own Worker, database and namespaces, with its own data.
- **A config file that does not parse is replaced.** It is treated as empty, then rewritten with no warning. Keep it valid JSONC.
- **`checkInfra`, `requiredToken` and `ciToken` ignore `--stage`.** They use `config.stage`.
:::

## Related

- [Build & deploy](/docs/worker/guides/deploy/): scripts, tokens, CI, teardown.
- [cli plugin](/docs/worker/plugins/cli/): the same work with branded output.
