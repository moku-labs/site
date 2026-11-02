import { describe, expect, it } from "vitest";
import { toAgentMarkdown } from "../../../../src/lib/markdown/agent-markdown";

const lines = (...parts: string[]): string => parts.join("\n");

describe("toAgentMarkdown: directives", () => {
  // Bug: an agent reads raw `:::callout{tone="warn"}` fences instead of a blockquote.
  it("turns a callout into a blockquote with a bold title from the tone or the label", () => {
    const warn = lines(':::callout{tone="warn"}', "Do not deep merge.", "", "Ever.", ":::");
    expect(toAgentMarkdown(warn)).toBe(
      lines("> **Warning**", ">", "> Do not deep merge.", ">", "> Ever.")
    );
    expect(toAgentMarkdown(lines(":::callout", "Plain.", ":::"))).toBe(
      lines("> **Note**", ">", "> Plain.")
    );
    expect(toAgentMarkdown(lines(':::callout[Heads up]{tone="good"}', "Nice.", ":::"))).toBe(
      lines("> **Heads up**", ">", "> Nice.")
    );
  });

  // Bug: the steps lose their order for agents, or the list of gotchas is dropped with the fence.
  it("numbers the bullets of steps and keeps the list of flow and gotchas", () => {
    const steps = lines(
      ":::steps[Install]",
      "- Add the package.",
      "  more text",
      "- Build.",
      ":::"
    );
    expect(toAgentMarkdown(steps)).toBe(
      lines("**Install**", "", "1. Add the package.", "  more text", "2. Build.")
    );
    expect(toAgentMarkdown(lines(":::gotchas", "- One.", "- Two.", ":::"))).toBe(
      lines("- One.", "- Two.")
    );
  });

  // Bug: an outer `::::` fence closes on the inner `:::`, so the rest of the page is quoted.
  it("handles a callout nested in steps", () => {
    const nested = lines(
      "::::steps",
      "- One.",
      "",
      ":::callout",
      "Careful.",
      ":::",
      "::::",
      "After."
    );
    expect(toAgentMarkdown(nested)).toBe(
      lines("1. One.", "", "> **Note**", ">", "> Careful.", "After.")
    );
  });

  // Bug: a diagram leaves an empty line or the raw `::diagram{…}` text.
  it("turns a diagram into an italic line with its caption or name", () => {
    expect(toAgentMarkdown('::diagram{name="pipeline"}')).toBe("*Diagram: pipeline*");
    expect(toAgentMarkdown('::diagram[The build]{name="pipeline"}')).toBe("*Diagram: The build*");
  });

  // Bug: a framework directive's content disappears with its fence lines.
  it("keeps the content of other directives without their fences", () => {
    expect(toAgentMarkdown(lines(":::pullquote", "Quote.", ":::"))).toBe("Quote.");
    expect(toAgentMarkdown('::embed{src="x"}')).toBe('::embed{src="x"}');
  });
});

describe("toAgentMarkdown: code fences", () => {
  // Bug: `// [!note]` comments leak into code an agent copies, or the notes are lost.
  it("drops fence meta, strips note comments and lists the notes after the block", () => {
    const code = lines(
      '```ts file="src/app.ts" hl="2"',
      "const app = createApp(); // [!note] One call.",
      "// [!note] Then start it.",
      "await app.start();",
      "```",
      "",
      "Next."
    );
    expect(toAgentMarkdown(code)).toBe(
      lines(
        "```ts",
        "const app = createApp();",
        "await app.start();",
        "```",
        "",
        "1. One call.",
        "2. Then start it.",
        "",
        "Next."
      )
    );
  });

  // Bug: directive syntax shown as an example inside a fence is converted.
  it("leaves directive lines inside a fence untouched", () => {
    const example = lines("````md", ":::callout", "x", ":::", "```", "````");
    expect(toAgentMarkdown(example)).toBe(example);
  });

  // Bug: a fence inside a callout breaks out of the blockquote.
  it("quotes a fence inside a callout", () => {
    const quoted = lines(":::callout", "```sh terminal", "$ bun run build", "", "```", ":::");
    expect(toAgentMarkdown(quoted)).toBe(
      lines("> **Note**", ">", "> ```sh", "> $ bun run build", ">", "> ```")
    );
  });

  // Bug: a fence left open at the end of a page drops its code from the agent version.
  it("closes a fence left open at the end", () => {
    expect(toAgentMarkdown(lines("```ts meta", "const a = 1;"))).toBe(
      lines("```ts", "const a = 1;", "```")
    );
  });
});
