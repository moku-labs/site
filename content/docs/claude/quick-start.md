---
title: Quick start
description: "Install the plugin, add the packs you need, and talk to the conductor."
section: Get started
order: 2
---

## From install to the first change

:::steps
1. **Check the machine.** You need Bun, Node 24 or newer and a recent Claude Code release. The optional Astra integration also needs the Codex CLI, logged in.

2. **Add the marketplace and the core plugin.** These are Claude Code commands, typed in a session.

   ```sh terminal title="in Claude Code"
   /plugin marketplace add moku-labs/claude
   /plugin install moku@moku
   ```

3. **Add a pack for each framework you use.** A pack depends on the core plugin. The [packs page](/docs/claude/packs/) lists them.

   ```sh terminal title="in Claude Code"
   /plugin install moku-web@moku
   /plugin install moku-design@moku
   ```

4. **Open Claude Code in the project folder and say what you want.** A moku project gets a session in that folder, and from then on the rails act there. An empty folder works too.

   ```text prompt
   I want a small recipe site on @moku-labs/web. Let's start.
   ```

5. **Answer the conductor.** It proposes one step at a time and waits for a yes. For a new project it asks what decides the shape, then proposes to create the project. For an existing one it looks at the code, picks a size and opens a change.
:::

## What happens in a new project

:::flow
- session
- a few questions
- init
- first change, size L
- brainstorm or design
- plan
- build
- verify
:::

| Step | What it leaves |
|---|---|
| `moku:session` | `.planning/state.json`, the ledger. It scaffolds nothing. The hooks act here from now on. |
| `moku:init` | Tooling, a directory skeleton, CI files and `.planning/moku.md`, the marker that says "initialized" |
| First change | A change of type `project` on the full route |

`.planning/` is local state. It is git-ignored and never committed.

## What happens in an existing project

The same plugin works in a project that already exists, if it is a moku project. The session finds
it and does not scaffold.

```text prompt
The streak resets at midnight. Please fix it.
```

The conductor looks at the code, says this is a size S fix in one plugin, opens the change and runs
it: a failing test first, the fix, then verify and close.

## Check the setup

These two are skills. You can type them, or ask in plain words.

| Command | What it answers |
|---|---|
| `/moku:status` | Where the project stands: open and parked changes, debts, ideas, wave progress |
| `/moku:check` | Environment, tooling files, planning state, and which packs are installed against what the project uses |
| `/moku:check self-test` | Validates the plugin installation instead of the project |
| `/moku:check usage` | The plugin's context footprint |

The session-start hook also prints a tip with the `/statusline` command for a live project line in
your terminal.

:::gotchas
- **Your other projects are left alone.** The hooks act only where a session was started. Elsewhere there is no gate, no hint and no output, whatever `package.json` names.
- **A worktree needs its own install.** The first session in a git worktree links it to the project, but it has no `node_modules`. Run `bun install` there first.
- **You never need a command.** Every skill is reachable by name for people who like commands, and it travels the same rails.
:::
