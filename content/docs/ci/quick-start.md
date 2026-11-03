---
title: Quick start
description: "From a package with no CI to a tokenless release on every merge to main."
section: Get started
order: 2
---

## From no CI to a release

This page sets up an npm package. An app that deploys to Cloudflare needs no CLI: see
[App deploy](/docs/ci/workflows/app-deploy/).

:::steps
1. **Log in, once per machine.** The CLI never handles a credential, so these two are yours. It also needs an `npm` new enough for Trusted Publishing, which Node 24 brings. `doctor` checks it.

   ```sh terminal title="yours alone"
   $ gh auth login
   $ npm login
   ```

2. **Add the package.** It is a dev dependency with no runtime dependencies of its own.

   ```sh terminal title="install"
   $ bun add -d @moku-labs/ci
   ```

3. **See the state.** `doctor` changes nothing in the project. Every red line names its fix.

   ```sh terminal title="doctor"
   $ bunx moku-release doctor
    * moku release  doctor
    -----------------------------------------------------------------
     ✓ gh installed and authenticated — authenticated
     ✗ package.json on contract — missing script `lint`, missing script `validate`, missing `files`
         fix: moku-release setup
     ✗ workflows are thin callers pinned to @v1 — missing .github/workflows/ci.yml, .github/workflows/publish.yml
         fix: moku-release setup
     ⚠ package published on npm — first publish not done yet
         fix: moku-release setup
   ```

4. **Preview the wizard.** `--dry-run` prints every action and asks nothing.

   ```sh terminal title="dry run"
   $ bunx moku-release setup --dry-run
   ```

5. **Run it.** `setup` asks before each step that changes something, and adds the `release`, `release:setup` and `release:doctor` scripts. npm owns any one-time code prompt, and you answer it.

   ```sh terminal title="setup"
   $ bunx moku-release setup
   ```

6. **Commit on a branch and open a pull request.** `main` now takes pull requests only, and the PR runs the four required checks.

   ```sh terminal title="the first PR"
   $ git switch -c ci/setup
   $ git add . && git commit -m "ci: moku-labs/ci"
   $ gh pr create --fill
   ```

7. **Merge, then wait for the release.** The merge ships a patch by itself. `wait` proves that npm serves a version holding your commit.

   ```sh terminal title="after the merge"
   $ git switch main && git pull
   $ bun run release wait
   ```
:::

## What setup leaves behind

| File or setting | What it is |
|---|---|
| `.github/workflows/ci.yml` | Thin caller of `package-ci.yml` |
| `.github/workflows/publish.yml` | Thin caller of `package-release.yml`. The file name is a contract with npm. |
| `.github/dependabot.yml` | One grouped pull request a day for `@moku-labs/*` |
| `.github/workflows/dependabot-automerge.yml` | Merges that pull request once the checks pass, then releases a patch |
| `package.json` | The missing scripts and fields. Values you already chose stay. |
| A first publish and a `v*` tag | Only when the package is not on npm yet |
| npm trusted publisher | Registered for `publish.yml` of this repository |
| Branch ruleset on `main` | Pull requests only, no force push, the four checks required |
| The repository's auto-merge setting | Allowed, so the Dependabot workflow can use it |

## The next releases

```sh terminal title="a person asks for a minor"
$ bun run release minor
```

A patch needs no command: every merge to `main` is one. The full list is on the
[moku-release](/docs/ci/moku-release/) page.

:::gotchas
- **The first publish has no provenance.** A trusted publisher cannot be registered for a package that does not exist yet, so `setup` publishes from your machine once. Every later release is tokenless, from the workflow.
- **Keep the name `publish.yml` and the job id `ci`.** npm trusts the file name, and the required checks are named after the job id. Rename either and the publish or the ruleset breaks.
- **`repository.url` must match the git remote.** Otherwise a provenance publish fails with `E422`. `doctor` compares the two.
- **An agent uses `setup --yes`.** Every confirmation is a yes. A step that needs your one-time code is printed, not run.
:::
