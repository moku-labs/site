---
title: Demos
description: "demos.yml: run the real moku games against what a pull request builds."
section: Workflows
order: 12
---

## What it does

`demos.yml` runs the games in `moku-labs/demos` against the engine or editor a pull request builds.
An engine change that breaks a real game fails on its own pull request, not after the release.

:::flow
- discover the demos
- refuse local paths
- write the PR's preview over each pin
- run the demo's scripts
:::

The workflow is thin. It replaces the pin in the demo's `package.json`, installs, and runs the demo's
plain scripts, the same way a developer does locally.

## Tiers

| Tier | Runs | Runner | Check |
|---|---|---|---|
| `fast` | `bun run test` | ubuntu | `demos / fast`, the one to require |
| `full` | `fast`, plus `bun run test:visual` | macOS | `demos / full` |
| | plus `bun run test:editor` | ubuntu | |

Pixel baselines run on macOS, because WebGPU loses its device on Linux runners. Each demo gets its
own matrix job, and the two stable checks collect the results.

## The caller

The job runs after `ci`, because the preview job of `ci` publishes the build it tests. A label asks
for the full tier.

```yaml file=".github/workflows/ci.yml" hl="7,16-22"
name: CI

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, labeled]

permissions:
  contents: read

jobs:
  ci:
    uses: moku-labs/ci/.github/workflows/package-ci.yml@v1

  demos:
    needs: ci
    if: github.event_name == 'pull_request'
    uses: moku-labs/ci/.github/workflows/demos.yml@v1
    with:
      game: https://pkg.pr.new/@moku-labs/game@${{ github.event.pull_request.head.sha }} # [!note] In the editor's repository, pass `editor:` instead.
      tier: ${{ contains(github.event.pull_request.labels.*.name, 'demos:full') && 'full' || 'fast' }}
```

Both example files ship with the package: `examples/package/ci-with-demos.yml`, and
`examples/package/demos-comment.yml`, which runs the full tier on a PR comment `/demos full` from a
member or collaborator.

## Inputs

All inputs are optional.

| Input | Default | Meaning |
|---|---|---|
| `game` | empty | Engine under test: a version, a pkg.pr.new URL, or empty for each demo's own pin |
| `editor` | empty | Editor under test, same forms |
| `tier` | `fast` | `fast` or `full` |
| `demos_ref` | `main` | Branch or sha of `moku-labs/demos` when no paired branch exists |
| `paired_ref` | the PR branch | Branch name to look for in `moku-labs/demos` first |
| `only` | `[]` | JSON array of demo folders. Empty runs all of them. |
| `bun_version` | `latest` | Passed to `setup-bun` |

## An intended break

A change that breaks the demos on purpose lands with its fix. Name a branch in `moku-labs/demos`
exactly like the engine's branch. That branch wins over `demos_ref`, so the engine's pull request
runs against the fixed demos.

## What counts as a demo

```json file="demos/merge-game/package.json"
{
  "moku": { "demo": true },
  "scripts": {
    "test": "...",
    "test:visual": "...",
    "test:editor": "..."
  }
}
```

A folder at the root of `moku-labs/demos` whose `package.json` has `"moku": { "demo": true }`.

:::gotchas
- **A local path fails the run.** A tracked file with `/Users/`, `/home/…` or `?? "../` is refused. Pin a version, a preview URL or a packed `.tgz`.
- **`game` replaces a pin in `dependencies`, `editor` one in `devDependencies`.** A demo that does not declare the package keeps what it has.
- **`issue_comment` has no head branch.** The comment workflow passes `paired_ref` itself.
- **The preview must be on.** With `preview: false` in `ci`, the URL the demos install does not exist.
:::
