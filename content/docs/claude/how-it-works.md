---
title: How it works
description: "A flexible conversation on top, strict rails underneath: who decides what, and what a refusal looks like."
section: Get started
order: 3
---

## Two layers

```text file="who does what"
YOU, IN PLAIN WORDS        an idea · a feature · a bug · "what now?"
        │
CONDUCTOR (flexible)       finds the standing, proposes a step, waits for a yes
        │  moku-rails enter <station>
RAILS (strict, no model)   is this move allowed? exit 2 = refused, with the step
        │  allowed
STATIONS                   init · design · plan · tweak · build · verify · e2e ...
        │
AGENTS                     builders, validators, reviewers. Writes pass the gate.
```

The conversation bends. You pick the order, the depth and the pace. The rails do not bend, and they
are a small tested CLI with no model in them. So a required step does not depend on what a model
remembers.

## The conductor

The `moku` skill. On every message of yours it does the same thing:

:::steps
1. **Read the standing.** A hook hands it the project's state: initialized or not, open changes, debts.
2. **Place the request.** Every request is routed before code follows it.
3. **Propose one step in plain words,** and wait for a yes.
4. **Run the station through its skill.** It does not do a station's work by hand.
:::

| Your message is | Where it goes |
|---|---|
| A question, or a look at the code | Answered. Nothing opens. |
| An idea for later | Kept in the backlog: `moku-rails idea` |
| Work on a project that does not exist | A short intake, then `moku:init` |
| A fix, a feature, a refactor | A short look at the code, a size, a new change: `moku-rails open` |
| A run of small edits | A size Q change and the `tweak` station |
| "Yes, go on", applying findings, resuming | The current station: `moku-rails continue` |
| More than the plan covers | `moku-rails scope "<what is new>"`. A size M or L change goes back in front of `plan`. |

An open change inside `build` is not a free pass. "Also make it pink" during a build is new scope,
and it gets a delta spec before anyone builds it.

Debts come first. A change left unfinished, or uncommitted work no change accounts for, is settled
before new work: you finish it, or park it with a reason.

## The rails

`moku-rails` moves a change along its route and refuses a move out of order. The conductor relays the
refusal and offers the missing step.

```text file="a refusal"
Refused: Station "plan" must be done before "build".
Next step: plan
```

```text file="an optional station nobody decided on"
Refused: Station "design" is neither done nor skipped. Do it, or ask the person and record
their answer with `moku-rails skip design --reason "<their words>"`.
Next step: design
```

| Invariant | Enforced by |
|---|---|
| Hooks act only where a session was started | Every hook looks for `.planning/state.json` or `.planning/moku.md` |
| Every request is routed before code follows it | `UserPromptSubmit` marks a typed message as not routed. The write gate waits for `open`, `enter`, `continue` or `scope`. |
| No source before init | Write gate |
| No source without an open change at a writing station | Write gate. The writing stations are `tweak`, `build`, `verify` and `e2e`. |
| Stations only in a legal order | `moku-rails enter <station>`, the first action of every station skill |
| Optional stations are skipped on your word only | `enter plan`, `enter build` and `close` refuse while one is neither done nor skipped |
| A UI build matches its approved prototype | `done build` and `done e2e` refuse while the design check has open rows |
| No walking away mid-station | Stop hook, unless the station is paused for you or agents are still running |
| No close with red tests, no verify or stale docs | `moku-rails close` and its checklist |
| Every agent ends with a report | `SubagentStop` tells an agent with no report to deliver it, once |

The write gate covers shell writes too. `cat > src/... <<EOF` is refused the same way as a file
write. Anything outside the source roots passes: planning files, docs, configs. The source root is
`src/`. A game has no `src/`, so its root files and layer folders count instead.

A prompt the harness wrote is not a request. A subagent's hand-back, a task notification or a CI
event routes nothing, and a builder running in the background is never stopped by a message of yours.

## The hooks

| Event | Hook | What it does |
|---|---|---|
| `SessionStart` | `session-rails` | Tells the conductor where the project stands. Links a git worktree to the main checkout's `.planning/`. |
| `UserPromptSubmit` | `on-prompt` | Marks the message as not routed and adds the standing and the routing rule |
| `PreToolUse` on Write and Edit | `pre-write` | The write gate first, then the content checks. The first refusal wins. |
| `PreToolUse` on Bash | `pre-bash` | The same gate for files a shell command writes |
| `PreToolUse` on Bash | `verify-before-commit` | During a build wave: blocks a `git commit` while `tsc` or lint fails |
| `PostToolUse` on Write and Edit | `format-on-save` | Formats the changed file |
| `PostToolUse` on Bash | `pre-commit-review` | During a build wave: static analysis of the committed diff |
| `SubagentStart`, `SubagentStop` | `on-subagent-*` | Records running agents, asks for the report, writes the agent log |
| `SessionStart` | `detect-moku-project` | Describes the project type and state, and prints the setup tips |
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure` on Bash | `on-test-run` | Logs every test run with its tree and duration, and says when a run repeats an unchanged tree |
| `PostToolUse` on Agent | `on-agent-result` | Names an agent that came back without its report, with the one resume it gets |
| `PostToolUseFailure` on Agent | `on-agent-failure` | Names an agent that could not start, with the one retry it gets |
| `Stop` | `on-stop` | Refuses to end a turn inside a station with no pause and no running agents |
| `PreCompact`, `PostCompact` | `*compact-state` | Carry the project's state across a context compaction |

## The ledger

Everything the rails know is in `.planning/`. In a git worktree `.planning` points at a lane of the
main checkout.

| Shared by every checkout | One per worktree |
|---|---|
| The ledger `state.json`, `moku.md`, `decisions.md`, `steering.md`, `memory.md`, `learnings.md`, `app-spec.md`, `specs/`, `design/`, `memory/` | The open change, the last request, `STATE.md`, `build/`, `changes/`, brainstorm and context files, `e2e/`, the running agents |

## Models

The plugin picks a model per job, set in each skill and agent.

| Job | Model | Effort |
|---|---|---|
| Conductor, build, verify, release, the e2e orchestrator | Fable | medium |
| Brainstorm, plan, design | Fable | high |
| Plan checker, challenger, architecture validator | Fable | high |
| Builder, code reviewer, e2e tester, QA explorer, design generator | Opus | high, `xhigh` for the deep builder |
| Skeptic, which challenges the validators' findings | Opus | medium |
| Structure, style, quality and web validators, researcher, UX reviewer | Sonnet | medium |
| The tweak station and its fast agent | Sonnet | low |
| "Does it exist, is it real, is it wired" | a script, `moku-verify-artifacts` | none |

A smaller model never closes a gate. Its findings pass the skeptic, and the final call is the
orchestrator's.

## Plugin options

| Option | Values | Default | Meaning |
|---|---|---|---|
| `rails` | `strict`, `warn`, `off` | `strict` | `strict` blocks a write that skips a station, `warn` only reports it, `off` disables the write guard |
| `max_parallel_agents` | 1 to 8 | 3 | How many builder or validator agents may run at once |
