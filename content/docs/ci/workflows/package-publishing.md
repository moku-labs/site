---
title: Package publishing
description: "package-ci.yml and package-release.yml: checks on every PR, a tokenless npm release on every merge."
section: Workflows
order: 10
---

## Two workflows

| Workflow | Runs on | Jobs |
|---|---|---|
| `package-ci.yml` | every pull request and push | `lint`, `types`, `test`, `build`, `extra`, `preview` |
| `package-release.yml` | a push to `main`, a dispatch, a published GitHub release | `check` → `release` → `package` → `publish` |

`setup` writes both callers. Do not write the YAML by hand.

```yaml file=".github/workflows/publish.yml" hl="4-13,25-27"
name: Release

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      release_type:
        type: choice
        required: true
        options: [patch, minor, major, prerelease]
  release:
    types: [published]

concurrency:
  group: publish-${{ github.ref }} # [!note] A literal group, not `github.workflow`. The reused checks take `Release-<ref>`, and sharing it would deadlock.
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  release:
    uses: moku-labs/ci/.github/workflows/package-release.yml@v1
    permissions: # [!note] The ceiling for the whole pipeline. Inside, each job takes only the one it needs.
      contents: write
      id-token: write
    with:
      release_type: ${{ inputs.release_type }}
```

## What each entry does

| Event | Bump | The `release` job | Publishes from |
|---|---|---|---|
| push to `main` | patch, always | cuts the tag and the GitHub release | the new tag |
| `workflow_dispatch` on `main` | `release_type` | cuts the tag and the GitHub release | the new tag |
| `release: published` | none | skipped | the release's tag |

A version with a `-` goes to the npm dist-tag `next`, and its GitHub release is marked as a
prerelease and never as latest. `prerelease` from a plain version produces an `rc`.

## Inputs

All inputs are optional.

| Input | Workflow | Default | Meaning |
|---|---|---|---|
| `runs_on` | both | `ubuntu-latest` | Runner label for every job |
| `bun_version` | both | `latest` | Passed to `setup-bun` |
| `validate` | both | `true` | Run `bun run validate` after the build |
| `extra` | both | `[]` | JSON array of extra scripts, one job each |
| `preview` | `package-ci` | `true` | Publish each PR commit to pkg.pr.new |
| `release_type` | `package-release` | none | Dispatch only. `patch`, `minor`, `major` or `prerelease` |
| `publish` | `package-release` | `true` | Set `false` to publish from a job of your own |
| `node_version` | `package-release` | `24` | Node for the publish job. It brings the npm that Trusted Publishing needs. |
| `artifact_name` | `package-release` | `npm-package` | Name of the tarball artifact |

`package-release.yml` outputs `tag`, `version`, `prev_tag` and `artifact_name`.

## Project checks

A check the contract scripts do not cover goes in `extra`. Each script is its own job, after its own
build, reported as `ci / extra (check:bundle)`.

```diff file=".github/workflows/ci.yml"
 jobs:
   ci:
     uses: moku-labs/ci/.github/workflows/package-ci.yml@v1
+    with:
+      extra: '["check:bundle", "test:cli-e2e"]'
```

Give `publish.yml` the same `extra`, so a release waits for the same checks. `setup` keeps a thin
caller that has its own inputs. An `extra` job is not required until
[the ruleset](/docs/ci/rulesets/) names it.

## PR previews

Every pull request commit is published to [pkg.pr.new](https://pkg.pr.new) by the `preview` job.
Nothing reaches npm and no token is in scope. A bot comments the install command on the PR.

```sh terminal title="try a PR in a consuming project"
$ bun add https://pkg.pr.new/@moku-labs/core@42 # [!note] 42 is the PR number. A commit sha works too.
```

| Rule | Where it holds |
|---|---|
| The pkg.pr.new GitHub App is installed on the repository | once per organization |
| The package repository is public. The consuming project may be private. | pkg.pr.new |
| A preview URL never reaches `main` | the `lint` job and the `preview-deps` check both refuse it |
| `preview` is not a required check | turn it off with `with: { preview: false }` |

## Dependabot

`setup` writes `.github/dependabot.yml` and `.github/workflows/dependabot-automerge.yml`.

:::flow
- Dependabot opens one grouped PR a day
- the workflow turns on auto-merge
- the required checks pass
- the PR merges
- the workflow dispatches a patch
:::

A bump of `devDependencies` alone releases nothing. The published package is the same, and two
packages that pin each other would release each other forever. Family packages skip Dependabot's
3-day cooldown: they are trusted the moment they are released.

## A version only in tags

A package may keep its version in git tags and leave `version` out of `package.json`. `build` and
`preview` then seed it from the latest `v*` tag before they pack. Nothing is committed.

## When a release fails

```sh terminal title="start here"
$ gh run view <id> --log-failed
$ bun run release:doctor
```

| Symptom | Cause | Fix |
|---|---|---|
| The run shows 0 jobs and never starts | The caller's `concurrency` group equals the child's | Take `publish.yml` back to the template |
| `E422` on publish | `repository.url` differs from the repository | `doctor` names it. Fix `package.json`. |
| The publish fails auth | No trusted publisher, or the file was renamed | `doctor` prints the `npm trust github …` line |
| `wait` says no `publish.yml` run started | `publish.yml` has no `push` trigger, or `GITHUB_TOKEN` made the merge | Add the trigger. For Dependabot, take the current `dependabot-automerge.yml`. |
| `doctor` warns that npm is behind the tag | A run tagged but did not publish | Re-run that release, or dispatch a `patch` |
| A new version ships old code | A dispatch releases `origin/main`, not your tree | Merge first. The CLI refuses a `HEAD` that is not `origin/main`. |

If npm ever rejects a publish made inside a reusable workflow of another repository, copy
`node_modules/@moku-labs/ci/examples/package/publish.local-publish.yml` over `publish.yml` and keep
the file name. It passes `publish: false` and runs `npm publish` in your own job. Check, release and
package stay central. Do not switch before that happens.

:::callout{tone="warn"}
Never add an `NPM_TOKEN`. A token can leak, and it does not work with provenance. If you find one in
a repository, delete it.
:::
