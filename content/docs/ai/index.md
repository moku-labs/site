---
title: "@moku-labs/ai"
description: "Build system for AI assets. Resumable and budget-gated."
section: Get started
---

## Overview

`@moku-labs/ai` is a build system for AI-generated assets. You declare what should exist in a
`*.moku.yaml` build file. The runner drives whichever provider implements the task, checks every
dollar against a budget, and journals every state change to crash-safe SQLite. It is not an SDK
wrapper and not a job queue.

- **Crash-safe and resumable.** Every run, item and attempt change is a committed write.
  Run again and it resumes where it stopped.
- **Budget-gated.** One atomic transaction checks the projected spend against
  `--max-cost` before anything is billed.
- **Incremental by default.** Every item has an artifact key. A finished artifact is reused at no cost.

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

Describe the assets you need. Claude writes the build file.

```text prompt
Generate a sprite sheet for a pixel-art knight from a build file with @moku-labs/ai
```

```text prompt
Add jump, coin and hit sound effects to the game's build file
```

```text prompt
Add a looping menu music track and estimate its cost before the run
```

```text prompt
Voice the tutorial lines in English and Spanish under a $5 budget
```
