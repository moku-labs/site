/**
 * @file What the ⌘K palette lists: suggestions for an empty query, ranked matches otherwise, and
 * the part of a title to highlight.
 *
 * Pure and browser-safe; the `search-palette` island renders what these return.
 */
import type { SearchEntry } from "../plugins/search/types";

/** Results the palette shows at most. */
const RESULT_LIMIT = 8;

/** A piece of text, marked when it is the match. */
export type MarkedPart = {
  /** The text. */
  text: string;
  /** Whether this piece matched the query. */
  marked: boolean;
};

/**
 * Rank of an entry for a query: `0` title starts with it, `1` title contains it, `2` subtitle
 * contains it, `undefined` no match.
 *
 * @param entry - An index row.
 * @param query - The lower-case query.
 * @returns The rank.
 */
function rankOf(entry: SearchEntry, query: string): number | undefined {
  const title = entry.title.toLowerCase();
  if (title.startsWith(query)) return 0;
  if (title.includes(query)) return 1;
  if (entry.subtitle.toLowerCase().includes(query)) return 2;
  return undefined;
}

/**
 * The palette's results. An empty query lists the suggested entries in their order (or the
 * first entries when none of them exists); a query lists case-insensitive matches, title starts
 * first, then title hits, then subtitle hits, each group in index order.
 *
 * @param entries - The search index.
 * @param query - What the visitor typed.
 * @param suggested - Hrefs to suggest for an empty query.
 * @param limit - Most results to return.
 * @returns The results.
 * @example
 * ```ts
 * searchResults(index, "rout", []).map(entry => entry.title); // ["Routing", "router plugin", …]
 * ```
 */
export function searchResults(
  entries: readonly SearchEntry[],
  query: string,
  suggested: readonly string[],
  limit = RESULT_LIMIT
): SearchEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    const picks = suggested.flatMap(href => entries.filter(entry => entry.href === href));
    return (picks.length > 0 ? picks : entries).slice(0, limit);
  }
  const ranked: { entry: SearchEntry; rank: number }[] = [];
  for (const entry of entries) {
    const rank = rankOf(entry, needle);
    if (rank !== undefined) ranked.push({ entry, rank });
  }
  return ranked
    .toSorted((first, second) => first.rank - second.rank)
    .slice(0, limit)
    .map(result => result.entry);
}

/**
 * Split a text around the first case-insensitive match of the query.
 *
 * @param text - A title or subtitle.
 * @param query - What the visitor typed.
 * @returns The pieces in order; the whole text unmarked when nothing matches.
 * @example
 * ```ts
 * markMatch("Head & SEO", "seo"); // [{ text: "Head & ", marked: false }, { text: "SEO", marked: true }]
 * ```
 */
export function markMatch(text: string, query: string): MarkedPart[] {
  const needle = query.trim().toLowerCase();
  const start = needle === "" ? -1 : text.toLowerCase().indexOf(needle);
  if (start < 0) return [{ text, marked: false }];
  const end = start + needle.length;
  const parts: MarkedPart[] = [];
  if (start > 0) parts.push({ text: text.slice(0, start), marked: false });
  parts.push({ text: text.slice(start, end), marked: true });
  if (end < text.length) parts.push({ text: text.slice(end), marked: false });
  return parts;
}
