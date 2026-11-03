import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Goal } from "../../src/data/assembly";
import { goals } from "../../src/data/assembly";
import type { SnippetSource } from "../../src/lib/snippets";
import { checkSnippets } from "../../src/lib/snippets";

const repository = path.resolve(import.meta.dirname, "..", "..");

/**
 * The final code of a goal as one `check` block of a page of its own. The page's folder,
 * `assembly-<goal>`, picks the `./plugins` stub of `content/snippet-stubs/assembly-<goal>/`, so the
 * docs' own stubs stay untouched.
 *
 * @param goal - The goal.
 * @returns The page to check.
 */
function heroPage(goal: Goal): SnippetSource {
  return {
    file: `content/docs/assembly-${goal.id}/hero.md`,
    markdown: ["```ts check", ...goal.finalCode, "```", ""].join("\n")
  };
}

describe("the hero's assembly code", () => {
  // Bug: a package release renames or drops an export the finished code shows (contentPlugin,
  // d1Plugin, screen, defineFeature …), and the hero teaches code that no longer compiles.
  it("compiles the finished Site, App and Game code against the installed packages", async () => {
    const failures = await checkSnippets(
      goals.map(goal => heroPage(goal)),
      repository
    );

    expect(failures).toEqual([]);
  }, 120_000);
});
