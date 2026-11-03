import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { packages } from "../../src/data/packages";
import { landingPrompts } from "../../src/data/prompts";

const documentsDirectory = path.resolve(import.meta.dirname, "..", "..", "content", "docs");

/** A ```` ```text prompt ```` fence; group 1 is the prompt. */
const PROMPT_BLOCK = /^```\w*[ \t][^\n]*\bprompt\b[^\n]*\n([\s\S]*?)^```$/gm;

/** The longest landing prompt that fits the two lines the landing reserves. */
// Two lines of the landing's prompt text: `min-block-size: 2lh` in src/components/start-claude.css.
const LANDING_MAX_LENGTH = 70;

/**
 * The prompts of one docs page.
 *
 * @param markdown - Raw Markdown of the page.
 * @returns The prompt texts, trimmed.
 */
function promptsOf(markdown: string): string[] {
  return [...markdown.matchAll(PROMPT_BLOCK)].map(block => (block[1] ?? "").trim());
}

/**
 * Every Markdown file under `content/docs` with its prompts.
 *
 * @returns The pages, named by their path from `content/docs`.
 */
async function readPagePrompts(): Promise<{ file: string; prompts: string[] }[]> {
  const entries = await readdir(documentsDirectory, { recursive: true });
  const files = entries.filter(entry => entry.endsWith(".md")).toSorted();
  return Promise.all(
    files.map(async file => ({
      file: file.split(path.sep).join("/"),
      prompts: promptsOf(await readFile(path.join(documentsDirectory, file), "utf8"))
    }))
  );
}

describe("Start-with-Claude prompts", () => {
  // Bug: a package page shows no prompt of its own, or a long list.
  it("every package index page has 3 to 4 prompts", async () => {
    const counts = await Promise.all(
      packages.map(async entry => {
        const file = path.join(documentsDirectory, entry.id, "index.md");
        return { id: entry.id, count: promptsOf(await readFile(file, "utf8")).length };
      })
    );

    expect(counts.filter(({ count }) => count < 3 || count > 4)).toEqual([]);
  });

  // Bug: pages repeat the same generic prompts, so a package page shows another package's
  // prompts, or the landing pool repeats a docs prompt.
  it("no prompt text appears on two pages or on a page and the landing", async () => {
    const places = new Map<string, string[]>();
    const sources = [...(await readPagePrompts()), { file: "landing", prompts: landingPrompts }];
    for (const { file, prompts } of sources) {
      for (const prompt of prompts) places.set(prompt, [...(places.get(prompt) ?? []), file]);
    }

    const repeated = [...places].filter(([, files]) => files.length > 1);
    expect(repeated).toEqual([]);
  });

  // Bug: a landing prompt repeats, or one wraps past the two reserved lines and the swap after
  // hydration shifts the layout.
  it("the landing pool has 12 distinct prompts of at most 70 characters", () => {
    expect(landingPrompts).toHaveLength(12);
    expect(new Set(landingPrompts).size).toBe(landingPrompts.length);
    expect(landingPrompts.filter(prompt => prompt.length > LANDING_MAX_LENGTH)).toEqual([]);
  });
});
