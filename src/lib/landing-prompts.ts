/**
 * @file Which landing prompts show, and the swap that shows them: the logic the `code-block`
 * island runs on the landing's "Then ask for something" list.
 *
 * DOM-free, so it is unit tested in Node. The server renders a fixed four; in the browser
 * `swapPrompts` writes four others from the pool into the same figures, before the Copy buttons
 * are added, so each button copies the text it sits next to.
 */
import { landingPrompts } from "../data/prompts";

/** The prompt figures `start-claude.tsx` renders. */
const PROMPT_FIGURE = 'figure[data-component="prompt"]';

/** The visible line of a prompt figure. */
const PROMPT_TEXT = '[data-part="text"]';

/** The part of a prompt `<figure>` the swap writes; any DOM `HTMLElement` has it. */
export type PromptFigureLike = {
  /** The figure's `data-*` values: `copy` is what its Copy button copies. */
  readonly dataset: { copy?: string | undefined };
  /** Find a descendant: the figure's text line; `null` or `undefined` when there is none. */
  querySelector(selectors: string): { textContent: string | null } | null | undefined;
};

/** The part of the prompts root the swap reads; any DOM `Element` has it. */
export type PromptRootLike = {
  /** Find every descendant that matches: the prompt figures. */
  querySelectorAll(selectors: string): Iterable<PromptFigureLike>;
};

/**
 * Pick `count` distinct prompts at random, in random order. A pool shorter than `count` comes
 * back whole, once each.
 *
 * @param pool - The prompts to pick from.
 * @param count - How many to pick.
 * @param random - Returns a number in `[0, 1)`, like `Math.random`.
 * @returns The picked prompts.
 * @example
 * ```ts
 * pickPrompts(["a", "b", "c"], 2, () => 0); // ["a", "b"]
 * ```
 */
export function pickPrompts(
  pool: readonly string[],
  count: number,
  random: () => number
): string[] {
  const deck = [...pool];
  const picked: string[] = [];
  while (picked.length < count && deck.length > 0) {
    // `Math.min` keeps a random that returns 1 inside the deck.
    const index = Math.min(Math.floor(random() * deck.length), deck.length - 1);
    picked.push(...deck.splice(index, 1));
  }
  return picked;
}

/**
 * Show other prompts in the server-rendered figures: each figure's text line and its copy value
 * get the same new prompt. A figure without a text line keeps what it has.
 *
 * @param root - The `claude-prompts` component.
 * @param pool - The prompts to pick from; the landing pool by default.
 * @param random - Returns a number in `[0, 1)`; `Math.random` by default.
 * @example
 * ```ts
 * // In the island's onMount, before the Copy buttons are added:
 * if (ctx.el.matches('[data-component="claude-prompts"]')) swapPrompts(ctx.el);
 * ```
 */
export function swapPrompts(
  root: PromptRootLike,
  pool: readonly string[] = landingPrompts,
  random: () => number = Math.random
): void {
  const figures = [...root.querySelectorAll(PROMPT_FIGURE)];
  const picked = pickPrompts(pool, figures.length, random);

  // Write each picked prompt into its figure; skip a figure with no text line.
  for (const [index, figure] of figures.entries()) {
    const prompt = picked[index];
    const line = figure.querySelector(PROMPT_TEXT);
    if (prompt === undefined || !line) continue;
    line.textContent = prompt;
    figure.dataset.copy = prompt;
  }
}
