/**
 * @file The text rules of a card: how a line is shortened and how big a title is drawn.
 */

/** The longest line a card draws, in characters: two lines of the text column. */
const LINE_LIMIT = 56;

/** The end of the first sentence: a `.` or `:` followed by a space. Dots in `a.b()` do not count. */
const FIRST_SENTENCE = /^.+?[.:](?=\s)/;

/** The shortest first sentence that may stand as a whole line: `Logic.` says nothing on a card. */
const SENTENCE_MINIMUM = 20;

/** Punctuation and spaces that must not stand in front of the ellipsis. */
const LOOSE_END = /[\s,.:;—-]+$/;

/**
 * A character the latin `.woff` files do not have, which would draw as an empty square: `→` in a
 * description. The `latin` range of `@fontsource/*` `unicode.json`, without its combining marks.
 */
const OUTSIDE_LATIN =
  /[^\s\u0020-\u00FF\u0131\u0152\u0153\u02BB\u02BC\u02C6\u02DA\u02DC\u2000-\u206F\u20AC\u2122\u2191\u2193\u2212\u2215]/u;

/** The longest title drawn at the big size, in characters. */
const BIG_TITLE_LIMIT = 12;

/** Title sizes in pixels. */
const TITLE_SIZE = { big: 96, regular: 72 } as const;

/** The longest title that stays in the regular text column, in characters. */
const REGULAR_COLUMN_LIMIT = 44;

/** Text column widths in pixels. */
const COLUMN_WIDTH = { regular: 600, wide: 930 } as const;

/**
 * Cut a text at the last word that fits, with room for the ellipsis. A character the fonts do not
 * have ends the text early.
 *
 * @param text - A text over the limit.
 * @returns The shortened text with its ellipsis.
 */
function cutAtWord(text: string): string {
  const outside = text.search(OUTSIDE_LATIN);
  const drawable = outside === -1 ? text : text.slice(0, outside);
  if (drawable.length < LINE_LIMIT) return `${drawable.replace(LOOSE_END, "")}…`;

  const head = drawable.slice(0, LINE_LIMIT);
  const lastSpace = head.lastIndexOf(" ");
  const kept = lastSpace === -1 ? head.slice(0, LINE_LIMIT - 1) : head.slice(0, lastSpace);
  return `${kept.replace(LOOSE_END, "")}…`;
}

/**
 * The line a card draws. A text of 56 characters or less stays whole. A longer one becomes its first
 * sentence, without a closing `:`, if that line has 20 to 56 characters. Otherwise it is cut at a
 * word, or before a character the fonts do not have, and gets an ellipsis.
 *
 * @param text - A tagline or a page description.
 * @returns The line.
 * @example
 * ```ts
 * cardLine("Micro-kernel plugin framework. Under 8 KB, zero dependencies."); // "Micro-kernel plugin framework."
 * ```
 */
export function cardLine(text: string): string {
  if (text.length <= LINE_LIMIT) return text;

  const sentence = FIRST_SENTENCE.exec(text)?.[0];
  if (sentence !== undefined && sentence.length <= LINE_LIMIT) {
    const line = sentence.replace(/:$/, "");
    if (line.length >= SENTENCE_MINIMUM) return line;
  }

  return cutAtWord(text);
}

/**
 * The size a title is drawn at.
 *
 * @param title - The card title.
 * @returns The font size in pixels.
 * @example
 * ```ts
 * titleSize("Docs"); // 96
 * ```
 */
export function titleSize(title: string): number {
  return title.length <= BIG_TITLE_LIMIT ? TITLE_SIZE.big : TITLE_SIZE.regular;
}

/**
 * The width of the text column: a very long title runs in front of the object.
 *
 * @param title - The card title.
 * @returns The width in pixels.
 * @example
 * ```ts
 * columnWidth("Quick start"); // 600
 * ```
 */
export function columnWidth(title: string): number {
  return title.length > REGULAR_COLUMN_LIMIT ? COLUMN_WIDTH.wide : COLUMN_WIDTH.regular;
}
