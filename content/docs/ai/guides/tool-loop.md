---
title: Tool loop
description: "runToolLoop: a journaled tool-calling conversation over app.promptGen, with a budget, a step journal and a prompt cache."
section: Guides
order: 54
---

## What it is

`runToolLoop(options)` runs a tool-calling conversation to its end. The model answers, calls
tools, reads their results, and answers again, until a turn has no tool calls or a limit stops
the loop. It is a library function exported from `@moku-labs/ai`, not a plugin.

It calls only `options.generate`, so it works with any prompt-gen provider that serves
`messages` and `tools`. Today that is `fal` and `anthropic`. `openai`, `codex` and `claude`
refuse those fields with `PromptGenUnavailableError` `"unsupported"`, so the loop does not run on
them.

The loop keeps no state of its own. Every model call and every tool call is one step of the
caller's journal, `options.step(key, work)`. The journal runs `work` once per key and returns the
stored value on a replay. A restart with the same journal replays every finished step: no model
call and no tool runs twice.

:::flow
- `model:1`
- `tool:<callId>` per call
- history grows
- `model:2`
- stop: done, budget, steps, cancel, asked
:::

:::steps
1. `step("model:1", ...)` sends the system text, the messages and the tools. The answer is stored.
2. For each tool call of the answer, `step("tool:<callId>", ...)` checks the input with the tool's zod schema, runs the tool and stores its output.
3. The assistant turn and the tool results join the history.
4. Back to step 1 with `model:2`, until a turn has no tool calls, or the budget, `maxSteps`, the signal or an `ask` stops the loop.
:::

## Messages

A `PromptGenRequest` with `messages` is a multi-turn request. `prompt` is ignored then and may be
`""`. The turns come after the system text:

| Role | Shape | Who writes it |
|---|---|---|
| `user` | `{ role: "user"; content: string \| ContentPart[] }` | The caller. |
| `assistant` | `{ role: "assistant"; content: string \| null; toolCalls?: ToolCall[] }` | The loop, from each model answer. |
| `tool` | `{ role: "tool"; toolCallId: string; content: string \| ContentPart[] }` | The loop, from each tool output. The caller, to answer an `ask`. |

A `ContentPart` is text or an image: `{ type: "text"; text; cache?: true }` or
`{ type: "image"; path; mimeType; hash }`. So a tool result can show the model a picture.

`options.messages` is the conversation so far. The loop never changes it. `result.messages` is
the given messages, then every turn of this run.

## Tools

The model sees a `ToolDefinition`: `{ name, description, inputSchema }`. The caller writes a
`ToolSpec`, and the loop makes the definition from it. `inputSchema` is
`z.toJSONSchema(schema, { io: "input" })` without the `$schema` key.

| `ToolSpec` field | Meaning |
|---|---|
| `name`, `description` | What the model sees. |
| `schema` | A zod schema. It checks the model's input and becomes the JSON schema in the request. |
| `estimateUsd(input)` | Optional cost estimate for the budget check. Absent means 0 and no check. |
| `run(input, signal)` | Runs the tool. Returns a `ToolOutput`. |
| `start(input, signal)` | Optional first half: starts outside work, returns a JSON-safe `{ started, rows? }`. |
| `wait(started, signal)` | Optional second half: waits for the started work, returns a `ToolOutput`. |

| `ToolOutput` field | Meaning |
|---|---|
| `value` | The tool's own result, for the caller. The model never sees it. |
| `content` | `ContentPart[]` the model reads. Images are allowed. `[]` is sent as `"(no output)"`. |
| `costUsd` | Cost of the call. Counts toward the budget. |
| `rows` | Optional ids of outside work the tool started. Opaque to the loop. |

When a tool has both `start` and `wait`, the loop uses them and not `run`. A restart after
`start` only waits, so the outside work never starts twice.

The loop answers some calls itself, with one text step at cost 0:

| Call | Tool result |
|---|---|
| Unknown tool name | `Unknown tool "<name>".` |
| Input fails the zod schema | `Invalid input for <name>: <z.prettifyError>`. The model may retry. |

A tool that throws ends the loop with that error. A `generate` error works the same way. When the
signal is aborted at that point, the loop returns `stoppedBy: "cancel"` instead.

### `ask`

Define a tool named `"ask"` to let the model ask the person. A checked `ask` call is never run.
The other calls of the turn run first, then the loop stops with `stoppedBy: "asked"` and
`asked: { input }`. The `ask` call stays open in `messages`. The caller appends the answer as
`{ role: "tool", toolCallId, content }` and runs the loop again. Only the first `ask` of a turn
waits for the person; a second one gets the tool result `Ask one question at a time.`.

## Options

| Option | Type | Meaning |
|---|---|---|
| `generate` | `(request, signal) => Promise<PromptGenResult>` | One model call. Usually `app.promptGen.generate` with a provider that serves tools. |
| `model` | `string` | Model id sent with every call. |
| `reasoning` | `"off" \| "low" \| "medium" \| "high"` | Sent as `params.reasoning` when set. |
| `system` | `string` | System text of every call. |
| `messages` | `ChatMessage[]` | The conversation so far. Never changed. |
| `tools` | `readonly ToolSpec[]` | Tools the model may call. |
| `budget.usd` | `number` | The limit in USD. |
| `budget.spentUsd` | `number` | Spend before this run. Default 0. |
| `budget.finishAt` | `number` | Fraction of `usd`, 0 to 1, where finish mode starts. |
| `budget.spent` | `() => Promise<number>` | Spend outside the loop's steps. Read at every check. |
| `maxSteps` | `number` | Most model calls, replayed ones included. |
| `step` | `<T>(key, work) => Promise<T>` | The caller's journal. |
| `onStep` | `(event: LoopEvent) => void` | Called with every event. |
| `finishNote` | `string` | User text added once, before the first model call made in finish mode. |
| `keepImages` | `number` | Assistant turns whose tool-result images stay in the request. Default 2. |
| `cache` | `"system" \| "conversation" \| "off"` | What the loop marks for the prompt cache. Default `"conversation"`. |
| `signal` | `AbortSignal` | Cancels the loop. |

Each model call sends `{ prompt: "", system, model, messages, tools, cacheSystem: true }`, plus
`params: { reasoning }` when `reasoning` is set. The loop does not set `cacheTtl`: its steps
start seconds apart.

## Step keys

| Key | Value stored | Cost |
|---|---|---|
| `model:<n>` | `{ result, finish? }`: the `PromptGenResult`, and `finish: { spentUsd }` when finish mode started before this call | `result.costUsd` |
| `tool:<callId>` | the `ToolOutput`, or the loop's own text answer | `output.costUsd`, or 0 |
| `tool:<callId>:start` | `{ started, rows }` | 0 |
| `tool:<callId>:wait` | the `ToolOutput` | `output.costUsd` |

`<n>` is the 1-based model call of this run. Every stored value carries its cost, so a replay
rebuilds `spentUsd`. The journal passes a signal to `work`; the tool or `generate` gets that
signal.

`work` may throw: the loop's own budget stop, or a model or tool error. The journal must not
store a work that throws, and must pass its error on unchanged.

## Budget

`spent` = `budget.spentUsd` + the cost of every step, replayed ones too + `await budget.spent()`.

| Check | When | Effect |
|---|---|---|
| `spent >= usd` | Before a model call | Stops with `stoppedBy: "budget"`. |
| `spent + estimateUsd(input) > usd` | Before a tool with `estimateUsd` | Stops with `stoppedBy: "budget"`. The tool does not run. |
| `spent >= finishAt * usd` | Before a model call, once | Finish mode starts. With `finishNote`, the note is the last message of that call. |

Every check runs inside the step it guards. A replayed step is never checked again, even when
`budget.spent()` has grown since. So a crash after a paid `start` replays and waits.

A `"budget"`, `"steps"` or `"cancel"` stop answers every open call of the last assistant turn
with `Not run: <reason>.`, so `result.messages` is a valid history to resume from.

## Result

| Field | Meaning |
|---|---|
| `stoppedBy` | `"done"`: a model turn had no tool calls. `"budget"`: the budget check. `"steps"`: `maxSteps` model calls already ran. `"cancel"`: the signal was aborted. `"asked"`: the model called `ask`. |
| `spentUsd` | Spend at the stop: `budget.spentUsd` + step costs + `budget.spent()`. |
| `steps` | Model calls made, replayed ones included. |
| `messages` | The given messages, then every turn of this run. Never carries the loop's cache marks. |
| `finalText` | The last model text. `null` when it was empty or no model call ran. |
| `asked` | `{ input }` of the `ask` call. Set only for `"asked"`. |

Loop events, through `onStep`:

| `kind` | Fields | When |
|---|---|---|
| `"model"` | `step`, `text`, `toolCalls`, `costUsd`, `usage` | After each model step, replayed ones too. |
| `"tool"` | `step`, `name`, `callId`, `costUsd`, `summary`, `rows` | After each answered call. A start/wait tool emits one, after `wait`. |
| `"budget"` | `spentUsd`, `limitUsd`, `mode` | `"finish"` once, just before the `model` event of the first call in finish mode. `"stop"` when the budget stops the loop. |

## Example

A free tool shows the model a frame. An `ask` tool lets it ask the person. The journal is a
`Map`, which lives in memory only. Keep it on disk to survive a crash.

```ts file="review.ts" check
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { runToolLoop } from "@moku-labs/ai";
import type { PromptGen } from "@moku-labs/ai";
import { app } from "./app";

await app.start();

const readFrame: PromptGen.ToolSpec<{ shot: number }> = {
  name: "read_frame",
  description: "Return the first frame of a storyboard shot as an image.",
  schema: z.object({ shot: z.number().int().min(1) }),
  run: async ({ shot }) => {
    const path = `frames/s${shot}.png`;
    const hash = createHash("sha256").update(await readFile(path)).digest("hex");
    return {
      value: { shot, path },
      content: [
        { type: "text", text: `First frame of shot ${shot}.` },
        { type: "image", path, mimeType: "image/png", hash }
      ],
      costUsd: 0
    };
  }
};

const askPerson: PromptGen.ToolSpec<{ question: string }> = {
  name: "ask",
  description: "Ask the person a question the frames cannot answer.",
  schema: z.object({ question: z.string() }),
  run: async () => {
    throw new Error("ask is never run"); // [!note] The loop stops with stoppedBy "asked" before run.
  }
};

const journal = new Map<string, unknown>();
const controller = new AbortController();
async function step<T>(
  key: string,
  work: (signal: AbortSignal) => Promise<{ value: T; costUsd: number }>
): Promise<T> {
  if (journal.has(key)) return journal.get(key) as T;
  const { value } = await work(controller.signal);
  journal.set(key, value);
  return value;
}

const options: PromptGen.RunToolLoopOptions = {
  generate: (request, signal) => app.promptGen.generate(request, { signal, provider: "fal" }),
  model: "anthropic/claude-opus-5.5",
  system: "You review storyboard frames. Read the frames you need, then answer in one paragraph.",
  messages: [{ role: "user", content: "Is the subject framed the same way in shots 1 and 2?" }],
  tools: [readFrame, askPerson],
  budget: { usd: 0.5, finishAt: 0.8 },
  maxSteps: 10,
  step,
  finishNote: "The budget is nearly spent. Answer with what you have.",
  onStep: event => {
    if (event.kind === "tool") console.log(`turn ${event.step}: ${event.name}: ${event.summary}`);
  },
  signal: controller.signal
};

const result = await runToolLoop(options);
console.log(result.stoppedBy, result.finalText, result.spentUsd);

// Continue after an ask, under a new key prefix.
const lastTurn = result.messages.findLast(message => message.role === "assistant");
const askCallId =
  lastTurn?.role === "assistant" ? lastTurn.toolCalls?.find(call => call.name === "ask")?.id : undefined;
if (result.stoppedBy === "asked" && askCallId !== undefined) {
  const messages: PromptGen.ChatMessage[] = [
    ...result.messages,
    { role: "tool", toolCallId: askCallId, content: "Take 2." }
  ];
  const resumed = await runToolLoop({
    ...options,
    messages,
    budget: { ...options.budget, spentUsd: result.spentUsd },
    step: (key, work) => step(`resume-1/${key}`, work)
  });
  console.log(resumed.finalText);
}

await app.stop();
```

:::gotchas
- **A crash restart uses the same journal keys.** Run `runToolLoop` again with the same options and the same journal: finished steps replay, the rest runs.
- **A continued conversation needs a new key space.** Keys start again at `model:1` on every call. After an `ask` or a stop, give the next run a new key prefix. Otherwise `model:1` replays the first run's answer.
- **`result.spentUsd` already includes `budget.spent()`.** Pass it on as `budget.spentUsd`, and let `spent()` count only spend that is new since then.
- **Call ids must be unique across turns.** The tool keys use only the call id. A provider that reuses an id would replay the earlier tool result.
- **`estimate` has no fallback.** Estimate a tool request with the provider that serves tools.
:::

## Prompt cache

A provider with a prompt cache stores the start of a request. A later request that starts with
the same content reads that part from the cache. A cache mark, also called a breakpoint, says
where the stored part ends. `cache` chooses what the loop marks.

| `cache` | The loop marks | The request |
|---|---|---|
| `"conversation"` | The system text, and the conversation up to its newest stable message. The default. | `cacheSystem: true`, and `cache: true` on one or two text parts of `messages`. |
| `"system"` | The system text only. | `cacheSystem: true`. No part is marked. |
| `"off"` | Nothing. | No `cacheSystem` key. No part is marked. |

A `cache: true` part that the caller set is sent as it is, in every mode.

What a mark covers:

- **The system mark** covers the tools and the system text. They are the same in every step.
- **A conversation mark** covers everything before it: the tools, the system text, and the messages up to the marked one.
- **The marked message** is the newest stable message that is a user message or a tool message with text. The mark goes on its last text part that is not blank. An assistant message is never marked.
- **Two rolling marks.** One is the mark of this request. The other is the mark of the request before, at the same place. The second lets the provider read the entry the step before wrote. The first writes the entry the next step reads.
- **The marks are on the request only.** The loop sets them on copies. `options.messages` and `result.messages` never carry them.

A request carries at most 4 breakpoints. The system mark takes one. The caller's marks are never
removed. The rolling marks take what is left, and the older one is dropped first.

| Caller marks in `messages` | System mark | Rolling marks |
|---|---|---|
| 0 or 1 | yes | 2 |
| 2 | yes | 1, the newest |
| 3 | yes | none |
| 4 or more | no | none |

### Images

`keepImages` replaces the images of tool results older than the last N assistant turns with the
text `[image dropped: <name>]`. Only the request changes; `result.messages` keeps every image.
The replaced form is fixed, so every later step sends the same text and it can be cached. A tool
message whose images can still be dropped in this run is not stable, so it is sent after the
mark. The last `keepImages` image turns are not cached.

`keepImages: 0` replaces every tool image in every request. A value of `maxSteps` or more never
replaces an image of a new conversation. Both make every message cacheable.

The image bytes must be the same file in every step. After a process restart the images still in
the request get new upload URLs on `fal`, so a cached part with such an image misses the cache
once, on that step.

### Resume

The marks are a pure function of the history and the options: `messages`, `keepImages`, `cache`
and `maxSteps`. The loop keeps no cache state. A resumed run sends the same request for the same
step as the first run did.

### Providers

| Provider | What happens to the marks |
|---|---|
| `fal` | A marked text part is sent with `cache_control: { type: "ephemeral" }`. Model families other than Anthropic ignore the marks. |
| `anthropic` | `cacheSystem` becomes `cache_control` on the system text. `cacheTtl: "1h"` goes on every mark. |
| `claude`, `codex`, `openai` | They refuse `messages` and `tools`, so the loop does not run on them. |

:::callout{tone="warn"}
One case is not confirmed live. `fal` accepts open request bodies, but its pass-through of
`cache_control` on the parts of a `tool` message has not been checked against the live service.
:::

`usage.cachedReadTokens` and `usage.cachedWriteTokens` are set when the provider reports them.
`cachedTokens` and `cacheWriteTokens` are 0 when unknown. `costUsd` is the provider's reported
cost when the answer has one. The token-count fallback has no cache rates in the price table: it
prices cached tokens as normal input.

## Related

- [promptGen](/docs/ai/plugins/prompt-gen/): the facade the loop calls, and the provider fallback chain.
- [fal](/docs/ai/plugins/fal/), [anthropic](/docs/ai/plugins/anthropic/): the providers that serve tools.
