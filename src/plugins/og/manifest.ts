/**
 * @file The manifest: which input each committed card was drawn from, and what a run has to do.
 */
import { createHash } from "node:crypto";
import { OG_LAYOUT_VERSION } from "./layout";
import type { OgCard, OgManifest, OgPlan } from "./types";

/**
 * The hash of what a card draws: all text, the version, the art ids and the layout version. Where
 * the card is written is not part of it.
 *
 * @param card - The card.
 * @param layoutVersion - The layout version; defaults to the current one.
 * @returns The sha256 in hex.
 * @example
 * ```ts
 * const card = { path: "/", file: "home.png", title: "Moku", meta: undefined, line: "", object: { kind: "cluster" } } as const;
 * cardHash(card).length; // 64
 * ```
 */
export function cardHash(card: OgCard, layoutVersion: number = OG_LAYOUT_VERSION): string {
  const { title, meta, line, object } = card;
  const input = JSON.stringify({ layoutVersion, title, meta, line, object });
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Decide what a run does: draw a card with a changed input or no file, keep the others, and delete
 * the PNG files no card owns.
 *
 * @param cards - Every card of the site.
 * @param manifest - The hashes of the last run.
 * @param files - The PNG files in the card folder, relative to it.
 * @returns The plan.
 * @example
 * ```ts
 * planCards([], {}, new Set(["docs/gone.png"])).orphans; // ["docs/gone.png"]
 * ```
 */
export function planCards(
  cards: readonly OgCard[],
  manifest: Readonly<OgManifest>,
  files: ReadonlySet<string>
): OgPlan {
  const plan: OgPlan = { draw: [], keep: [], orphans: [] };
  for (const card of cards) {
    const current = files.has(card.file) && manifest[card.file] === cardHash(card);
    (current ? plan.keep : plan.draw).push(card);
  }
  const owned = new Set(cards.map(card => card.file));
  plan.orphans = [...files].filter(file => !owned.has(file)).toSorted();
  return plan;
}

/**
 * The manifest file of a list of cards. Keys are sorted, so adding one page adds one line to the diff.
 *
 * @param cards - Every card of the site.
 * @returns The JSON text with a closing newline.
 * @example
 * ```ts
 * renderManifest([]); // "{}\n"
 * ```
 */
export function renderManifest(cards: readonly OgCard[]): string {
  const entries = cards
    .map(card => [card.file, cardHash(card)] as const)
    .toSorted(([first], [second]) => first.localeCompare(second));
  return `${JSON.stringify(Object.fromEntries(entries), undefined, 2)}\n`;
}
