---
title: Packs
description: "One core plugin, one pack per framework: what each pack adds and which you need."
section: Guides
order: 11
---

## The core and the packs

`moku` is the core: the conductor, the lifecycle skills, the vendored Moku Core specification, the
agents, the rails and the hooks. A pack teaches one framework. Packs depend on the core, and the core
never names a pack.

```sh terminal title="in Claude Code"
/plugin install moku-web@moku
```

Skills load by themselves when the topic comes up. You do not call them.

## Which packs you need

| You are building | Install |
|---|---|
| A site or an app on `@moku-labs/web` | `moku-web`, and `moku-design` for the design station |
| A backend on `@moku-labs/worker` | `moku-worker` |
| Couch multiplayer on `@moku-labs/room` | `moku-room` |
| A 2D game | `moku-game`. Add `moku-ai` for art and sound, `moku-native` for the stores. |
| A desktop or mobile app | `moku-native`, `moku-system` |
| Any project that uses `logPlugin`, `envPlugin` or the CLI kit | `moku-common` |
| A framework on `@moku-labs/core` | The core alone |

`/moku:check` compares what is installed with what the project actually uses.

## What each pack adds

| Pack | Skills | Agents | For |
|---|---|---|---|
| `moku-web` | `moku-web`, `e2e` | validator, e2e tester, QA explorer, UX reviewer | `@moku-labs/web`: islands, scoped CSS and tokens, real-browser e2e with a UX gate |
| `moku-design` | `design`, `moku-astra` | design generator | The design station in three modes, and Astra |
| `moku-worker` | `moku-worker` | | `@moku-labs/worker`: Durable Objects, Queues, R2, D1 and KV |
| `moku-room` | `moku-room` | | `@moku-labs/room`: a shared screen and phones, WebRTC state sync, QR join |
| `moku-game` | `moku-game`, `playtest` | validator | `@moku-labs/game` and `@moku-labs/editor`, the playtest station, device builds |
| `moku-ai` | `moku-ai` | | `@moku-labs/ai`: asset builds with keys, providers, cost estimates and a budget gate |
| `moku-native` | `moku-native` | | `@moku-labs/native`: Tauri 2 desktop and mobile packaging |
| `moku-system` | `moku-system` | | `@moku-labs/system`: store, notify, clipboard, tray and deep links |
| `moku-common` | `moku-common` | | `@moku-labs/common`: log, env, providers per runtime, the branded CLI kit |

## What the core holds

| Kind | Names |
|---|---|
| Lifecycle skills | `moku`, `session`, `init`, `brainstorm`, `plan`, `tweak`, `build`, `verify`, `moku-release`, `status`, `check`, `clean`, `upgrade` |
| Knowledge skills | `moku-core`, `moku-plugin`, `moku-common-conventions`, `moku-testing`, `moku-readable-code`, `moku-readme` |
| Build agents | `moku-builder`, `moku-builder-deep`, `moku-tweaker`, `moku-error-diagnostician`, `moku-error-diagnostician-deep` |
| Check agents | `moku-structure-validator`, `moku-style-validator`, `moku-quality-validator`, `moku-architecture-validator`, `moku-code-reviewer`, `moku-skeptic`, `moku-plan-checker` |
| Thinking agents | `brainstorm-challenger`, `moku-researcher` |
| Tools | `moku-rails`, `moku-verify-artifacts` |

## Astra

With `moku-design` and the Codex CLI, GPT-6 Astra is the artist for image assets and a second opinion
on user experience, at two gates: after a design round, and after functional e2e is green.

- She advises. Her findings go through a triage, and each rejection is written down with its reason.
- She never reviews code. That stays with the code reviewer and the validators.
- When she is unavailable, the gate still runs without her.

## A missing pack

A skill from a pack that is not installed is not a dead end. The conductor says which pack is missing
and offers to continue without that optional station. A game is the exception: it cannot be planned
or built without `moku-game`, so the conductor asks you to install it.

## Two more plugins

Both are in the marketplace and disabled by default.

| Plugin | What it is |
|---|---|
| `moku-deck` | A reply bar and a side pane in Claude Code: one-press answers, the route of the open change, parked ideas, the test log. It uses an early-access API that may change. |
| `moku-maintainer` | Re-vendors the spec and syncs framework knowledge. It is for the plugin's own repository. |

## A new pack

A new framework gets a pack from `docs/pack-template` in
[moku-labs/claude](https://github.com/moku-labs/claude), without touching the core.

```text file="plugins/moku-<key>/"
.claude-plugin/plugin.json          name moku-<key>, dependencies ["moku"]
skills/moku-<key>/SKILL.md          the framework skill
skills/moku-<key>/references/       plugin-index.md and anything else one level deep
agents/<key>-validator.md           optional
```
