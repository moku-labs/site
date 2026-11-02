---
title: "@moku-labs/ai"
description: "Build system for AI assets. kill -9 is a supported workflow."
section: Get started
---

## Overview

`@moku-labs/ai` is a build system for AI-generated assets. You declare what should exist in a
`*.moku.yaml` build file. The runner drives whichever provider implements the task, checks every
dollar against a budget, and journals every state change to crash-safe SQLite. It is not an SDK
wrapper and not a job queue.

- **`kill -9` is a supported workflow.** Every run, item and attempt change is a committed write.
  Run again and it resumes where it stopped.
- **Budget-gated by construction.** One atomic transaction checks the projected spend against
  `--max-cost` before anything is billed.
- **Incremental by default.** Every item has an artifact key. A done artifact is reused for $0.

Tasks: `voiceover`, `translate`, `prompt-gen`, `image`, `video`, `music`, `sfx`, `sprite`, `asset`.
Providers: `elevenlabs`, `openai`, `codex`, `claude`, `fal`, `apimodels`, `ark`.

## Install

```sh terminal
bun add @moku-labs/ai @moku-labs/core @moku-labs/common
```

Providers read their API keys from the environment when a request runs, or from `.env.local` in
the working directory. Estimates and validation need no key.

## Quick start

Declare a build file:

```yaml file="hello.moku.yaml"
version: 1
name: hello
items:
  - task: voiceover
    input:
      text: "Hello, world!"
      voice: "21m00Tcm4TlvDq8ikWAM"
  - task: translate
    provider: openai
    input:
      text: "Hello, world!"
      targetLang: es
```

Estimate it, then run it under a budget ceiling:

```ts file="run.ts" check
import { createApp } from "@moku-labs/ai";

const app = createApp({});
await app.start();

const { totalUsd } = await app.runner.estimate({ files: "hello.moku.yaml" });
const result = await app.runner.run({ files: "hello.moku.yaml", maxCostUsd: totalUsd * 1.2 }); // [!note] The budget gate refuses an item that would cross the ceiling.

console.log(result.status, result.totals);
await app.stop();
```

Or from the shell. The package ships the `moku` bin:

```sh terminal
moku new hello        # scaffold hello.moku.yaml and its JSON Schema
moku validate         # compile every build file
moku estimate         # cost per task and provider, no key needed
moku run --max-cost 5 # run; Ctrl-C pauses, moku run resumes
```

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
