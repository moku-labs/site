import { describe, expect, it, vi } from "vitest";
import type { KernelError } from "../../../../lib/kernel-errors";
import { expandKernelErrors, extractHeadings, slugify } from "../../markdown";

describe("slugify", () => {
  // Bug: punctuation or double spaces produce ids the rendered heading does not have.
  it("lowercases, drops other characters, and collapses dashes", () => {
    expect(slugify("Head & SEO")).toBe("head-seo");
    expect(slugify("Build & deploy -- v2.0")).toBe("build-deploy-v20");
  });
});

describe("extractHeadings", () => {
  // Bug: two "Params" headings share one id, so the second TOC link jumps to the first.
  it("returns h2/h3 only, in order, with -2/-3 on repeated ids", () => {
    const markdown = "# Title\n## Params\n### Params\n#### Deep\n## Params\n## Next ##";
    expect(extractHeadings(markdown)).toEqual([
      { id: "params", text: "Params", depth: 2 },
      { id: "params-2", text: "Params", depth: 3 },
      { id: "params-3", text: "Params", depth: 2 },
      { id: "next", text: "Next", depth: 2 }
    ]);
  });

  // Bug: a `## comment` inside a code block shows up in the "On this page" TOC.
  it("skips lines inside backtick and tilde fences", () => {
    const markdown = "```sh\n## not a heading\n```\n~~~~\n```\n## still code\n~~~~\n## Real";
    expect(extractHeadings(markdown)).toEqual([{ id: "real", text: "Real", depth: 2 }]);
  });

  // Bug: the TOC shows raw Markdown (`backticks`, [links](...)) instead of the visible text.
  it("uses the visible text of inline code, links and emphasis", () => {
    expect(extractHeadings("## The `route()` [call](/docs/) is **_fast_**")).toEqual([
      { id: "the-route-call-is-fast", text: "The route() call is fast", depth: 2 }
    ]);
  });
});

describe("expandKernelErrors", () => {
  const errors: KernelError[] = [
    {
      id: "duplicate-name",
      when: "createApp",
      message: '[moku] Duplicate plugin name "a".\n  Rename one ($& stays).',
      hint: "Give each plugin its own name."
    }
  ];

  // Bug: the checks page ships with the raw marker instead of the kernel's real messages.
  it("replaces the marker with each error's id, phase, exact message and hint", async () => {
    const result = await expandKernelErrors(
      "## Checks\n\n<!-- kernel-errors -->\n",
      async () => errors
    );
    expect(result).not.toContain("<!-- kernel-errors -->");
    expect(result).toContain("- `duplicate-name` · checked at `createApp`");
    expect(result).toContain('  [moku] Duplicate plugin name "a".\n    Rename one ($& stays).');
    expect(result).toContain("Fix: Give each plugin its own name.");
  });

  // Bug: every page build triggers the kernel scenarios, or a page without the marker changes.
  it("leaves a page without the marker untouched and does not capture", async () => {
    const capture = vi.fn(async () => errors);
    expect(await expandKernelErrors("## Plain", capture)).toBe("## Plain");
    expect(capture).not.toHaveBeenCalled();
  });
});
