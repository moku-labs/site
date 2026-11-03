---
title: How it works
description: "Two thin callers, one set of workflows, tags pinned by a moving major. No token anywhere."
section: Get started
order: 3
---

## The picture

```text file="one project, one central repository"
YOUR PROJECT                         moku-labs/ci@v1
.github/workflows/ci.yml       ──►   package-ci.yml        lint · types · test · build
.github/workflows/publish.yml  ──►   package-release.yml   check → release → package → publish
package.json scripts           ◄──   every job calls `bun run <script>`

moku-release (in node_modules)
  setup    writes the callers, the scripts, the trusted publisher, the ruleset
  doctor   reads all of it and names what is missing
  wait     proves npm serves your commit
```

A project keeps two short files. The logic lives once, in `moku-labs/ci`, and a fix there reaches
every project through the `@v1` tag.

## A caller is a few lines

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

GitHub prefixes the jobs of a reusable workflow with the caller's job id. That is why the checks
read `ci / lint`, and why the id stays `ci`.

## Scripts are the interface

The workflows call scripts, never tools. A project with special needs changes its own script and
the central YAML stays the same.

| Script | Who calls it | Usual body |
|---|---|---|
| `lint` | `lint` job | `biome check . && eslint .` |
| `typecheck` | `types` job | `tsc --noEmit` |
| `test` | `test` job | `vitest run` |
| `build` | `build` job, and again before `npm pack` | `tsdown` |
| `validate` | `build` job, after the build | `publint && attw --pack . --profile node16` |
| `release`, `release:setup`, `release:doctor` | you | `moku-release`, `moku-release setup`, `moku-release doctor` |

```json file="package.json"
{
  "scripts": {
    "typecheck": "tsc --noEmit && tsc -p tsconfig.worker.json --noEmit"
  }
}
```

That is a package with a second typecheck pass. It needed no workflow change.

## Who releases what

| Who releases | Version | How it starts |
|---|---|---|
| a merge to `main` | patch, always | the push runs `publish.yml` |
| a Dependabot merge | patch | `dependabot-automerge.yml` dispatches `publish.yml` |
| a person | minor | `bun run release minor` |
| a person, for a milestone | major | `bun run release major` |

Nothing a commit says can change the bump. A push is a patch, whatever its message reads.

## No token

:::flow
- check
- release
- package
- publish
:::

| Job | Permission | What it does |
|---|---|---|
| `check` | `contents: read` | The same checks a pull request runs |
| `release` | `contents: write` | Derives the version from the latest tag, pushes the tag only, creates the GitHub release |
| `package` | `contents: read` | Installs, builds and packs the tarball. Install scripts never see a credential. |
| `publish` | `id-token: write` | Downloads the tarball and publishes through OIDC. It installs nothing. |

npm matches the OIDC token against the trusted publisher registered for `publish.yml`. There is no
`NPM_TOKEN` to store, rotate or leak.

`package.json` on `main` is not bumped: the `release` job commits the bump locally and pushes only
the tag, so a protected `main` is never written. The tag and npm are the truth.

## Which ref a project pins

| Ref | Meaning |
|---|---|
| `@v1` | Moving major tag. Projects pin this and get fixes by themselves. It moves only for backwards-compatible changes. |
| `@v1.x.y` | Immutable tag on every change. Pin it to freeze a project. |
| `@v2` | Any breaking change: a removed input, a changed default, a renamed job. `v1` stays where it was. |

The npm package and the workflows are one repository with one version line. `moku-release` reads
its templates from its own install, so the CLI and the files it writes cannot drift apart.

:::gotchas
- **No `concurrency` in a package's `ci.yml`.** `package-ci.yml` already owns the group `<workflow>-<ref>`. A caller holding the same group waits for its own child, and the run ends with 0 jobs.
- **Secrets and permissions do not flow in by themselves.** A called workflow cannot elevate past its caller, and it inherits no secrets. `publish.yml` grants `contents: write` and `id-token: write` as the ceiling. An app's `ci.yml` passes its secrets by name.
- **A merge by `GITHUB_TOKEN` starts no push run.** That is why the Dependabot workflow dispatches the patch itself.
- **Green is not shipped.** `release` and `release wait` end only when npm serves the version.
:::
