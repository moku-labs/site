/**
 * @file The `search-palette` island: the ⌘K modal over the search collection shard (U9, E1).
 *
 * Opens on ⌘K / Ctrl+K and on a click of any `[data-search-open]` button; loads the shard once
 * with `loadCollectionShard`; suggests pages for an empty query, filters live with the match
 * highlighted; arrows move, Enter opens, Esc closes; focus stays in the modal and returns to the
 * opener on close.
 */
import type { Spa } from "@moku-labs/web/browser";
import { createIsland, loadCollectionShard } from "@moku-labs/web/browser";
import { markMatch, searchResults } from "../lib/search-results";
import type { SearchEntry } from "../plugins/search/types";

/** What the palette hands the island through `data-props`. */
type PaletteData = {
  /** Base URL of the collection files. */
  baseUrl: string;
  /** Collection name. */
  collection: string;
  /** Shard name. */
  shard: string;
  /** Hrefs suggested for an empty query. */
  suggested: readonly string[];
};

/** Per-instance state of the island. */
type PaletteState = {
  /** The palette's props. */
  props: PaletteData;
  /** The index, once loaded. */
  entries: readonly SearchEntry[] | undefined;
  /** The index failed to load. */
  failed: boolean;
  /** The results on screen. */
  results: readonly SearchEntry[];
  /** Index of the selected result. */
  selected: number;
  /** The element that had focus before the palette opened. */
  opener: Element | undefined;
};

/** The island context with its state. */
type PaletteContext = Spa.IslandContext<PaletteState>;

/** Prefix of the result option ids, for `aria-activedescendant`. */
const OPTION_ID = "search-option-";

/**
 * Read the palette's props.
 *
 * @param root - The palette element.
 * @returns The props; empty suggestions and the default shard when they are missing.
 */
function readPaletteData(root: Element): PaletteData {
  const fallback: PaletteData = { baseUrl: "/", collection: "search", shard: "en", suggested: [] };
  if (!(root instanceof HTMLElement) || root.dataset.props === undefined) return fallback;
  try {
    const parsed: unknown = JSON.parse(root.dataset.props);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    return { ...fallback, ...(parsed as Partial<PaletteData>) };
  } catch {
    return fallback;
  }
}

/**
 * The palette's input.
 *
 * @param root - The palette element.
 * @returns The input, if present.
 */
function inputOf(root: Element): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>('[data-part="field"] input');
}

/**
 * Whether the palette is open.
 *
 * @param root - The palette element.
 * @returns `true` when it is shown.
 */
function isOpen(root: Element): boolean {
  return root instanceof HTMLElement && !root.hidden;
}

/**
 * Text with its match wrapped in `<mark>`, as DOM nodes.
 *
 * @param text - The text.
 * @param query - The query.
 * @returns Text and mark nodes.
 */
function marked(text: string, query: string): Node[] {
  return markMatch(text, query).map(part => {
    if (!part.marked) return document.createTextNode(part.text);
    const mark = document.createElement("mark");
    mark.textContent = part.text;
    return mark;
  });
}

/**
 * The icon of a result: package art, or a generic cube cloned from the palette's icon set.
 *
 * @param root - The palette element.
 * @param icon - The entry's icon id.
 * @returns The icon element.
 */
function iconFor(root: Element, icon: string): Element {
  const generic = root.querySelector(`[data-part="icons"] [data-icon="${icon}"]`);
  if (generic !== null) return generic.cloneNode(true) as Element;
  const image = document.createElement("img");
  image.src = `/art/icon-${icon}-256.webp`;
  image.width = 34;
  image.height = 34;
  image.alt = "";
  image.loading = "lazy";
  return image;
}

/**
 * One result row.
 *
 * @param root - The palette element.
 * @param entry - The index row.
 * @param index - Its position.
 * @param query - The query, for the highlight.
 * @returns The `<div role="option">`.
 */
function optionFor(
  root: Element,
  entry: SearchEntry,
  index: number,
  query: string
): HTMLDivElement {
  const option = document.createElement("div");
  option.id = `${OPTION_ID}${index}`;
  option.setAttribute("role", "option");
  const link = document.createElement("a");
  link.href = entry.href;
  link.tabIndex = -1;
  const title = document.createElement("span");
  title.dataset.part = "title";
  title.append(...marked(entry.title, query));
  const subtitle = document.createElement("span");
  subtitle.dataset.part = "subtitle";
  subtitle.append(...marked(entry.subtitle, query));
  const kind = document.createElement("span");
  kind.dataset.part = "kind";
  kind.textContent = entry.kind;
  link.append(iconFor(root, entry.icon), title, subtitle, kind);
  option.append(link);
  return option;
}

/**
 * Mark the selected result and point the input at it.
 *
 * @param root - The palette element.
 * @param state - The island state.
 */
function paintSelection(root: Element, state: PaletteState): void {
  const options = root.querySelectorAll('[role="option"]');
  for (const [index, option] of options.entries()) {
    option.setAttribute("aria-selected", String(index === state.selected));
  }
  const input = inputOf(root);
  const current = options[state.selected];
  if (input === null) return;
  if (current === undefined) input.removeAttribute("aria-activedescendant");
  else {
    input.setAttribute("aria-activedescendant", current.id);
    current.scrollIntoView({ block: "nearest" });
  }
}

/**
 * Show the results for the query: suggestions when it is empty, matches otherwise, a status line
 * while loading, on failure or when nothing matches.
 *
 * @param root - The palette element.
 * @param state - The island state.
 */
function paint(root: Element, state: PaletteState): void {
  const query = inputOf(root)?.value ?? "";
  const label = root.querySelector<HTMLElement>('[data-part="label"]');
  const status = root.querySelector('[data-part="status"]');
  const list = root.querySelector('[data-part="results"]');
  state.results =
    state.entries === undefined ? [] : searchResults(state.entries, query, state.props.suggested);
  state.selected = 0;
  if (label !== null) label.hidden = query.trim() !== "" || state.entries === undefined;
  list?.replaceChildren(
    ...state.results.map((entry, index) => optionFor(root, entry, index, query))
  );
  if (status !== null) {
    let message = "";
    if (state.failed) message = "The search index did not load. Try again in a moment.";
    else if (state.entries === undefined) message = "Loading the index…";
    else if (state.results.length === 0) {
      message = `Nothing matches "${query}". Try a package name, a plugin like "content", or "route".`;
    }
    status.textContent = message;
  }
  paintSelection(root, state);
}

/**
 * Load the index once; repaint when it arrives.
 *
 * @param root - The palette element.
 * @param state - The island state.
 */
async function loadIndex(root: Element, state: PaletteState): Promise<void> {
  if (state.entries !== undefined) return;
  const { baseUrl, collection, shard } = state.props;
  try {
    const entries = await loadCollectionShard<SearchEntry[]>(baseUrl, collection, shard);
    state.entries = Array.isArray(entries) ? entries : [];
    state.failed = false;
  } catch {
    state.failed = true;
  }
  if (isOpen(root)) paint(root, state);
}

/**
 * Open the palette with an empty query and focus the input.
 *
 * @param ctx - The island context.
 */
function openPalette(ctx: PaletteContext): void {
  const root = ctx.el;
  if (!(root instanceof HTMLElement) || isOpen(root)) return;
  ctx.state.opener = document.activeElement ?? undefined;
  root.hidden = false;
  const input = inputOf(root);
  if (input !== null) input.value = "";
  paint(root, ctx.state);
  input?.focus();
  void loadIndex(root, ctx.state);
}

/**
 * Close the palette and give focus back to the element that opened it.
 *
 * @param ctx - The island context.
 */
function closePalette(ctx: PaletteContext): void {
  const root = ctx.el;
  if (!(root instanceof HTMLElement) || !isOpen(root)) return;
  root.hidden = true;
  const opener = ctx.state.opener;
  ctx.state.opener = undefined;
  if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
}

/**
 * Keep Tab inside the modal: cycle through its tabbable elements, wrapping at both ends. The
 * results are picked with the arrows, so most of the time the input is the only stop.
 *
 * @param root - The palette element.
 * @param event - The Tab keydown.
 */
function trapFocus(root: Element, event: KeyboardEvent): void {
  const stops = [
    ...root.querySelectorAll<HTMLElement>('[data-part="panel"] input, [data-part="panel"] a')
  ].filter(element => element.tabIndex >= 0);
  if (stops.length === 0) return;
  event.preventDefault();
  const active = document.activeElement;
  const current = active instanceof HTMLElement ? stops.indexOf(active) : -1;
  const step = event.shiftKey ? -1 : 1;
  stops.at((current + step + stops.length) % stops.length)?.focus();
}

/**
 * Keys inside the open palette: Esc closes, arrows move the selection, Enter opens it, Tab stays
 * inside.
 *
 * @param ctx - The island context.
 * @param event - The keydown.
 */
function onKey(ctx: PaletteContext, event: Event): void {
  if (!(event instanceof KeyboardEvent) || !isOpen(ctx.el)) return;
  const state = ctx.state;
  const count = state.results.length;
  if (event.key === "Escape") {
    event.preventDefault();
    closePalette(ctx);
  } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && count > 0) {
    event.preventDefault();
    state.selected = (state.selected + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
    paintSelection(ctx.el, state);
  } else if (event.key === "Enter") {
    const link = ctx.el.querySelectorAll('[role="option"] a')[state.selected];
    if (!(link instanceof HTMLAnchorElement)) return;
    event.preventDefault();
    closePalette(ctx);
    link.click();
  } else if (event.key === "Tab") {
    trapFocus(ctx.el, event);
  }
}

/**
 * The ⌘K palette (E1). Global shortcuts and the open buttons live outside the island's element,
 * so their listeners go on the document and are removed on destroy.
 */
export const searchPaletteIsland = createIsland("search-palette", {
  state: (ctx): PaletteState => ({
    props: readPaletteData(ctx.el),
    entries: undefined,
    failed: false,
    results: [],
    selected: 0,
    opener: undefined
  }),
  events: {
    "input [data-part='field'] input": ctx => paint(ctx.el, ctx.state),
    "click [data-close]": ctx => closePalette(ctx),
    "click [role='option'] a": ctx => closePalette(ctx),
    keydown: (ctx, event) => onKey(ctx, event)
  },
  onMount: ctx => {
    const onShortcut = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      if (isOpen(ctx.el)) closePalette(ctx);
      else openPalette(ctx);
    };
    const onOpenClick = (event: MouseEvent): void => {
      const target = event.target instanceof Element ? event.target : undefined;
      if (target?.closest("[data-search-open]")) openPalette(ctx);
    };
    document.addEventListener("keydown", onShortcut);
    document.addEventListener("click", onOpenClick);
    ctx.cleanup(() => {
      document.removeEventListener("keydown", onShortcut);
      document.removeEventListener("click", onOpenClick);
    });
  },
  onNavStart: ctx => closePalette(ctx)
});
