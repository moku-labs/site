---
title: "@moku-labs/ci"
description: "One CI and release pipeline. Tokenless publishing."
section: Get started
---

## Overview

`@moku-labs/ci` is one CI and release pipeline for every Moku package: reusable GitHub workflows
pinned by tag, plus the `moku-release` CLI that installs them into a project. A project keeps two
short workflow files and a few scripts. Everything else lives in one place.

- **Shared, versioned workflows.** Every package calls the same reusable workflows from `@v1`. A fix
  lands once and reaches every project.
- **Scripts are the interface.** The workflows call `bun run lint`, never a tool directly. A
  project with special needs changes its own script.
- **No tokens.** npm Trusted Publishing with `id-token: write`. There is no `NPM_TOKEN` anywhere.

| Who releases | Version |
| --- | --- |
| a merge to `main` | patch, always |
| a person | minor |
| a person, for a milestone | major |

## Install

```sh terminal
bun add -d @moku-labs/ci
bun run release:setup
```

`release:setup` writes the two workflow files and the Dependabot files, adds the missing scripts,
does the first publish, registers the trusted publisher and applies the branch ruleset. Run it again
any time: it only does what is still missing. The [quick start](/docs/ci/quick-start/) walks through
it.

:::callout{tone="warn"}
Two steps are yours alone, because the CLI never handles a credential: `gh auth login` and
`npm login`.
:::

## Quick start

The CI caller is a thin file. All logic lives in `moku-labs/ci`:

```yaml file=".github/workflows/ci.yml"
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  ci:
    uses: moku-labs/ci/.github/workflows/package-ci.yml@v1
```

Every pull request then reports the four required checks, `ci / lint`, `ci / types`, `ci / test`
and `ci / build`, plus `ci / preview`. Check the setup any time:

```sh terminal
bun run release:doctor
```

## Where to go next

| You want to | Read |
|---|---|
| Set up a package | [Quick start](/docs/ci/quick-start/) |
| Understand the pipeline | [How it works](/docs/ci/how-it-works/) |
| Publish to npm, previews, a failed release | [Package publishing](/docs/ci/workflows/package-publishing/) |
| Deploy an app to Cloudflare | [App deploy](/docs/ci/workflows/app-deploy/) |
| Test an engine change on real games | [Demos](/docs/ci/workflows/demos/) |
| Look up a command or a check | [moku-release](/docs/ci/moku-release/) |
| Protect `main` | [Rulesets](/docs/ci/rulesets/) |

## Start with Claude

Ask Claude to set up CI and releases.

```text prompt
Set up CI and npm releases for my package with @moku-labs/ci
```

```text prompt
Publish to npm with Trusted Publishing, no NPM_TOKEN
```

```text prompt
Check my CI and release setup with release:doctor
```

```text prompt
Add Dependabot and a branch ruleset to my repo with release:setup
```
