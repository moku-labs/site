import { describe, expect, it } from "vitest";
import { landingPrompts } from "../../../src/data/prompts";
import {
  type PromptFigureLike,
  type PromptRootLike,
  pickPrompts,
  swapPrompts
} from "../../../src/lib/landing-prompts";

const POOL = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];

/**
 * A seeded random (Park–Miller), so a pick can be repeated.
 *
 * @param seed - A whole number from 1.
 * @returns A function that returns numbers in `[0, 1)`.
 */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
}

/** A fake prompt figure: its copy value and its text line. */
type FakeFigure = PromptFigureLike & {
  /** The `[data-part="text"]` line, or `undefined` when the figure has none. */
  line: { textContent: string | null } | undefined;
};

/**
 * A prompt figure as `start-claude.tsx` renders it, with the server's text.
 *
 * @param text - The server-rendered prompt.
 * @param hasLine - Whether the figure has its text line.
 * @returns The figure.
 */
function figure(text: string, hasLine = true): FakeFigure {
  const line = hasLine ? { textContent: text } : undefined;
  return {
    dataset: { copy: text },
    line,
    querySelector: selectors => (selectors === '[data-part="text"]' ? line : undefined)
  };
}

/**
 * The prompts root with its figures.
 *
 * @param figures - The prompt figures.
 * @returns The root.
 */
function root(figures: FakeFigure[]): PromptRootLike {
  return {
    querySelectorAll: selectors => (selectors === 'figure[data-component="prompt"]' ? figures : [])
  };
}

describe("pickPrompts", () => {
  // Bug: the same prompt shows twice on the landing (a pick with replacement).
  it("returns count distinct prompts of the pool, also for a random stuck at an edge", () => {
    for (const random of [() => 0, () => 0.99, seeded(7)]) {
      const picked = pickPrompts(POOL, 4, random);

      expect(picked).toHaveLength(4);
      expect(new Set(picked).size).toBe(4);
      for (const prompt of picked) expect(POOL).toContain(prompt);
    }
  });

  // Bug: the browser shows the same four prompts on every visit.
  it("shows every line of the pool across visits", () => {
    const shown = new Set<string>();
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const prompt of pickPrompts(POOL, 4, seeded(seed))) shown.add(prompt);
    }

    expect([...shown].toSorted()).toEqual(POOL);
  });

  // Bug: more figures than prompts leaves holes of `undefined`.
  it("returns the whole pool, once each, when count is larger", () => {
    const picked = pickPrompts(["a", "b"], 4, seeded(3));

    expect(picked.toSorted()).toEqual(["a", "b"]);
  });
});

describe("swapPrompts", () => {
  // Bug: Copy copies the server's prompt while the swapped one is shown, or a line repeats.
  it("gives four figures four distinct pool lines, each copy value equal to its text", () => {
    const figures = landingPrompts.slice(0, 4).map(text => figure(text));

    swapPrompts(root(figures));

    const texts = figures.map(item => item.line?.textContent);
    expect(new Set(texts).size).toBe(4);
    for (const item of figures) {
      expect(landingPrompts).toContain(item.line?.textContent);
      expect(item.dataset.copy).toBe(item.line?.textContent);
    }
  });

  // Bug: the swap draws from another pool or random than the one it is given.
  it("uses the given pool and random", () => {
    const figures = [figure("old 1"), figure("old 2")];

    swapPrompts(root(figures), POOL, seeded(5));

    expect(figures.map(item => item.dataset.copy)).toEqual(pickPrompts(POOL, 2, seeded(5)));
  });

  // Bug: a figure with no text line gets a copy value it does not show.
  it("leaves a figure without a text line as it is", () => {
    const figures = [figure("old", false)];

    swapPrompts(root(figures), POOL, seeded(5));

    expect(figures[0]?.dataset.copy).toBe("old");
  });

  // Bug: with more figures than prompts, the extra figures are emptied.
  it("keeps the server's prompt in the figures a short pool cannot fill", () => {
    const figures = [figure("old 1"), figure("old 2")];

    swapPrompts(root(figures), ["new"], seeded(5));

    expect(figures.map(item => [item.line?.textContent, item.dataset.copy])).toEqual([
      ["new", "new"],
      ["old 2", "old 2"]
    ]);
  });
});
