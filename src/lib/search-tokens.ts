/**
 * @file The one tokenizer of the search index: the build runs it over the docs, the ⌘K palette over
 * the query, so both find the same terms. Pure and browser-safe.
 */

/** Tokens shorter than this are dropped. */
const MIN_LENGTH = 2;

/** Words too common to tell two pages apart. Short domain words like `fx` and `kv` are not here. */
const STOP_WORDS: ReadonlySet<string> = new Set([
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "with"
]);

/** Runs of letters and digits, the words of a text. */
const WORD = /[\p{L}\p{N}]+/gu;

/**
 * Split a word at its camelCase humps. Capture groups, not a lookbehind: a lookbehind is a syntax
 * error in Safari before 16.4, and it would stop the whole client bundle there.
 *
 * @param word - One word, in its original case.
 * @returns The word with a space at each hump.
 */
function spaceHumps(word: string): string {
  return word
    .replaceAll(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    .replaceAll(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2");
}

/**
 * The search tokens of a text: lower case, split on anything but letters and digits. A camelCase
 * word gives itself and its parts. Tokens under 2 characters and stop words are dropped.
 *
 * @param text - Any text: a heading, a page body, code, a query.
 * @returns Each token once, in order of first appearance.
 * @example
 * ```ts
 * tokenize("The createApp call"); // ["createapp", "create", "app", "call"]
 * tokenize("fx"); // ["fx"]
 * ```
 */
export function tokenize(text: string): string[] {
  const tokens = new Set<string>();
  for (const word of text.match(WORD) ?? []) {
    tokens.add(word.toLowerCase());
    for (const part of spaceHumps(word).split(" ")) tokens.add(part.toLowerCase());
  }
  return [...tokens].filter(token => token.length >= MIN_LENGTH && !STOP_WORDS.has(token));
}
