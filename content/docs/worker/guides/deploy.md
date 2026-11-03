---
title: Build & deploy
description: "The deploy script, tokens, stages, migrations, CI and teardown."
section: Guides
order: 10
---

## The deploy script

Keep the deploy tools out of the Worker. A Node-side app reads the same resource config, as in the
[quick start](/docs/worker/quick-start/). Scripts call `app.cli`, and `package.json` runs them, so
`wrangler` from `node_modules/.bin` is on the `PATH`.

```json file="package.json"
{
  "scripts": {
    "dev": "bun scripts/cli.ts dev",
    "deploy": "bun scripts/cli.ts deploy",
    "doctor": "bun scripts/cli.ts doctor"
  }
}
```

## The token

`deploy` reads `CLOUDFLARE_API_TOKEN` from the environment. `.env.local` is enough, since Bun loads it.
Without a token, the first `bun run deploy` on a terminal shows what to create and writes the template:

:::steps
1. **Start from the template.** In the Cloudflare dashboard, create a token from "Edit Cloudflare Workers".
2. **Add what the template lacks.** It covers Workers Scripts, KV, R2 and Account Settings. D1, Queues and Calls are added by you, when you use them.
3. **Pin the account.** Set `CLOUDFLARE_ACCOUNT_ID`. Without it the first account the token sees is used.
4. **Run again.** A token pasted during a run counts from the next run.
:::

`tools.cli.auth("setup")` prints the exact list for your resources.

## Stages

A stage is a full, separate copy: `tasks` and `tasks-db` on `production`, `tasks-dev` and `tasks-db-dev`
on `dev`. Any string works.

```sh terminal title="stages"
$ bun scripts/cli.ts deploy --stage staging
$ bun scripts/cli.ts dev --stage dev
```

The generated `wrangler.jsonc` follows the last stage you ran. Treat it as generated output.

## Migrations and seeds

Local migrations run when `dev` starts. Remote ones run only when you ask, after the Worker is live:

```ts file="scripts/release.ts" check
import {
  cliPlugin,
  createApp,
  d1Plugin,
  deployPlugin,
  durableObjectsPlugin,
  kvPlugin,
  queuesPlugin,
  storagePlugin
} from "@moku-labs/worker";

const tools = createApp({
  plugins: [storagePlugin, kvPlugin, d1Plugin, queuesPlugin, durableObjectsPlugin, deployPlugin, cliPlugin],
  config: { name: "tasks", compatibilityDate: "2026-06-17" },
  pluginConfigs: {
    d1: { main: { name: "tasks-db", binding: "DB", migrations: "db/migrations" } },
    kv: { cache: { name: "tasks-cache", binding: "CACHE" } },
    deploy: {
      entry: "src/worker.ts",
      nodeCompat: true,
      seed: { file: "db/seed.sql", resetKv: [{ binding: "CACHE", key: "tasks:index" }] } // [!note] After the SQL, these cached keys are deleted, so reads rebuild from the new rows.
    }
  }
});

const report = await tools.cli.deploy({ migration: true, seed: process.argv.includes("--seed") });
console.log(report.status, report.migration, report.seed);
```

The new code goes live before the migration runs. So write changes that work with both schemas. A
failed migration skips the seed, and the report says `failed` with the `url` still set: the Worker is
live.

`tools.cli.dev({ seed: true })` loads the same seed into the local database.

## CI

The token for a redeploy is smaller: it reads the data resources and never creates them. Print it with
`auth("setup")`. Store `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as secrets.

```yaml file=".github/workflows/deploy.yml"
name: deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run deploy --ci
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Pass `process.argv.includes("--ci")` to `tools.cli.deploy({ ci })`, as in the [cli example](/docs/worker/plugins/cli/).
Off a terminal the run is automated anyway. A failure sets a non-zero exit code, so the job goes red.
With the reduced token a missing resource fails the run: do the first deploy locally, or give CI the
full token.

## Teardown

```ts file="scripts/destroy.ts" check
import {
  cliPlugin,
  createApp,
  d1Plugin,
  deployPlugin,
  durableObjectsPlugin,
  kvPlugin,
  queuesPlugin,
  storagePlugin
} from "@moku-labs/worker";

const tools = createApp({
  plugins: [storagePlugin, kvPlugin, d1Plugin, queuesPlugin, durableObjectsPlugin, deployPlugin, cliPlugin],
  config: { name: "tasks", compatibilityDate: "2026-06-17" }
});

await tools.cli.deploy({ delete: true, stage: "dev" }); // [!note] Asks twice: yes or no, then the stage name typed out.
```

It deletes the Worker with its Durable Objects, then the KV namespaces, D1 databases, R2 buckets and
queues the config declares, with all their data. Without a terminal it refuses. A non-empty R2 bucket
makes that one row fail: empty it, then run again.

:::gotchas
- **`init()` does not write a workflow.** It writes a starter `wrangler.jsonc` only, even with `ci`. Use the file above.
- **Commit the config or not, but do not hand-edit generated keys.** Resource sections are rewritten on each run. Put your own keys under `deploy.wrangler`.
- **`bun run deploy --ci`.** Bun passes the flag after the script name on to your script.
:::

## Related

- [deploy plugin](/docs/worker/plugins/deploy/): every option and the report.
- [cli plugin](/docs/worker/plugins/cli/): the verbs.
- [d1 plugin](/docs/worker/plugins/d1/): the `migrations` path.
