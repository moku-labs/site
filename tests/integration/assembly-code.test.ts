import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Goal } from "../../src/data/assembly";
import { goals } from "../../src/data/assembly";
import type { AssemblyState } from "../../src/lib/assembly";
import { addPiece, codeLines, initialAssembly } from "../../src/lib/assembly";
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

/**
 * Every code card a goal can show on the way to its final code: the start and each state any add
 * order passes through, one `check` block per distinct code.
 *
 * @param goal - The goal.
 * @returns The page to check.
 */
function heroStatesPage(goal: Goal): SnippetSource {
  const versions = { core: "1", common: "1", web: "1", worker: "1", game: "1" };
  const cards = new Set<string>();

  // Walk every add order from one state: record its code, then add each piece not yet tried.
  const walk = (state: AssemblyState, tried: readonly string[]): void => {
    cards.add(
      codeLines(goal, state)
        .map(line => line.text)
        .join("\n")
    );
    for (const piece of goal.pieces.filter(entry => !tried.includes(entry.id))) {
      walk(addPiece(goal, state, piece.id).state, [...tried, piece.id]);
    }
  };
  walk(initialAssembly(goal, versions), []);

  return {
    file: `content/docs/assembly-${goal.id}/states.md`,
    markdown: [...cards].map(code => ["```ts check", code, "```", ""].join("\n")).join("\n")
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

  // Bug: a code card on the way to the finished code does not compile (a dangling import, a spread
  // of nothing, an empty call the framework refuses), though the finished code does.
  it("compiles every code card the hero shows on the way", async () => {
    const failures = await checkSnippets(
      goals.map(goal => heroStatesPage(goal)),
      repository
    );

    expect(failures).toEqual([]);
  }, 120_000);
});
