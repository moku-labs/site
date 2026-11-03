---
title: moku-release
description: "The CLI: setup once, doctor any time, wait after a merge, fleet for the whole organization."
section: Reference
order: 20
full: true
---

## Commands

The `release*` scripts are plain aliases of the `moku-release` bin.

| Command | When | Changes |
|---|---|---|
| `bun run release:setup` | once per project | yes, each step confirmed |
| `bun run release:doctor` | any time | nothing in the project |
| `bun run release wait` | after each merge to `main` | nothing |
| `bun run release fleet` | any time | nothing |
| `bun run release <patch\|minor\|major\|prerelease>` | a release a person asks for | dispatches the workflow |

| Flag | Works on | Meaning |
|---|---|---|
| `--dry-run` | `setup`, a release | Prints every action, changes nothing, asks nothing |
| `--yes`, `-y` | `setup` | Answers every confirmation with yes, for agents and CI |
| `--json` | `doctor`, `fleet` | Machine output |
| `--markdown` | `fleet` | The public rows as a Markdown table |
| `--deps` | `fleet` | Adds the toolchain and runtime-dependency tables |

An unknown flag or command prints the usage and exits 1. It is never guessed.

:::callout{tone="warn"}
The CLI never logs you in and never handles a credential. `gh auth login` and `npm login` are yours.
`npm publish` and `npm trust` run with your terminal attached, so npm owns the one-time code prompt.
:::

## setup

An idempotent wizard. Each step first asks whether it is already done, and prints a check instead of
redoing it. Run it again any time.

| # | Step | What it does |
|---|---|---|
| 1 | Prerequisites | `gh` and `npm` are logged in. If not, it prints the command and stops. |
| 2 | Workflows | Writes `ci.yml` and `publish.yml`. A thin caller with its own inputs stays. A legacy file is replaced after a question, and a copy is kept: in git when committed, as `.bak` when not. |
| 3 | Dependabot | Writes `dependabot.yml` and `dependabot-automerge.yml`. A file that differs is yours and stays. |
| 4 | `package.json` | Fills what is missing, after a confirm. It never rewrites a value you chose. |
| 5 | First publish | `bun run build && npm publish --access public`, only if the package is not on npm. |
| 6 | Tag | Pushes the version tag only. Never one for a publish that did not happen. |
| 7 | Trusted publisher | `npm trust github <name> --file publish.yml --repo <owner/repo> --allow-publish --yes` |
| 8 | Branch ruleset | Creates the ruleset, or moves a legacy one to the `ci / …` checks. |
| 9 | Auto-merge | Allows auto-merge on the repository. |
| 10 | Doctor | The wizard's verdict is the same report `doctor` prints. |

`setup` fills this `package.json` contract, and `doctor` reports it:

| Field | Requirement |
|---|---|
| `scripts` | `lint`, `typecheck`, `test`, `build`, `validate`, `release:setup`, `release:doctor`, `release` |
| `publishConfig.access` | `"public"` |
| `repository.url` | Matches `git remote get-url origin`. `git@…`, `git+https://…` and `.git` compare equal. |
| `files` | Present and not empty |
| `engines.node` | `>=24`, the npm Trusted Publishing floor |

## doctor

Twelve checks, one line each, and the exact `fix:` command for every line that is not green. It runs
`git fetch --tags` first and changes nothing else. It exits 1 when a check fails. A warning does not
fail it.

| Check | Level | Looks at |
|---|---|---|
| `gh-auth` | fail | `gh --version`, then `gh auth status` |
| `npm-auth` | fail | `npm whoami` |
| `npm-version` | fail | `npm` is new enough for Trusted Publishing |
| `package-contract` | fail | Every missing script and field, by name |
| `preview-deps` | fail | No dependency range is a pkg.pr.new URL |
| `repository-url` | fail | `repository.url` against the `origin` remote |
| `workflows` | fail, warn | Both files exist (fail), are pinned to `@v1` and release on a merge (warn) |
| `npm-package` | warn | `npm view <name> version` |
| `trusted-publisher` | fail, warn | `npm trust list <name>`. An npm with no `trust` command warns. |
| `tag-sync` | warn | The newest `v*` tag against npm `latest`, with the direction of the drift |
| `branch-ruleset` | warn | An active ruleset exists and requires no legacy check names |
| `working-tree` | warn | A clean tree and `HEAD` on `origin/main`. A release treats this one as a failure. |

```sh terminal title="doctor"
$ bun run release:doctor
 * moku release  doctor
 -----------------------------------------------------------------
  ✓ gh installed and authenticated — authenticated
  ✗ npm is logged in — npm is not logged in
      fix: npm login
  ✓ no pkg.pr.new preview dependencies — every dependency comes from the registry
  – repository.url matches origin — no `origin` remote configured
  ⚠ clean tree on origin/main — working tree has uncommitted changes
      fix: commit or stash them
```

`✓` passed, `✗` failed, `⚠` warned, `–` skipped because a check could not run here.

## wait

A merge to `main` ships a patch by itself, so `wait` dispatches nothing. It answers one question: is
my commit in a version that npm serves?

:::flow
- origin/main holds HEAD
- a release tag holds HEAD
- npm serves that version
:::

| Stops when | After |
|---|---|
| `origin/main` does not hold `HEAD` | at once. Merge first. |
| No `publish.yml` run starts | two minutes |
| The run fails | at once, with the `gh run view <id> --log-failed` line |
| No tag holds the commit | twenty minutes |
| npm does not serve the version | ten more minutes |

It asks the tags, not one run. A queued run can be replaced by the run of a later merge, and then
that later version carries your commit. Use the version it prints in a consuming project, not
`latest`.

## release

```sh terminal title="a release a person asks for"
$ bun run release minor --dry-run
$ bun run release minor
```

:::steps
1. **Preflight.** `doctor` in strict mode. A dirty tree or a `HEAD` that is not `origin/main` stops the run, and nothing is dispatched.
2. **Dispatch.** `gh workflow run publish.yml -f release_type=minor --ref main`.
3. **Watch.** It follows the run and fails with it.
4. **Verify.** It asks npm for up to ten minutes, until the dist-tag moves, then prints the version, tag, npm URL and release URL.
:::

| Argument | Result | npm dist-tag |
|---|---|---|
| `patch` | Only to repeat a failed auto-release. A merge already shipped the patch. | `latest` |
| `minor` | The next minor | `latest` |
| `major` | The next major | `latest` |
| `prerelease` | An `rc` version | `next` |

## fleet

One table for every repository of the organization, read from the owner of this checkout's remote.
One GraphQL call answers the table, and one `npm view` per package adds the served version.

| Column | Shows |
|---|---|
| `repo` | The repository |
| `ci` | The state of CI on `main` |
| `release` | The state of the release of `main` |
| `tag`, `npm` | The latest tag and the version npm serves |
| `ahead` | Commits on `main` nobody released |
| `prs` | Open pull requests, with the red and the bot ones counted |
| `old pins` | `@moku-labs/*` dependencies behind the latest version |

The list after the table, `Waits for a person`, holds red CI, a failed release, unreleased commits,
npm not on the tag's version, a red PR, a green PR nobody merged. A draft is not listed.

```sh terminal title="fleet"
$ bun run release fleet
$ bun run release fleet --deps
$ bun run release fleet --markdown
```

`--deps` adds the shared toolchain with the version most repositories are on, and the runtime
dependencies that are behind npm. `--markdown` leaves private repositories out, because its output
lands on a public page. `examples/org/fleet.yml` does exactly that: in the organization's `.github`
repository it refreshes the table in `profile/README.md` every 15 minutes, with no token added.
