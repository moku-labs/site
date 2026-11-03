---
title: Branded CLI
description: "A terminal tool that looks like every Moku tool: the lockup, status lines, boxes, prompts and a log sink."
section: Guides
order: 10
---

## What you get

`@moku-labs/common/cli` is the terminal kit behind `moku web` and the other Moku tools. It is plain
functions, not a plugin. Import it in any Node or Bun script.

On a terminal it prints color and Unicode. In CI, in a pipe or with `NO_COLOR` set, the same code
prints plain ASCII. You write one path and never test for a TTY.

## A small tool

```ts file="scripts/doctor.ts" group="doctor" check
import { createBrandConsole, createBrandPrompts } from "@moku-labs/common/cli";

const ui = createBrandConsole();
const prompts = createBrandPrompts();

ui.lockup({ wordmark: "moku tool", label: "doctor", version: "v1", facts: `${process.platform} ${process.arch}` });

ui.heading("Checks");
const hasToken = process.env.API_TOKEN !== undefined;
ui.check(true, "config loaded");
ui.check(hasToken, "API_TOKEN is set", hasToken ? undefined : "Add it to .env.local"); // [!note] The detail prints dim and indented, under the line.

if (!hasToken) {
  ui.warn("Deploy will fail without a token."); // [!note] `warn` and `error` go to stderr.
}

const target = await prompts.select("Target?", ["Preview", "Production"]); // [!note] A zero-based index. Empty or out of range gives 0.
const go = await prompts.confirm(`Deploy to ${target === 0 ? "preview" : "production"}?`); // [!note] `true` only on `y` or `yes`.

ui.info(go ? "Deploying." : "Stopped.");
ui.box(["Local    http://localhost:4173", "Network  off"]);
```

```sh terminal title="in a pipe: plain output"
$ printf '2\ny\n' | API_TOKEN=x bun scripts/doctor.ts | cat
 * moku tool  doctor                                            v1
 -----------------------------------------------------------------
 darwin arm64

  Checks
  ✓ config loaded
  ✓ API_TOKEN is set
  1) Preview
  2) Production
Target? [1-2] Deploy to production? [y/N]   › Deploying.
+--------------------------------+
| Local    http://localhost:4173 |
| Network  off                   |
+--------------------------------+
```

## The console

`createBrandConsole(options?)` returns these. Every option is optional.

| Option | Default | Description |
|---|---|---|
| `write` | `console.log` | The sink for normal lines. |
| `writeError` | `console.error` | The sink for `warn` and `error`. |
| `color` | `supportsColor()` | Force color on or off. |
| `truecolor` | `supportsTruecolor()` | Force the exact brand pink on or off. |
| `width` | `66` | The width of the lockup rule and `railLine`. |

| Member | Output |
|---|---|
| `lockup({ wordmark, label?, version?, facts? })` | `▟▙ wordmark`, then a rule and an optional facts line. |
| `heading(text)` | A blank line and a bold pink label. |
| `info(message)` | `› message`. Later lines are indented. |
| `warn(message)` | `⚠ message`, to stderr. |
| `error(message, cause?)` | `✗ message`, and the cause under it, to stderr. |
| `check(ok, label, detail?)` | `✓` or `✗` with a label, and a dim detail under it. |
| `box(lines, minInnerWidth?)` | The lines in a frame. Pass the same width to line up several boxes. |
| `line(text?)` | A line as it is. |
| `railLine(left, right, width?)` | Returns a string with `right` aligned to the width. Ignores ANSI codes when measuring. |
| `palette`, `color`, `width` | The values this console uses. |

## The prompts

`createBrandPrompts(options?)` returns `confirm` and `select`. `color`, `truecolor` and `width` work
as above, and `input`, `output` and `write` replace the streams.

| Method | Resolves | On empty input |
|---|---|---|
| `confirm(question)` | `true` on `y` or `yes`, in any case | `false` |
| `select(question, choices)` | The zero-based index of the choice | `0` |

The prompts never check whether a human is there. With input closed, as in many CI runs, they resolve
at once with the values in the last column. Check `process.env.CI` yourself before a step that must
not run on a default.

## Route ctx.log through the brand

`brandedSink(minLevel?)` is a [log sink](/docs/common/plugins/log/). It maps each level to a brand
line and prints the data dim. Clear the default sink first, or every entry prints twice. The trace is
not touched.

```ts file="src/cli.ts" group="sink" check
import { logPlugin } from "@moku-labs/common";
import { brandedSink } from "@moku-labs/common/cli";
import { createCoreConfig } from "@moku-labs/core";

type Config = {};
type Events = {};

const coreConfig = createCoreConfig<Config, Events, [typeof logPlugin]>("my-tool", {
  config: {},
  plugins: [logPlugin]
});

const jobPlugin = coreConfig.createPlugin("job", {
  onInit: ctx => {
    ctx.log.clearSinks(); // [!note] Removes the default console sink, keeps the trace.
    ctx.log.addSink(brandedSink("info")); // [!note] `debug` stays in the trace and off the screen.
  },
  api: ctx => ({
    run: () => {
      ctx.log.debug("job:detail", { step: 1 });
      ctx.log.info("job:done", { ms: 12 });
      ctx.log.warn("job:slow");
    }
  })
});

const { createApp } = coreConfig.createCore(coreConfig, { plugins: [jobPlugin] });

createApp().job.run();
```

```sh terminal title="output, plain"
$ bun src/cli.ts | cat
  › job:done {"ms":12}
  ⚠ job:slow
```

## Build your own panel

The primitives are exported for live regions and custom rows. Tests inject a sink and turn color off,
so the output is plain strings.

```ts file="tests/panel.test.ts" check
import {
  ANSI,
  BRAND_PINK,
  box,
  CLEAR_LINE,
  createBrandConsole,
  cursorUp,
  fg24,
  makePalette,
  spinnerFrameAt,
  supportsColor,
  supportsTruecolor,
  visibleWidth
} from "@moku-labs/common/cli";
import { expect, it } from "vitest";

it("prints a row", () => {
  const lines: string[] = [];
  const ui = createBrandConsole({ write: line => lines.push(line), color: false }); // [!note] No TTY, no ANSI: exact strings to assert on.

  ui.check(true, "pages");

  expect(lines).toEqual(["  ✓ pages"]);
});

it("measures without ANSI", () => {
  const palette = makePalette(supportsColor(), supportsTruecolor());
  const pink = fg24(BRAND_PINK.r, BRAND_PINK.g, BRAND_PINK.b);

  expect(visibleWidth(`${pink}hi${ANSI.reset}`)).toBe(2);
  expect(palette.enabled).toBe(supportsColor());
  expect(box(["hi"], false)).toEqual(["+----+", "| hi |", "+----+"]);
  expect(`${cursorUp(2)}${CLEAR_LINE}${spinnerFrameAt(240)}`).toContain("⠸");
});
```

:::gotchas
- **Node and Bun only.** `/cli` imports `node:readline` and reads `process.stdout`. Never import it into a client bundle.
- **`info` and `warn` have no prefix switch.** They always print their mark. For a bare line, use `line`.
- **`brandedSink` makes its own console.** It writes to `console.log` and `console.error` with auto-detected color. It takes no sink, so test through the trace.
- **`check` does not exit.** A failed check only prints. Set `process.exitCode` yourself.
:::

## Related

- [log plugin](/docs/common/plugins/log/): sinks and the trace.
- [API reference](/docs/common/api/): every export of `/cli`.
