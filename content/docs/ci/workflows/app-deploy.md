---
title: App deploy
description: "app-deploy.yml: validate every PR, deploy a Layer-3 app to Cloudflare on every push to main."
section: Workflows
order: 11
---

## What it does

`app-deploy.yml` is for an app that deploys and never publishes to npm. It has two jobs, and
everything it runs is a script name you pass in.

| Job | Check name | Runs on | Steps |
|---|---|---|---|
| `validate` | `ci / Validate (typecheck · lint · test · build)` | every PR and push | typecheck, lint, test, build, worker build |
| `deploy` | `ci / Deploy to Cloudflare` | a push to `main` only | build, worker build, migrations, deploy |

On a pull request `deploy` shows as skipped. A fork or a branch never deploys.

## Set it up

The CLI sets up packages only. An app copies the caller.

:::steps
1. **Add a `deploy` script.** On `@moku-labs/web` that is `bun scripts/deploy.ts`, see [Build & deploy](/docs/web/guides/deploy/).
2. **Copy the caller.** It comes with the package.

   ```sh terminal title="copy"
   $ bun add -d @moku-labs/ci
   $ mkdir -p .github/workflows
   $ cp node_modules/@moku-labs/ci/examples/app/ci.yml .github/workflows/ci.yml
   ```

3. **Set the two secrets.** Each command asks for the value, so it stays out of your shell history.

   ```sh terminal title="secrets"
   $ gh secret set CLOUDFLARE_API_TOKEN
   $ gh secret set CLOUDFLARE_ACCOUNT_ID
   ```

4. **Trim the caller to what the app has.** A static site needs no worker build and no migrations.
:::

This is the caller of this website, `moku-labs.com`:

```yaml file=".github/workflows/ci.yml"
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency: # [!note] Safe here, because `app-deploy.yml` sets no group of its own. A newer push cancels the older run.
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  ci:
    uses: moku-labs/ci/.github/workflows/app-deploy.yml@v1
    with:
      test_script: test:coverage
      deploy_script: deploy
    secrets: # [!note] Reusable workflows do not inherit secrets. Pass each one by name.
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## With a backend

An app with a Worker and a database passes the two optional scripts.

```yaml file=".github/workflows/ci.yml"
jobs:
  ci:
    uses: moku-labs/ci/.github/workflows/app-deploy.yml@v1
    with:
      test_script: test:coverage
      build_worker_script: build:worker # [!note] Runs after the client build: the worker's dry run reads `dist/client`.
      migrate_script: migrate:remote # [!note] Runs before the deploy, for example `wrangler d1 migrations apply <db> --remote`.
      deploy_script: deploy
    secrets:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `runs_on` | `ubuntu-latest` | Runner label for both jobs |
| `bun_version` | `latest` | Passed to `setup-bun` |
| `lint_script` | `lint` | Script of the lint step |
| `typecheck_script` | `typecheck` | Script of the typecheck step |
| `test_script` | `test` | For example `test:coverage` |
| `build_script` | `build` | The client build |
| `build_worker_script` | empty | A second build. Empty skips it. |
| `migrate_script` | empty | Runs before the deploy. Empty skips it. |
| `deploy_script` | `deploy` | The deploy script |

| Secret | Required | Meaning |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | yes | A Cloudflare token that may deploy this project |
| `CLOUDFLARE_ACCOUNT_ID` | yes | The Cloudflare account id |

## Dependabot

Copy `node_modules/@moku-labs/ci/examples/dependabot.yml` to `.github/dependabot.yml`. Leave
auto-merge out: on an app a merge runs the deploy, so a person merges the bump.

:::gotchas
- **`deploy` builds again.** The jobs share no artifact, so the deploy job installs and builds from the commit itself.
- **The lockfile must be committed.** Both jobs run `bun install --frozen-lockfile`.
- **The package rules do not apply.** An app has one `validate` job, so `rulesets/main.json` would wait for checks that never report. See [Rulesets](/docs/ci/rulesets/) for the app version.
- **Package previews do not apply.** The pkg.pr.new job lives in `package-ci.yml`.
:::
