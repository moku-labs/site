---
title: Claude plugin
description: "A conductor in Claude Code: idea → plan → build → verify → release, on rails."
section: Get started
---

## Overview

The `moku` plugin for Claude Code takes a project from an idea to a released package or a deployed
app, and keeps leading after that. Every later feature, fix and tweak travels the same lifecycle.

You never need a command. You talk; the conductor works out where the project stands, proposes the
next step and runs it. Underneath, the rails make the critical steps impossible to skip: no code
before the project is initialized, no plugin without a plan, no "done" with red tests.

- **Talk in plain words.** The conductor drives intake, brainstorm, design, plan, build, verify,
  e2e, release and close.
- **On rails.** A source file cannot be written before the station that is allowed to write it. A
  refused write names the missing step.
- **Knowledge loads itself.** `moku-core`, `moku-plugin` and `moku-testing`, plus one pack per
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

Requirements: Bun 1.3.14 or newer, Node 24 or newer, a current Claude Code.

## Stations

After a project exists, everything you bring becomes a **change** with a size. The size picks the
route.

| Size | Sign | Route |
| --- | --- | --- |
| S | one plugin, public API unchanged | intake → build → verify → close |
| M | new plugin, or an API changes | intake → plan → build → verify → e2e → release → close |
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

## Start with Claude

Describe what you want. The conductor picks the packages.

```text prompt
Build a blog with tags and an RSS feed on @moku-labs/web
```

```text prompt
Add a D1-backed comments API with @moku-labs/worker
```

```text prompt
Make a couch quiz game: TV shows questions, phones answer
```

```text prompt
Ship this app to macOS and iOS
```
