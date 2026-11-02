/**
 * @file The state maths of the ⌘K search palette: its props, the status line, the arrow-key
 * selection, the Tab ring and the shortcut. Pure; the `search-palette` island owns the DOM.
 */

/** What the palette hands the island through `data-props`. */
export type PaletteData = {
  /** Base URL of the collection files. */
  baseUrl: string;
  /** Collection name. */
  collection: string;
  /** Shard name. */
  shard: string;
  /** Hrefs suggested for an empty query. */
  suggested: readonly string[];
};

/** What the status line is about: the index's load state and the results of the query. */
export type PaletteStatus = {
  /** The index failed to load. */
  failed: boolean;
  /** The index has loaded. */
  loaded: boolean;
  /** Results on screen. */
  resultCount: number;
  /** The query as typed. */
  query: string;
};

/** The keys of a keydown that can open the palette. */
export type ShortcutKeys = {
  /** `KeyboardEvent.key`. */
  key: string;
  /** ⌘ is held. */
  metaKey: boolean;
  /** Ctrl is held. */
  ctrlKey: boolean;
};

/** The props when the palette has none: the default search shard and no suggestions. */
export const DEFAULT_PALETTE_DATA: PaletteData = {
  baseUrl: "/",
  collection: "search",
  shard: "en",
  suggested: []
};

/** Prefix of the result option ids, for `aria-activedescendant`. */
export const OPTION_ID = "search-option-";

/** Width and height of a result's package art, in px. */
export const ICON_SIZE = 34;

/**
 * Parse the palette's `data-props`; missing fields keep their defaults.
 *
 * @param json - The attribute's text; `undefined` when the palette has none.
 * @returns The props.
 * @example
 * ```ts
 * parsePaletteData('{"shard":"de"}'); // { baseUrl: "/", collection: "search", shard: "de", suggested: [] }
 * parsePaletteData("not json"); // DEFAULT_PALETTE_DATA
 * ```
 */
export function parsePaletteData(json: string | undefined): PaletteData {
  if (json === undefined) return DEFAULT_PALETTE_DATA;
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_PALETTE_DATA;
    return { ...DEFAULT_PALETTE_DATA, ...(parsed as Partial<PaletteData>) };
  } catch {
    return DEFAULT_PALETTE_DATA;
  }
}

/**
 * The URL of a package's art, shown for a result without a generic icon.
 *
 * @param icon - The entry's icon id.
 * @returns The image URL.
 * @example
 * ```ts
 * packageIconUrl("web"); // "/art/icon-web-256.webp"
 * ```
 */
export function packageIconUrl(icon: string): string {
  return `/art/icon-${icon}-256.webp`;
}

/**
 * The status line under the field: why there are no results, or nothing when there are.
 *
 * @param status - The load state and the results.
 * @returns The message; `""` while results show.
 * @example
 * ```ts
 * statusMessage({ failed: false, loaded: false, resultCount: 0, query: "" }); // "Loading the index…"
 * statusMessage({ failed: false, loaded: true, resultCount: 3, query: "route" }); // ""
 * ```
 */
export function statusMessage(status: PaletteStatus): string {
  if (status.failed) return "The search index did not load. Try again in a moment.";
  if (!status.loaded) return "Loading the index…";
  if (status.resultCount > 0) return "";
  return `Nothing matches "${status.query}". Try a package name, a plugin like "content", or "route".`;
}

/**
 * Whether the "Suggested" label above the results is hidden: once the visitor types, and while
 * the index loads.
 *
 * @param query - The query as typed.
 * @param loaded - The index has loaded.
 * @returns `true` when the label is hidden.
 * @example
 * ```ts
 * isSuggestionLabelHidden("  ", true); // false: an empty query shows suggestions
 * isSuggestionLabelHidden("route", true); // true
 * ```
 */
export function isSuggestionLabelHidden(query: string, loaded: boolean): boolean {
  return query.trim() !== "" || !loaded;
}

/**
 * The selection after an arrow key, wrapping at both ends.
 *
 * @param selected - Index of the selected result.
 * @param key - `KeyboardEvent.key`.
 * @param count - Results on screen.
 * @returns The new index, or `undefined` when the key is no arrow or there is nothing to select.
 * @example
 * ```ts
 * stepSelection(2, "ArrowDown", 3); // 0
 * stepSelection(0, "ArrowUp", 3); // 2
 * stepSelection(0, "Enter", 3); // undefined
 * ```
 */
export function stepSelection(selected: number, key: string, count: number): number | undefined {
  const isArrow = key === "ArrowDown" || key === "ArrowUp";
  if (!isArrow || count === 0) return undefined;
  const step = key === "ArrowDown" ? 1 : -1;
  return (selected + step + count) % count;
}

/**
 * The next Tab stop in the modal's ring, wrapping at both ends.
 *
 * @param current - Index of the focused stop; `-1` when focus is on none.
 * @param backwards - Shift is held.
 * @param stops - Number of stops.
 * @returns The index to focus, for `Array.prototype.at`.
 * @example
 * ```ts
 * nextTabStop(1, false, 2); // 0
 * nextTabStop(0, true, 2); // 1
 * ```
 */
export function nextTabStop(current: number, backwards: boolean, stops: number): number {
  const step = backwards ? -1 : 1;
  return (current + step + stops) % stops;
}

/**
 * Whether a keydown is the palette's shortcut: ⌘K, or Ctrl+K off a Mac.
 *
 * @param keys - The keydown's key and modifiers.
 * @returns `true` for ⌘K and Ctrl+K, in either case.
 * @example
 * ```ts
 * isPaletteShortcut({ key: "K", metaKey: true, ctrlKey: false }); // true
 * isPaletteShortcut({ key: "k", metaKey: false, ctrlKey: false }); // false
 * ```
 */
export function isPaletteShortcut(keys: ShortcutKeys): boolean {
  return (keys.metaKey || keys.ctrlKey) && keys.key.toLowerCase() === "k";
}
