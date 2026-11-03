---
title: Quick start
description: "From an empty folder to named artifacts on disk, with a cost estimate and a budget."
section: Get started
order: 2
---

## A voice line and a translation

:::steps
1. **Install.** `@moku-labs/core` and `@moku-labs/common` are peer dependencies. Keep one copy of each in the project. Node 24 or newer and Bun are supported.

   ```sh terminal title="install"
   $ mkdir my-assets && cd my-assets
   $ bun init -y
   $ bun add @moku-labs/ai @moku-labs/core @moku-labs/common
   ```

2. **Scaffold a build file.** `moku new` writes `hello.moku.yaml` and the JSON Schema that gives your editor autocomplete.

   ```sh terminal title="scaffold"
   $ bunx moku new hello
   ```

3. **Declare what should exist.** Each item names a task and its input. `provider` is optional: without it the task's default provider runs.

   ```yaml file="hello.moku.yaml"
   version: 1
   name: hello
   items:
     - id: greeting
       task: voiceover
       input:
         text: "Hello, world!"
         voice: "21m00Tcm4TlvDq8ikWAM"
     - id: greeting-es
       task: translate
       provider: openai
       input:
         text: "Hello, world!"
         targetLang: es
   ```

4. **Validate and estimate.** Neither command needs a key or spends money.

   ```sh terminal title="check"
   $ bunx moku validate
   $ bunx moku estimate
   ```

5. **Add the keys.** Export them, or put them in `.env.local` in the working directory. The shell wins over the file. These two items need `ELEVENLABS_API_KEY` and `OPENAI_API_KEY`.

6. **Run under a ceiling.** The budget gate refuses an item that would cross `--max-cost`. Ctrl-C drains to a clean pause.

   ```sh terminal title="run"
   $ bunx moku run --max-cost 1
   ```

7. **Run it again.** Finished items have an artifact key, so a second run reuses them at no cost. Change one item and only that item is billed.
:::

Files land under `out/<build name>/`, named by the item `id`: `out/hello/greeting.mp3` here.

## The same build from code

`createApp` gives you every plugin. `app.start()` opens the journal, and `app.stop()` closes it.

```ts file="run.ts" check
import { createApp } from "@moku-labs/ai";

const app = createApp({});
await app.start();

const { lines, totalUsd } = await app.runner.estimate({ files: "hello.moku.yaml" });
console.log(lines, totalUsd);

const result = await app.runner.run({ files: "hello.moku.yaml", maxCostUsd: totalUsd * 1.2 });
console.log(result.status, result.totals); // [!note] `status` is `done`, `failed`, `paused` or `budget-stopped`. It does not reject on a provider error.

await app.runner.export({ runId: result.runId, outDir: "out" }); // [!note] `moku run` exports by itself. From code you call `export`.
await app.stop();
```

## Where things are kept

| Path | What it holds |
|---|---|
| `.moku/journal.db` | The SQLite ledger: runs, items, attempts, costs, hashes. No prompts. |
| `.moku/store/` | The artifact bytes, named by their sha256. |
| `.moku/build.schema.json` | The JSON Schema `moku new` writes for the editor. |
| `out/` | Named copies of the artifacts. Safe to delete: `moku export` writes them again. |

Add `.moku/` and `out/` to `.gitignore`.

## Next

- [How it works](/docs/ai/how-it-works/): the pipeline, retries and the budget gate.
- [buildfile](/docs/ai/plugins/buildfile/): `$ref`, `$file`, `defaults` and `itemsFrom`.
- [cli](/docs/ai/plugins/cli/): every command and exit code.
