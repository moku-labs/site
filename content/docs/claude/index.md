---
title: Claude plugin
description: "A conductor in Claude Code: idea → plan → build → verify → release, on rails."
section: Get started
---

## Overview

The `moku` plugin for Claude Code takes a project from an idea to a released package or a deployed
app, and handles every later change the same way.

You do not need to learn the commands. You talk; the conductor works out where the project stands, proposes the
next step and runs it. Underneath, the rails enforce the required steps: no code
before the project is initialized, no plugin without a plan, no "done" with red tests.

- The conductor drives intake, brainstorm, design, plan, build, verify,
  e2e, release and close.
- **On rails.** A source file cannot be written before the station that is allowed to write it. A
  refused write names the missing step.
- **Skills load automatically.** `moku-core`, `moku-plugin` and `moku-testing`, plus one pack per
  framework such as `moku-web`.

## Install

In Claude Code, add the marketplace and install the core plugin:

```sh terminal
/plugin marketplace add moku-labs/claude
/plugin install moku@moku
```

Then add the pack for each framework you use. Packs install the same way:

```sh terminal
/plugin install moku-web@moku
/plugin install moku-design@moku
```

Requirements: Bun, Node 24 or newer, a recent Claude Code release.

## Stations

After a project exists, everything you bring becomes a **change** with a size. The size picks the
route.

| Size | Sign | Route |
| --- | --- | --- |
| Q | quick edits you steer one by one, no API change | intake → tweak → verify → close |
| S | one plugin, public API unchanged | intake → build → verify → close |
| M | new plugin, or an API changes | intake → design → plan → build → verify → e2e → release → close |
| L | several plugins, a new framework, an architecture shift | intake → brainstorm → design → plan → build → verify → e2e → release → close |

:::flow
1. intake
2. plan
3. build
4. verify
5. release
:::

Brainstorm, design, e2e and release are optional. Plan, build, verify and the closing checklist
(tests green, verify passed, docs current) are not.

:::callout{tone="warn"}
The rails act only in a directory where a moku session was started. Your other projects get no
gate, no hint and no hook output.
:::

The [stations page](/docs/claude/stations/) goes through them one by one.

## Packs

| Pack | For |
| --- | --- |
| `moku-web` | `@moku-labs/web`, its validator, real-browser e2e with a UX gate |
| `moku-design` | the design station and Astra, the artist and second opinion on UX |
| `moku-worker` | `@moku-labs/worker`, the Cloudflare Workers backend |
| `moku-room` | `@moku-labs/room`, couch multiplayer |
| `moku-game` | `@moku-labs/game` and `@moku-labs/editor`, with the playtest station |
| `moku-ai` | `@moku-labs/ai`, AI asset builds with keys, providers and cost estimates |
| `moku-native` | `@moku-labs/native`, Tauri 2 desktop and mobile builds |
| `moku-system` | `@moku-labs/system`, store, notify, clipboard, tray and deep links |
| `moku-common` | `@moku-labs/common`, log, env and the branded CLI kit |

## Where to go next

| You want to | Read |
|---|---|
| Install it and start | [Quick start](/docs/claude/quick-start/) |
| Understand the conductor and the rails | [How it works](/docs/claude/how-it-works/) |
| See every station of a change | [Stations](/docs/claude/stations/) |
| Pick the packs | [Packs](/docs/claude/packs/) |
| See how it is used | [Day to day](/docs/claude/day-to-day/) |

## Start with Claude

Describe what you want. The conductor picks the packages.

```text prompt
I have an idea for a recipe app. Help me plan it.
```

```text prompt
Where does this project stand, and what is the next step?
```

```text prompt
Add a dark mode toggle and take it through verify
```

```text prompt
Which packs do I need for a couch game with a docs site?
```
