---
title: deploy
description: "Node-only. Ships the built site to Cloudflare Pages through wrangler, and scaffolds wrangler.jsonc and a CI workflow."
section: Plugins
kind: node
order: 25
---

## What it does

**Node-only.** `deploy` ships `outDir` to Cloudflare Pages by running `wrangler pages deploy` in
a subprocess. It also writes the local scaffolding: `wrangler.jsonc`, and on request a GitHub
Actions workflow. Nothing happens until you call it: `app.deploy.run()` or `app.deploy.init()`.

## How it works

The Pages project name is not config. It is `site.name()` as a slug: `My Cool Blog!` deploys to
`my-cool-blog`. `run()` and `init()` both use it, so the project and the scaffold cannot drift.

Every `run()` goes through the same checks, cheap first, and stops at the first failure:

:::steps
1. **Preflight.** `wrangler.jsonc` exists, `outDir` exists and is not empty, at most 20,000 files, no file over 25 MiB.
2. **Guards.** `outDir` resolves inside the project. The branch matches `/^[a-zA-Z0-9/_.-]+$/`, so it cannot be read as a flag.
3. **Token.** `CLOUDFLARE_API_TOKEN` is read with `ctx.env.require` and passed to the subprocess environment only: never in the arguments, never logged.
4. **Deploy.** `bunx wrangler pages deploy <outDir> --project-name <slug> --branch <branch>`, spawned with an argument list, no shell.
5. **Report.** All subprocess output is scrubbed before it is logged: long, high-entropy tokens become `***`. On success the result is stored and `deploy:complete` is emitted.
:::

A failure throws an `Error` with a `code`: `ERR_DEPLOY_NO_WRANGLER_CONFIG`,
`ERR_DEPLOY_EMPTY_OUTDIR`, `ERR_DEPLOY_TOO_MANY_FILES`, `ERR_DEPLOY_FILE_TOO_LARGE`,
`ERR_DEPLOY_PATH_TRAVERSAL`, `ERR_DEPLOY_INVALID_BRANCH`, `ERR_DEPLOY_NO_TOKEN`,
`ERR_DEPLOY_PROJECT_NOT_FOUND`, `ERR_DEPLOY_AUTH_EXPIRED`, `ERR_DEPLOY_AUTH`,
`ERR_DEPLOY_NETWORK`, `ERR_DEPLOY_WRANGLER_FAILED` or `ERR_DEPLOY_CONFIG`.

## Config

`pluginConfigs.deploy`. Every field has a default.

| Option | Type | Default | Description |
|---|---|---|---|
| `target` | `"cloudflare-pages"` | `"cloudflare-pages"` | The only target. |
| `outDir` | `string` | `"dist"` | The built site, relative to the project root. Checked again on every `run()`. |
| `productionBranch` | `string` | `"main"` | The branch `run()` deploys when you pass none. |
| `scrubAllowlist` | `string[]` | `["CLOUDFLARE_ACCOUNT_ID"]` | Substrings that are never masked in logged output. |
| `compatibilityDate` | `string` | `"2024-01-01"` | Written into the generated `wrangler.jsonc`. `YYYY-MM-DD`. |
| `ci` | `boolean` | `false` | Whether `init()` also writes `.github/workflows/deploy.yml`. |

`createApp` fails with `ERR_DEPLOY_CONFIG` on an unknown target, an empty `outDir`, a
`scrubAllowlist` that is not a list of strings or a malformed `compatibilityDate`. The file cap
can be raised toward the paid-plan limit with the `MOKU_DEPLOY_MAX_FILES` environment variable.

## API

Mounted at `app.deploy`, reachable with `ctx.require(deployPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `run` | `(options?: { branch?: string }) => Promise<DeployResult>` | Deploys `outDir`. Resolves to `{ url, deploymentId, branch, durationMs }`. |
| `init` | `(options?: { ci?, check?, workflowTrigger? }) => Promise<InitResult>` | Writes `wrangler.jsonc` (never overwrites it) and, with `ci`, the workflow. `check: true` writes nothing and reports drift. Resolves to `{ written, skipped, drifted }`. |
| `getLastDeployment` | `() => Readonly<DeployResult> \| null` | The last successful deploy of this process, or `null`. |
| `projectName` | `() => string` | The Pages project slug, from `site.name()`. |
| `createProject` | `() => Promise<{ name, branch }>` | Runs `wrangler pages project create` for the slug and the production branch. Fails when the project exists. |

`workflowTrigger` is `"auto"` (push to `main`, the default), `"versioned-tag"` (a `v*` tag) or
`"dispatch"` (the manual button only). The generated workflow pins every action to a commit SHA
and reads the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `deploy:complete` | `{ url: string; deploymentId: string; branch: string; durationMs: number }` | Once, after a successful deploy. A failed one emits nothing. |

### Listens to

None.

## Depends on

- [site](/docs/web/plugins/site/): `name()`, for the project slug.
- The core `env` plugin: `ctx.env.require("CLOUDFLARE_API_TOKEN")`. Wire Node env providers in
  `pluginConfigs.env`, for example `[processEnv(), dotenv(".env")]`.

## Example

```ts file="scripts/deploy.ts" check
import { createApp, deployPlugin, dotenv, processEnv } from "@moku-labs/web";

const app = createApp({
  plugins: [deployPlugin],
  pluginConfigs: {
    site: { name: "My Cool Blog!", url: "https://blog.dev", author: "Ada", description: "Notes." },
    deploy: { outDir: "dist", productionBranch: "main" },
    env: { providers: [processEnv(), dotenv(".env")] }
  }
});

console.log(app.deploy.projectName()); // "my-cool-blog"

const scaffold = await app.deploy.init({ ci: true, workflowTrigger: "versioned-tag" }); // [!note] Run it once. Later runs skip files that exist.
console.log(scaffold.written); // ["wrangler.jsonc", ".github/workflows/deploy.yml"] on the first run

const result = await app.deploy.run({ branch: "preview/landing" }); // [!note] Ships whatever is in `dist/`. Build first.
console.log(result.url);
```

```sh terminal title="deploy"
$ bun scripts/deploy.ts
my-cool-blog
[ "wrangler.jsonc", ".github/workflows/deploy.yml" ]
https://….pages.dev
```

The URL is the one wrangler printed for the deployment.

:::gotchas
- **`deploy` does not build.** Run `app.build.run()` or `app.cli.build()` first.
- **`init()` does not create the Pages project.** It only writes local files. The first deploy to a new project fails with `ERR_DEPLOY_PROJECT_NOT_FOUND`: create it in the dashboard, with `createProject()`, or let the `cli` wizard do it.
- **The token comes through `env`.** A token in your shell is invisible to the plugin until an env provider such as `processEnv()` is composed.
- **Renaming the site renames the project.** The slug follows `site.name`. Rename both on purpose.
- **Runs under Bun.** The default spawner is `Bun.spawn`. Without Bun, `run()` throws `ERR_DEPLOY_WRANGLER_FAILED`.
:::

## Related

- [Build & deploy](/docs/web/guides/deploy/): the scripts, the wizard and CI.
- [cli plugin](/docs/web/plugins/cli/): `app.cli.deploy()` with the guided wizard.
