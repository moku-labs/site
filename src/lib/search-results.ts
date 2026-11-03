/**
 * @file The ⌘K query: answers from the shard's lookup tables with exact, alias, prefix and typo
 * matches, ranks by weight, and marks what matched in a title.
 *
 * Pure and browser-safe; the `search-palette` island renders what these return.
 */
import type { SearchEntry, SearchShard } from "../plugins/search/types";
import { tokenize } from "./search-tokens";

/** Results the palette shows at most. */
const RESULT_LIMIT = 8;

/** What a match is worth, multiplied by the weight of the term. */
const MATCH = { exact: 1, alias: 1, plural: 0.95, typo: 0.4 } as const;

/** A prefix match is worth this much, plus `PREFIX_CLOSENESS` times the part of the term typed. */
const PREFIX_BASE = 0.5;

/** See `PREFIX_BASE`: a closer word is worth more. */
const PREFIX_CLOSENESS = 0.4;

/** What a package, page or other row that is not a `Section` multiplies its score by. */
const PAGE_BOOST = 1.5;

/** What a row whose whole title is the query multiplies its score by. */
const WHOLE_TITLE_BOOST = 2;

/** A token this long or longer also tries terms one edit away. */
const TYPO_MIN_LENGTH = 4;

/** Entry index to its score. */
type Scores = Map<number, number>;

/** A row that matched, with what it sorts by. */
type RankedRow = {
  /** Its position in `entries`. */
  index: number;
  /** The row. */
  entry: SearchEntry;
  /** Its final score. */
  score: number;
};

/** A half-open range of a text: start and end. */
type Range = [number, number];

/** A piece of text, marked when it is the match. */
export type MarkedPart = {
  /** The text. */
  text: string;
  /** Whether this piece matched the query. */
  marked: boolean;
};

/**
 * Whether JSON from the network is a shard. A cached file of the old format is a bare array.
 *
 * @param value - The parsed response.
 * @returns `true` when it has every table.
 * @example
 * ```ts
 * isSearchShard([{ href: "/" }]); // false
 * ```
 */
export function isSearchShard(value: unknown): value is SearchShard {
  if (typeof value !== "object" || value === null) return false;
  const { entries, terms, postings, aliases } = value as Partial<SearchShard>;
  return (
    Array.isArray(entries) &&
    Array.isArray(terms) &&
    Array.isArray(postings) &&
    typeof aliases === "object"
  );
}

/**
 * The first position in the sorted terms that is not before a token.
 *
 * @param terms - The sorted terms.
 * @param token - The token.
 * @returns Its position, or `terms.length`.
 */
function lowerBound(terms: readonly string[], token: string): number {
  let low = 0;
  let high = terms.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((terms[middle] as string) < token) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * The alias targets of a token. An own key only: `constructor` is on every object.
 *
 * @param shard - The shard.
 * @param token - The token.
 * @returns Its target terms, or none.
 */
function aliasTargets(shard: SearchShard, token: string): readonly string[] {
  return Object.hasOwn(shard.aliases, token) ? (shard.aliases[token] as string[]) : [];
}

/**
 * Whether two words are one insert, delete, substitution or swap of adjacent letters apart.
 *
 * @param first - One word.
 * @param second - The other.
 * @returns `true` at distance 1 or less; the exact step runs first, so equal words do not get here.
 */
function isOneEditAway(first: string, second: string): boolean {
  const [short, long] = first.length <= second.length ? [first, second] : [second, first];
  if (long.length - short.length > 1) return false;
  let at = 0;
  while (at < short.length && short[at] === long[at]) at += 1;

  // A swap: the two letters at the first difference trade places, and the rest is equal.
  const isSwap =
    short.length === long.length &&
    short[at] === long[at + 1] &&
    short[at + 1] === long[at] &&
    short.slice(at + 2) === long.slice(at + 2);

  // One letter: skip it in the longer word, and in the shorter one too when the lengths match.
  const rest = short.length === long.length ? at + 1 : at;
  return isSwap || short.slice(rest) === long.slice(at + 1);
}

/**
 * Add a term's postings to the scores of a token, keeping the best candidate per entry.
 *
 * @param scores - The token's scores.
 * @param posting - The flat `[entryDelta, weight, ...]` of the term.
 * @param match - What this kind of match is worth.
 */
function addPosting(scores: Scores, posting: readonly number[], match: number): void {
  let entry = 0;
  for (let at = 0; at < posting.length; at += 2) {
    entry += posting[at] as number;
    const score = (posting[at + 1] as number) * match;
    if (score > (scores.get(entry) ?? 0)) scores.set(entry, score);
  }
}

/**
 * Whether the rest of a term after a word is only a plural ending.
 *
 * @param rest - The letters after the word.
 * @returns `true` for `s` and `es`.
 */
function isPluralEnding(rest: string): boolean {
  return rest === "s" || rest === "es";
}

/**
 * What a term that starts with a token is worth: exact, a plural of it, or a prefix that counts for
 * more the more of the term was typed.
 *
 * @param token - The query token.
 * @param term - A term that starts with it.
 * @returns The match value.
 */
function prefixMatch(token: string, term: string): number {
  const rest = term.slice(token.length);
  if (rest === "") return MATCH.exact;
  if (isPluralEnding(rest)) return MATCH.plural;
  return PREFIX_BASE + (PREFIX_CLOSENESS * token.length) / term.length;
}

/**
 * Score every entry a token matches: exact term, alias targets, terms with that prefix, and terms
 * one edit away when those found nothing.
 *
 * @param shard - The shard.
 * @param token - One query token.
 * @returns The entries it matches, with their scores.
 */
function scoreToken(shard: SearchShard, token: string): Scores {
  const { terms, postings } = shard;
  const scores: Scores = new Map();
  const add = (position: number, match: number): void =>
    addPosting(scores, postings[position] ?? [], match);

  // Prefix: every term that starts with the token, the exact term among them.
  for (let at = lowerBound(terms, token); terms[at]?.startsWith(token); at += 1) {
    add(at, prefixMatch(token, terms[at] as string));
  }

  // Alias: the target terms that exist.
  for (const target of aliasTargets(shard, token)) {
    const at = lowerBound(terms, target);
    if (terms[at] === target) add(at, MATCH.alias);
  }

  // Typo: only when nothing else matched and the token is long enough.
  if (scores.size > 0 || token.length < TYPO_MIN_LENGTH) return scores;
  for (const [at, term] of terms.entries()) {
    if (isOneEditAway(token, term)) add(at, MATCH.typo);
  }
  return scores;
}

/**
 * Narrow the running totals to the rows the next token also matches, and add its scores.
 *
 * @param totals - Entry index to total score so far; changed in place.
 * @param scores - The next token's scores.
 */
function keepIntersection(totals: Scores, scores: Scores): void {
  for (const [entry, total] of totals) {
    const score = scores.get(entry);
    if (score === undefined) totals.delete(entry);
    else totals.set(entry, total + score);
  }
}

/**
 * The entries that match every token, with the sum of their scores. When every token has matches
 * but no row has all of them, the rows of the rarest token: each word keeps at most 60 body
 * postings, so two words side by side in the docs can share no row, and the rarer word says more
 * about the page. A token with no match at all gives nothing.
 *
 * @param shard - The shard.
 * @param tokens - The query tokens, at least one.
 * @returns Entry index to total score.
 */
function scoreQuery(shard: SearchShard, tokens: readonly string[]): Scores {
  // The rows that match every token.
  const perToken = tokens.map(token => scoreToken(shard, token));
  const totals = new Map(perToken[0]);
  for (const scores of perToken.slice(1)) keepIntersection(totals, scores);
  if (totals.size > 0 || perToken.some(scores => scores.size === 0)) return totals;

  // No such row: the rarest token's rows, or the common word fills every place in the list.
  let rarest = perToken[0] ?? totals;
  for (const scores of perToken) if (scores.size < rarest.size) rarest = scores;
  return rarest;
}

/**
 * The tokens of a query. A query that leaves none, like `e` or `the` on the way to `theme`, is
 * looked up as it stands, so typing does not flash "Nothing matches".
 *
 * @param query - What the visitor typed.
 * @returns Its tokens or its raw lower-case text; none for an empty query.
 */
function queryTokens(query: string): string[] {
  const tokens = tokenize(query);
  if (tokens.length > 0) return tokens;
  const raw = query.trim().toLowerCase();
  return raw === "" ? [] : [raw];
}

/**
 * Whether two words are the same word, a plural folded.
 *
 * @param first - One word.
 * @param second - The other.
 * @returns `true` when they are equal or one is the other plus `s` or `es`.
 */
function isSameWord(first: string, second: string): boolean {
  const [short, long] = first.length <= second.length ? [first, second] : [second, first];
  if (!long.startsWith(short)) return false;
  const rest = long.slice(short.length);
  return rest === "" || isPluralEnding(rest);
}

/**
 * Whether a tokenized title holds these words and nothing else, plurals folded.
 *
 * @param title - The title's tokens.
 * @param words - The words to compare.
 * @returns `true` when they are the same words.
 */
function isTitleOf(title: readonly string[], words: readonly string[]): boolean {
  return (
    words.length === title.length &&
    words.every(word => title.some(titleWord => isSameWord(word, titleWord)))
  );
}

/**
 * Whether a tokenized title is the alias target of a query token.
 *
 * @param shard - The shard, for its alias table.
 * @param title - The title's tokens.
 * @param tokens - The query tokens.
 * @returns `true` when the title is one target and nothing else.
 */
function isAliasTitle(
  shard: SearchShard,
  title: readonly string[],
  tokens: readonly string[]
): boolean {
  return tokens.some(token =>
    aliasTargets(shard, token).some(target => isTitleOf(title, [target]))
  );
}

/**
 * Whether a row's whole title, tokenized, is the query tokens or an alias target of one of them.
 *
 * @param shard - The shard, for its alias table.
 * @param entry - The row.
 * @param tokens - The query tokens.
 * @returns `true` when the title holds nothing else.
 */
function isWholeTitle(shard: SearchShard, entry: SearchEntry, tokens: readonly string[]): boolean {
  const title = tokenize(entry.title);
  return isTitleOf(title, tokens) || isAliasTitle(shard, title, tokens);
}

/**
 * The final score of a row: its token scores, more for a row that is not a section and more for a
 * row whose whole title is the query.
 *
 * @param shard - The shard.
 * @param entry - The row.
 * @param score - The sum of its token scores.
 * @param tokens - The query tokens.
 * @returns The score to sort by.
 */
function rankScore(
  shard: SearchShard,
  entry: SearchEntry,
  score: number,
  tokens: readonly string[]
): number {
  const page = entry.kind === "Section" ? 1 : PAGE_BOOST;
  const whole = isWholeTitle(shard, entry, tokens) ? WHOLE_TITLE_BOOST : 1;
  return score * page * whole;
}

/**
 * What an empty query lists: the suggested entries in their order, or the first entries when none
 * of them exists.
 *
 * @param entries - The rows.
 * @param suggested - Hrefs to suggest.
 * @param limit - Most results to return.
 * @returns The rows to show.
 */
function suggestedEntries(
  entries: readonly SearchEntry[],
  suggested: readonly string[],
  limit: number
): SearchEntry[] {
  const picks = suggested.flatMap(href => entries.filter(entry => entry.href === href));
  return (picks.length > 0 ? picks : entries).slice(0, limit);
}

/**
 * The order of the results: highest score, then a package or page row before a section, then index.
 *
 * @param first - One row.
 * @param second - The other.
 * @returns A sort comparison.
 */
function compareRanked(first: RankedRow, second: RankedRow): number {
  const isSection = (row: RankedRow): number => (row.entry.kind === "Section" ? 1 : 0);
  return (
    second.score - first.score || isSection(first) - isSection(second) || first.index - second.index
  );
}

/**
 * The palette's results. An empty query lists the suggested entries in their order (or the first
 * entries when none of them exists). A query lists the entries that match all its tokens, or with
 * no such entry those of its rarest token when each token has matches: highest rank first (a row that is not a section counts 1.5 times, a row whose whole title is the query
 * twice); at equal rank a package or page row before a section, then index order.
 *
 * @param shard - The search shard.
 * @param query - What the visitor typed.
 * @param suggested - Hrefs to suggest for an empty query.
 * @param limit - Most results to return.
 * @returns The results.
 * @example
 * ```ts
 * searchResults(shard, "fx", [])[0]?.href; // "/docs/game/plugins/effects/"
 * ```
 */
export function searchResults(
  shard: SearchShard,
  query: string,
  suggested: readonly string[],
  limit = RESULT_LIMIT
): SearchEntry[] {
  const { entries } = shard;
  if (query.trim() === "") return suggestedEntries(entries, suggested, limit);

  const tokens = queryTokens(query);
  const ranked = [...scoreQuery(shard, tokens)].flatMap(([index, score]): RankedRow[] => {
    const entry = entries[index];
    return entry === undefined
      ? []
      : [{ index, entry, score: rankScore(shard, entry, score, tokens) }];
  });
  return ranked
    .toSorted(compareRanked)
    .slice(0, limit)
    .map(row => row.entry);
}

/**
 * Whether a word starts at a position: after a non-word character or at a camelCase hump. A token
 * of the index always starts there, so a mark inside a word is never the match.
 *
 * @param text - The text.
 * @param at - The position.
 * @returns `true` at a word start.
 */
function isWordStart(text: string, at: number): boolean {
  const before = text[at - 1];
  if (before === undefined || !/[\p{L}\p{N}]/u.test(before)) return true;
  const here = text[at] ?? "";
  if (!/\p{Lu}/u.test(here)) return false;
  return !/\p{Lu}/u.test(before) || /\p{Ll}/u.test(text[at + 1] ?? "");
}

/**
 * Where a term first appears as the start of a word.
 *
 * @param text - The text.
 * @param lower - The text in lower case.
 * @param term - The lower-case term.
 * @returns Its range, or `undefined`.
 */
function firstMatch(text: string, lower: string, term: string): Range | undefined {
  let at = lower.indexOf(term);
  while (at >= 0 && !isWordStart(text, at)) at = lower.indexOf(term, at + 1);
  return at < 0 ? undefined : [at, at + term.length];
}

/**
 * Merge ranges that overlap or touch.
 *
 * @param ranges - Ranges sorted by start.
 * @returns Separate ranges, in the same order.
 */
function mergeOverlaps(ranges: readonly Range[]): Range[] {
  const merged: Range[] = [];
  for (const [start, end] of ranges) {
    const last = merged.at(-1);
    if (last !== undefined && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/**
 * The ranges to mark: the first occurrence of each query token and alias target, sorted, with the
 * overlapping ranges of a camelCase query (`createapp`, `create`, `app`) merged.
 *
 * @param text - The text.
 * @param query - What the visitor typed.
 * @param shard - The shard, for its alias table.
 * @returns Separate ranges, in text order.
 */
function matchRanges(text: string, query: string, shard: SearchShard): Range[] {
  const lower = text.toLowerCase();
  const found = queryTokens(query)
    .flatMap(token => [token, ...aliasTargets(shard, token)])
    .map(term => firstMatch(text, lower, term))
    .filter(range => range !== undefined)
    .toSorted(([first], [second]) => first - second);
  return mergeOverlaps(found);
}

/**
 * Split a text around the first occurrence of each query token and of its alias targets. A typo
 * match is not in the text, so it gets no mark.
 *
 * @param text - A title or subtitle.
 * @param query - What the visitor typed.
 * @param shard - The shard, for its alias table.
 * @returns The pieces in order; the whole text unmarked when nothing matches.
 * @example
 * ```ts
 * markMatch("Effects", "fx", shard); // [{ text: "Effects", marked: true }]
 * ```
 */
export function markMatch(text: string, query: string, shard: SearchShard): MarkedPart[] {
  // Each marked range, with the unmarked text before it.
  const parts: MarkedPart[] = [];
  let cursor = 0;
  for (const [start, end] of matchRanges(text, query, shard)) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), marked: false });
    parts.push({ text: text.slice(start, end), marked: true });
    cursor = end;
  }

  // The text after the last range; the whole text when nothing matched.
  if (cursor < text.length || parts.length === 0) {
    parts.push({ text: text.slice(cursor), marked: false });
  }
  return parts;
}
