/**
 * @file The `search-palette` island: the ⌘K modal over the search collection shard.
 *
 * Opens on ⌘K / Ctrl+K and on a click of any `[data-search-open]` button; loads the shard once
 * with `loadCollectionShard`; suggests pages for an empty query, filters live with the match
 * highlighted; arrows move, Enter opens, Esc closes; focus stays in the modal and returns to the
 * opener on close. Opening pushes a `#search` history entry, so Back closes the palette instead
 * of leaving the page; every other way of closing pops that entry again. The state maths is in
 * `src/lib/search-palette.ts`.
 */
import type { Spa } from "@moku-labs/web/browser";
import { createIsland, loadCollectionShard } from "@moku-labs/web/browser";
import type { CloseKind, PaletteData } from "../lib/search-palette";
import {
  ICON_SIZE,
  isPaletteEntry,
  isPaletteShortcut,
  isSuggestionLabelHidden,
  nextTabStop,
  OPTION_ID,
  PALETTE_HASH,
  packageIconUrl,
  parsePaletteData,
  shouldPopEntry,
  statusMessage,
  stepSelection
} from "../lib/search-palette";
import { markMatch, searchResults } from "../lib/search-results";
import type { SearchEntry } from "../plugins/search/types";

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
  /** The palette pushed a history entry when it opened, so Back closes it. */
  pushed: boolean;
};

/** The island context with its state. */
type PaletteContext = Spa.IslandContext<PaletteState>;

/**
 * Read the palette's props.
 *
 * @param root - The palette element.
 * @returns The props; empty suggestions and the default shard when they are missing.
 */
function readPaletteData(root: Element): PaletteData {
  return parsePaletteData(root instanceof HTMLElement ? root.dataset.props : undefined);
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
  // `loading` before `src`: a browser that sees `src` first downloads the image at once.
  const image = document.createElement("img");
  image.loading = "lazy";
  image.decoding = "async";
  image.src = packageIconUrl(icon);
  image.width = ICON_SIZE;
  image.height = ICON_SIZE;
  image.alt = "";
  return image;
}

/**
 * One result row.
 *
 * @param root - The palette element.
 * @param entry - The index row.
 * @param index - Its position.
 * @param query - The query, for the highlight.
 * @returns The `<a role="option">`.
 */
function optionFor(
  root: Element,
  entry: SearchEntry,
  index: number,
  query: string
): HTMLAnchorElement {
  // The option is the link itself: a link inside an option would nest two controls.
  const link = document.createElement("a");
  link.id = `${OPTION_ID}${index}`;
  link.setAttribute("role", "option");
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
  return link;
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
  // Match the query and reset the selection.
  const query = inputOf(root)?.value ?? "";
  const loaded = state.entries !== undefined;
  state.results =
    state.entries === undefined ? [] : searchResults(state.entries, query, state.props.suggested);
  state.selected = 0;

  // Show the label, the rows and the status line.
  const label = root.querySelector<HTMLElement>('[data-part="label"]');
  if (label !== null) label.hidden = isSuggestionLabelHidden(query, loaded);
  root
    .querySelector('[data-part="results"]')
    ?.replaceChildren(...state.results.map((entry, index) => optionFor(root, entry, index, query)));
  const status = root.querySelector('[data-part="status"]');
  if (status !== null) {
    status.textContent = statusMessage({
      failed: state.failed,
      loaded,
      resultCount: state.results.length,
      query
    });
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
  // A fragment entry is same-document and the router leaves it alone.
  ctx.state.pushed = !isPaletteEntry(location.hash);
  if (ctx.state.pushed) location.hash = PALETTE_HASH;
  root.hidden = false;
  const input = inputOf(root);
  if (input !== null) {
    input.value = "";
    // A phone has room for a few words, not the desktop sentence.
    const short = input.dataset.placeholderShort;
    if (input.dataset.placeholderLong === undefined) {
      input.dataset.placeholderLong = input.placeholder;
    }
    const phone = short !== undefined && matchMedia("(max-width: 760px)").matches;
    input.placeholder = phone ? short : input.dataset.placeholderLong;
  }
  paint(root, ctx.state);
  input?.focus();
  void loadIndex(root, ctx.state);
}

/**
 * Close the palette and give focus back to the element that opened it. The history entry the
 * palette pushed is popped, unless the visitor already left it with Back (`"keep"`).
 *
 * @param ctx - The island context.
 * @param kind - `"back"` pops the entry; `"keep"` leaves history alone.
 */
function closePalette(ctx: PaletteContext, kind: CloseKind = "back"): void {
  const root = ctx.el;
  if (!(root instanceof HTMLElement) || !isOpen(root)) return;
  root.hidden = true;
  const pop = shouldPopEntry({ pushed: ctx.state.pushed, hash: location.hash, kind });
  ctx.state.pushed = false;
  if (pop) history.back();
  const opener = ctx.state.opener;
  ctx.state.opener = undefined;
  if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
}

/**
 * A result was chosen: leave through its link. The palette's own history entry is replaced by the
 * destination, so Back from there returns to the page the palette opened on.
 *
 * @param ctx - The island context.
 * @param event - The click on the result.
 * @param link - The result link.
 */
function chooseResult(ctx: PaletteContext, event: Event, link: Element): void {
  const plain =
    !(event instanceof MouseEvent) ||
    (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey);
  const href = link instanceof HTMLAnchorElement ? link.getAttribute("href") : undefined;
  if (!plain || href === undefined || href === null) {
    closePalette(ctx);
    return;
  }
  event.preventDefault();
  const replace = ctx.state.pushed && isPaletteEntry(location.hash);
  closePalette(ctx, "keep");
  ctx.navigate(href, { replace });
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
  stops.at(nextTabStop(current, event.shiftKey, stops.length))?.focus();
}

/**
 * Enter: open the selected result through its link, so the SPA router handles it.
 *
 * @param ctx - The island context.
 * @param event - The Enter keydown.
 */
function openSelected(ctx: PaletteContext, event: KeyboardEvent): void {
  const link = ctx.el.querySelectorAll('a[role="option"]')[ctx.state.selected];
  if (!(link instanceof HTMLAnchorElement)) return;
  event.preventDefault();
  link.click();
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
  if (event.key === "Escape") {
    event.preventDefault();
    closePalette(ctx);
    return;
  }
  const selected = stepSelection(state.selected, event.key, state.results.length);
  if (selected !== undefined) {
    event.preventDefault();
    state.selected = selected;
    paintSelection(ctx.el, state);
    return;
  }
  if (event.key === "Enter") {
    openSelected(ctx, event);
    return;
  }
  if (event.key === "Tab") trapFocus(ctx.el, event);
}

/**
 * The ⌘K palette. Global shortcuts and the open buttons live outside the island's element,
 * so their listeners go on the document and are removed on destroy.
 */
export const searchPaletteIsland = createIsland("search-palette", {
  state: (ctx): PaletteState => ({
    props: readPaletteData(ctx.el),
    entries: undefined,
    failed: false,
    results: [],
    selected: 0,
    opener: undefined,
    pushed: false
  }),
  events: {
    "input [data-part='field'] input": ctx => paint(ctx.el, ctx.state),
    "click [data-close]": ctx => closePalette(ctx),
    "click a[role='option']": (ctx, event, link) => chooseResult(ctx, event, link),
    keydown: (ctx, event) => onKey(ctx, event)
  },
  onMount: ctx => {
    const onShortcut = (event: KeyboardEvent): void => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      if (isOpen(ctx.el)) closePalette(ctx);
      else openPalette(ctx);
    };
    const onOpenClick = (event: MouseEvent): void => {
      const target = event.target instanceof Element ? event.target : undefined;
      if (target?.closest("[data-search-open]")) openPalette(ctx);
    };
    // Back from the palette's entry: the entry is gone already, so only hide the palette.
    const onPopState = (): void => {
      if (isOpen(ctx.el) && !isPaletteEntry(location.hash)) closePalette(ctx, "keep");
    };
    document.addEventListener("keydown", onShortcut);
    document.addEventListener("click", onOpenClick);
    addEventListener("popstate", onPopState);
    ctx.cleanup(() => {
      document.removeEventListener("keydown", onShortcut);
      document.removeEventListener("click", onOpenClick);
      removeEventListener("popstate", onPopState);
    });
  },
  onNavStart: ctx => closePalette(ctx, "keep")
});
