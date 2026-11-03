---
title: Stations
description: "The lifecycle: four sizes, four routes, and what each station takes in and leaves behind."
section: Guides
order: 10
---

## Size picks the route

After a project exists, everything you bring becomes a **change** with a size. The conductor picks the
size after a short look at the code and tells you. You can raise it. You cannot lower it below the
rails.

| Size | Sign | Route |
|---|---|---|
| Q | Quick edits you steer one by one: one or two files each, no API change | intake → tweak → verify → close |
| S | One plugin, public API unchanged | intake → build → verify → close |
| M | A new plugin, or an existing API changes | intake → design → plan → build → verify → e2e → release → close |
| L | Several plugins, a new framework, an architecture shift | intake → brainstorm → design → plan → build → verify → e2e → release → close |

`brainstorm`, `design`, `e2e` and `release` are optional, and the choice is yours. `plan` on M and L,
`build` or `tweak`, `verify` and the closing checklist are never skipped. A skip is recorded in your
words.

```sh terminal title="what the conductor runs"
$ moku-rails skip design --reason "no UI in this change"
Skipped optional station "design" for 2026-09-26-streak-midnight.
```

## The project station

| Station | Skill | Does | Leaves |
|---|---|---|---|
| init | `moku:init` | Asks the type (framework, consumer app, tools or library, game), writes tooling, skeleton and CI files. A game also gets a hello world that opens in the editor. | `.planning/moku.md`, the "initialized" marker |

Init runs once per project. Only `intake`, `brainstorm` and `design` are allowed before it: talking
and sketching.

## The change stations

| Station | Skill | Does | Writes source | Leaves |
|---|---|---|---|---|
| intake | the conductor | Records what, why and size. `moku-rails open` marks it done. | no | `.planning/changes/<id>/intake.md` |
| brainstorm | `moku:brainstorm` | Analyses the code, researches, runs a challenger pass. On request it puts the reasoning on a page you comment on. | no | `.planning/context-<name>.md` |
| design | `moku-design:design` | Rounds with you in three modes: `ui`, `api`, `architecture` | no | `.planning/design/<slug>/design-context.md` |
| plan | `moku:plan` | A delta spec for size M, a three-stage gated plan for L or a new project. A plan checker reads it at the gate. | no | Specs in `.planning/` |
| tweak | `moku:tweak` | Makes each edit you send at once, with no checks in between | yes | `.planning/changes/<id>/tweaks.md` |
| build | `moku:build` | S: a failing test, then the fix. M and L: a skeleton, then dependency-ordered waves. | yes | Code, tests, commits |
| verify | `moku:verify` | Validators in parallel, the skeptic on each finding, auto-fix up to three cycles | yes | The `verify` checklist item |
| e2e | `moku-web:e2e`, `moku-game:playtest` | Proves it in a real browser, or in a playthrough for a game | yes | Tests, baselines, reports |
| release | `moku:moku-release` | CI, versioning and publishing or deploying | no | A released version |
| close | the conductor | Runs the checklist | no | `.planning/archive/changes/<id>/outcome.md` |

### Gates

A yes given before a spec exists does not approve the spec. At the plan gate you see what will be
built in a few lines, and the conductor waits. A station that stops to ask you first records a
pause, so stopping is a hand-over and not an abandoned station.

### Build

:::steps
1. **Skeleton.** The empty structure the plugins will fill. M and L only.
2. **Waves.** Plugins in dependency order. Builders run in parallel on separate plugin folders, one writer per plugin. Complex plugins and retries go to the deep builder.
3. **Verify each claim.** `moku-verify-artifacts` checks by script that what a builder reports exists and is wired.
4. **Review.** A code reviewer reads the wave's diff for logic errors, spec deviations and security problems.
5. **Commit after each green round.**
:::

### Verify

It fans out the structure, style, quality and architecture validators, root files first, because
that is where agents most often break the framework. The skeptic tries to disprove each finding, and
drops only one a cited rule shows to be wrong. Then it fixes and verifies again, up to three cycles.
It never commits. A run that ends in `FAIL` records nothing, so the change cannot close on it.

### E2e

| Project | Station | Proves |
|---|---|---|
| Web app | `moku-web:e2e` | Every screen and control with Playwright, visual baselines, exploratory QA, and a UX gate on desktop and mobile screenshots |
| Game | `moku-game:playtest` | Headless scenarios, visual baselines, a real playthrough in the editor, an optional simulator leg |

A change with a `ui` design also has to match its approved prototype: `build` and `e2e` finish only
on a passed design check.

### Release

See [@moku-labs/ci](/docs/ci/). A merge to `main` of a package ships a patch by itself, on every
route, so also on Q and S. The change then waits for `bun run release wait` before it closes. A
minor or a major is your call, and the conductor never picks the version.

## Close

Every change closes the same way.

```sh terminal title="the closing checklist"
$ moku-rails check tests   # [!note] One green run of the test script per tree. Refused while it is red.
$ moku-rails check verify  # [!note] Verify passed for the touched scope.
$ moku-rails check docs    # [!note] Spec and README reflect the change.
$ moku-rails close
```

One green run confirms `tests` for every change closed on the same tree. The tree is the `HEAD`
commit with nothing uncommitted, so several changes that close together share one run.

The change then moves to `.planning/archive/changes/<id>/` with a short `outcome.md`. History is
annotated, never deleted.

## moku-rails

You do not need these. The conductor runs them, and they are useful to read in a transcript.

| Command | What it does |
|---|---|
| `session start --root <path>` | Puts a directory on the rails |
| `status` | The standing: changes, debts, ideas, other checkouts |
| `open <id> --size --type --title` | Opens a change |
| `enter <station>`, `done <station>` | Moves a change. Exit code 2 means refused. |
| `skip <station> --reason` | Skips an optional station |
| `continue` | Places a request as work of the current station |
| `scope "<what is new>"` | Records new scope |
| `pause --reason` | Hands the turn to you. `continue` or `enter` takes it back. |
| `park <id> --reason`, `resume <id>` | Sets a change aside, and reopens it |
| `adopt <id>` | Takes over a change whose worktree was removed |
| `check tests\|verify\|docs`, `close` | The closing checklist |
| `idea "<text>"` | Keeps an idea for later |
| `tier <files>` | Says who makes a quick edit: `fast`, or `deep` with the reason |
| `waves` | The build waves and which comes next |
| `tests` | What the pre-commit hook runs, repeated runs, slow tests |
