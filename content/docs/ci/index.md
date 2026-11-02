---
title: "@moku-labs/ci"
description: "One CI and release pipeline. Tokenless publishing."
section: Get started
---

## Overview

`@moku-labs/ci` is one CI and release pipeline for every Moku package: reusable GitHub workflows
pinned by tag, plus the `moku-release` CLI that installs them into a project. A project keeps two
short workflow files and a few scripts. Everything else lives in one place.

- **One copy of the pipeline.** Every package calls the same reusable workflows from `@v1`. A fix
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
registers the trusted publisher and applies the branch ruleset. Run it again any time: it only does
what is still missing.

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

Every pull request then reports four checks: `ci / lint`, `ci / types`, `ci / test` and
`ci / build`. Check the setup any time:

```sh terminal
bun run release:doctor
```

## Start with Claude

Describe what you want. The conductor picks the packages.

```text prompt
Build a blog with tags and an RSS feed on @moku-labs/web
```

```text prompt
Add a D1-backed comments API with @moku-labs/worker
```

```text prompt
Make a couch quiz game: TV shows questions, phones answer
```

```text prompt
Ship this app to macOS and iOS
```
