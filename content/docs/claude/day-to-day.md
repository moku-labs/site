---
title: Day to day
description: "What you say and what happens: a fix, quick edits, a feature, new scope, two things at once."
section: Guides
order: 12
---

## You talk, it routes

You never need a station name. Say what you want, in any language. The conductor answers in yours.

| You say, roughly | It runs |
|---|---|
| "Let's discuss the idea", "what do you think" | `moku:brainstorm` |
| "Show me how it looks", "draw it" | `moku-design:design` |
| "OK, plan it and build it", "go" | `moku:plan`, then `moku:build`, each with its gate |
| "Check that everything is right" | `moku:verify` |
| "Check it in the browser", "and on a phone" | `moku-web:e2e`, `moku-game:playtest` for a game |
| "Make sprites, music, a voice" | `moku-ai:moku-ai` |
| "Where are we", "what is next" | `moku:status` |
| "Clean up after yourself" | `moku:clean` |

## Fix a bug

```text prompt
The login button does nothing on Safari. Find out why and fix it.
```

Size S when it stays in one plugin. The conductor opens the change and reproduces the bug with a failing test when
that is practical. It fixes inside the plugin and runs verify, then the closing checklist. There is
no plan, because the public API does not change.

## Make quick edits

```text prompt
Quick edits: move the logo left, make the hero title smaller, recolor the button.
```

Size Q. Each message is the next edit, made at once. `moku-rails tier` counts from the files who
makes it: a fast agent, or the builder for an edit that creates a file or touches a public surface.
Nothing is checked in between. When you say the edits are right, `verify` runs once.

## Add a feature

```text prompt
Add a dark mode toggle.
```

Size M when an API changes or a new plugin appears. The conductor proposes the design station, because
there is UI. You can say no, and it records your words. Then a delta spec, and you approve it after
you saw it. Then build, verify, e2e and release.

## Change your mind in the middle

```text prompt
Also add a language switch next to the toggle.
```

This is scope, not a continuation. The conductor runs `moku-rails scope`, the change goes back in
front of `plan`, and the new part gets a delta spec. A running builder keeps working. A message of
yours does not stop it.

## Keep an idea for later

```text prompt
Later we could add RSS. Not now.
```

It goes to the backlog with `moku-rails idea`, and the current work carries on. `/moku:status` lists
it.

## Come back after a break

```text prompt
Where are we?
```

Debts come first. A change left inside a station is named, and you choose.

```text
Last time we left the streak fix unfinished. Finish it first, or set it aside?
```

Setting it aside takes a reason: `moku-rails park <id> --reason "..."`.

## Work on two things at once

Use two git worktrees, one session in each. Nothing in one worktree stops the other: not a station
left open, not a wave marked active, not a new message. `moku-rails status` lists the other checkouts'
work under `Elsewhere`. Decisions, specs and the ledger are shared.

```sh terminal title="a second lane"
$ git worktree add ../my-app-search -b feat/search
$ cd ../my-app-search && bun install
```

When a worktree is removed, its change stays. `moku-rails adopt <id>` moves it to the checkout where
the work goes on.

## Tests

The same rules hold in every station, for the builders and for the conductor:

- **Name the bug a test catches before you write it.** No bug to name, no test.
- **Not a test:** a constant compared with its own value, what `tsc` already proves, a test of plain data.
- **Green tests are checked by breaking the code,** once per logic file. If no test fails, the hole gets closed.
- **Deleting a test takes your word,** after the conductor lists it with the reason. So does changing a coverage threshold.

When `moku-rails close` reports slow tests, the conductor names them and offers a change of its own
to speed them up. It never changes a test for speed without your yes.

## Clean up

```text prompt
Clean up after yourself.
```

`moku:clean` archives closed changes, distills a cycle into `history.md`, and removes the ephemeral
files. It keeps the durable knowledge, and it asks first. When the same agent mistake repeats, it
proposes a gate.

## Move the stack forward

```text prompt
Upgrade this project to the current Moku stack.
```

`moku:upgrade` detects what applies (TypeScript, tooling versions, `tsconfig` defaults, the engines
floor, the framework versions), shows one plan, applies it and verifies.

:::gotchas
- **A refusal is the architecture protecting itself.** The answer is the missing step, not a way around it.
- **"Just write the code" still gets the plan station,** on M and L. It is small and fast, because builders with no spec drift apart.
- **A merged package change closes after its release.** The conductor runs `bun run release wait` and reports the version.
- **To step outside the rails,** set the plugin option `rails` to `warn` or `off`. See [How it works](/docs/claude/how-it-works/#plugin-options).
:::
