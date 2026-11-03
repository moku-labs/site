/**
 * @file The `search-palette` island: the ⌘K modal over the search collection shard.
 *
 * Opens on ⌘K / Ctrl+K and on a click of any `[data-search-open]` button; loads the shard once
 * with `loadCollectionShard`, on the first open or when such a button gets hover or focus; suggests
 * pages for an empty query, filters live with the match highlighted, once per frame; arrows move,
 * Enter opens, Esc closes; focus stays in the modal and returns to the opener on close. Opening pushes a `#search` history entry, so Back closes the palette instead
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
import { isSearchShard, markMatch, searchResults } from "../lib/search-results";
import type { SearchEntry, SearchShard } from "../plugins/search/types";
import { openHref } from "./fragment";

/** A shard load that takes longer than this counts as failed; `loadCollectionShard` has no signal. */
const LOAD_TIMEOUT_MS = 8000;

/** The screens with room for a few words in the input, not the desktop sentence. */
const PHONE_QUERY = "(max-width: 760px)";

/** The keys that act on the results on screen. */
const ACTS_ON_RESULTS: ReadonlySet<string> = new Set(["ArrowDown", "ArrowUp", "Enter"]);

/** Per-instance state of the island. */
type PaletteState = {
  /** The palette's props. */
  props: PaletteData;
  /** The index, once loaded. */
  shard: SearchShard | undefined;
  /** The load in flight, handed to the next caller, so the file is fetched once. */
  loading: Promise<void> | undefined;
  /** The index failed to load. */
  failed: boolean;
  /** The paint waiting for the next frame. */
  frame: number | undefined;
  /** The results on screen. */
  results: readonly SearchEntry[];
  /** Index of the selected result. */
  selected: number;
  /** The element that had focus before the palette opened. */
  opener: Element | undefined;
  /** The palette pushed a history entry when it opened, so Back closes it. */
  pushed: boolean;
  /** Closing asked history to pop that entry, and the pop has not arrived. */
  popping: boolean;
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
 * @param shard - The shard, for its aliases.
 * @returns Text and mark nodes.
 */
function marked(text: string, query: string, shard: SearchShard): Node[] {
  return markMatch(text, query, shard).map(part => {
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
 * A `<span>` for one part of a result row.
 *
 * @param part - Its `data-part` name.
 * @param children - Its nodes or text.
 * @returns The span.
 */
function partSpan(part: string, ...children: (Node | string)[]): HTMLSpanElement {
  const span = document.createElement("span");
  span.dataset.part = part;
  span.append(...children);
  return span;
}

/**
 * One result row.
 *
 * @param root - The palette element.
 * @param entry - The index row.
 * @param index - Its position.
 * @param query - The query, for the highlight.
 * @param shard - The shard, for the highlight of an alias.
 * @returns The `<a role="option">`.
 */
function optionFor(
  root: Element,
  entry: SearchEntry,
  index: number,
  query: string,
  shard: SearchShard
): HTMLAnchorElement {
  // The option is the link itself: a link inside an option would nest two controls.
  const link = document.createElement("a");
  link.id = `${OPTION_ID}${index}`;
  link.setAttribute("role", "option");
  link.href = entry.href;
  link.tabIndex = -1;
  link.append(
    iconFor(root, entry.icon),
    partSpan("title", ...marked(entry.title, query, shard)),
    partSpan("subtitle", ...marked(entry.subtitle, query, shard)),
    partSpan("kind", entry.kind)
  );
  return link;
}

/**
 * Mark the selected result and point the input at it.
 *
 * @param root - The palette element.
 * @param state - The island state.
 */
function paintSelection(root: Element, state: PaletteState): void {
  // Mark the selected option.
  const options = root.querySelectorAll('[role="option"]');
  for (const [index, option] of options.entries()) {
    option.setAttribute("aria-selected", String(index === state.selected));
  }

  // Point the input at it and keep it in view; with no option, point at nothing.
  const input = inputOf(root);
  const current = options[state.selected];
  if (input === null) return;
  if (current === undefined) {
    input.removeAttribute("aria-activedescendant");
    return;
  }
  input.setAttribute("aria-activedescendant", current.id);
  current.scrollIntoView({ block: "nearest" });
}

/**
 * Drop the paint waiting for the next frame.
 *
 * @param state - The island state.
 */
function cancelPaint(state: PaletteState): void {
  if (state.frame !== undefined) cancelAnimationFrame(state.frame);
  state.frame = undefined;
}

/**
 * Show the results for the query: suggestions when it is empty, matches otherwise, a status line
 * while loading, on failure or when nothing matches.
 *
 * @param root - The palette element.
 * @param state - The island state.
 */
function paint(root: Element, state: PaletteState): void {
  cancelPaint(state);

  // Match the query and reset the selection.
  const query = inputOf(root)?.value ?? "";
  const { shard } = state;
  const loaded = shard !== undefined;
  state.results = shard === undefined ? [] : searchResults(shard, query, state.props.suggested);
  state.selected = 0;

  // Show the label, the rows and the status line.
  const label = root.querySelector<HTMLElement>('[data-part="label"]');
  if (label !== null) label.hidden = isSuggestionLabelHidden(query, loaded);
  const rows =
    shard === undefined
      ? []
      : state.results.map((entry, index) => optionFor(root, entry, index, query, shard));
  root.querySelector('[data-part="results"]')?.replaceChildren(...rows);
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
 * Paint on the next frame, so fast typing paints once per frame.
 *
 * @param root - The palette element.
 * @param state - The island state.
 */
function schedulePaint(root: Element, state: PaletteState): void {
  state.frame ??= requestAnimationFrame(() => paint(root, state));
}

/**
 * A promise that rejects after a time, for a race with a load that takes no signal.
 *
 * @param ms - The time in milliseconds.
 * @returns A promise that never resolves.
 */
function rejectAfter(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error("[site] The search index load timed out.")), ms);
  });
}

/**
 * Fetch the index: a hung, failed or malformed load ends in `failed`, for the next open to retry.
 * Repaint when it ends.
 *
 * @param root - The palette element.
 * @param state - The island state.
 */
async function fetchIndex(root: Element, state: PaletteState): Promise<void> {
  const { baseUrl, collection, shard } = state.props;
  state.failed = false;
  try {
    const loaded = await Promise.race([
      loadCollectionShard<SearchShard>(baseUrl, collection, shard),
      rejectAfter(LOAD_TIMEOUT_MS)
    ]);
    if (isSearchShard(loaded)) state.shard = loaded;
    else state.failed = true;
  } catch {
    state.failed = true;
  }
  if (isOpen(root)) paint(root, state);
}

/**
 * Load the index once: a caller during a load gets the load in flight.
 *
 * @param root - The palette element.
 * @param state - The island state.
 * @returns The load, settled when the index is in or the load failed.
 */
function loadIndex(root: Element, state: PaletteState): Promise<void> {
  if (state.shard !== undefined) return Promise.resolve();
  state.loading ??= fetchIndex(root, state).finally(() => {
    state.loading = undefined;
  });
  return state.loading;
}

/**
 * Empty the input and give it the placeholder for this screen.
 *
 * @param input - The palette's input.
 */
function resetInput(input: HTMLInputElement): void {
  input.value = "";
  const short = input.dataset.placeholderShort;
  if (input.dataset.placeholderLong === undefined) {
    input.dataset.placeholderLong = input.placeholder;
  }
  const phone = short !== undefined && matchMedia(PHONE_QUERY).matches;
  input.placeholder = phone ? short : input.dataset.placeholderLong;
}

/**
 * Open the palette with an empty query and focus the input.
 *
 * @param ctx - The island context.
 */
function openPalette(ctx: PaletteContext): void {
  const root = ctx.el;
  if (!(root instanceof HTMLElement) || isOpen(root)) return;

  // Remember the opener, and push a fragment entry: same-document, so the router leaves it alone.
  ctx.state.opener = document.activeElement ?? undefined;
  ctx.state.pushed = !isPaletteEntry(location.hash);
  if (ctx.state.pushed) location.hash = PALETTE_HASH;

  // Show the palette with an empty input.
  root.hidden = false;
  const input = inputOf(root);
  if (input !== null) resetInput(input);

  // The load first: a retry clears `failed`, so the paint says "Loading" and not the old failure.
  void loadIndex(root, ctx.state);
  paint(root, ctx.state);
  input?.focus();
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

  // Hide it; a paint still waiting for its frame has nothing to show.
  cancelPaint(ctx.state);
  root.hidden = true;

  // Pop the history entry it pushed, when that is still to do.
  const pop = shouldPopEntry({ pushed: ctx.state.pushed, hash: location.hash, kind });
  ctx.state.pushed = false;
  ctx.state.popping = pop;
  if (pop) history.back();

  // Give focus back to the element that opened it.
  const opener = ctx.state.opener;
  ctx.state.opener = undefined;
  if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
}

/**
 * Whether a click is a plain one: no other button, no modifier that opens a new tab or window. A
 * keyboard's click is not a mouse event, and counts as plain.
 *
 * @param event - The click.
 * @returns `true` when the page itself should navigate.
 */
function isPlainClick(event: Event): boolean {
  return (
    !(event instanceof MouseEvent) ||
    (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey)
  );
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
  const href = link instanceof HTMLAnchorElement ? link.getAttribute("href") : undefined;
  const hasTarget = href !== undefined && href !== null;
  if (!isPlainClick(event) || !hasTarget) {
    closePalette(ctx);
    return;
  }
  event.preventDefault();

  // The row of the page on show has nowhere to go: closing pops the palette's entry.
  if (href === location.pathname + location.search) {
    closePalette(ctx);
    return;
  }
  const replace = ctx.state.pushed && isPaletteEntry(location.hash);
  closePalette(ctx, "keep");
  openHref(ctx, href, { replace });
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
  // A key that acts on the results must see this keystroke's results, not last frame's.
  if (state.frame !== undefined && ACTS_ON_RESULTS.has(event.key)) paint(ctx.el, state);
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
 * The open button an event came from.
 *
 * @param event - A document-level event.
 * @returns The `[data-search-open]` element at or around its target, if any.
 */
function openerTarget(event: Event): Element | undefined {
  const target = event.target instanceof Element ? event.target : undefined;
  return target?.closest("[data-search-open]") ?? undefined;
}

/**
 * The ⌘K palette. Global shortcuts and the open buttons live outside the island's element,
 * so their listeners go on the document and are removed on destroy.
 */
export const searchPaletteIsland = createIsland("search-palette", {
  state: (ctx): PaletteState => ({
    props: readPaletteData(ctx.el),
    shard: undefined,
    loading: undefined,
    failed: false,
    frame: undefined,
    results: [],
    selected: 0,
    opener: undefined,
    pushed: false,
    popping: false
  }),
  events: {
    "input [data-part='field'] input": ctx => schedulePaint(ctx.el, ctx.state),
    "click [data-close]": ctx => closePalette(ctx),
    "click a[role='option']": (ctx, event, link) => chooseResult(ctx, event, link),
    keydown: (ctx, event) => onKey(ctx, event)
  },
  onMount: ctx => {
    // The shortcut toggles the palette.
    const onShortcut = (event: KeyboardEvent): void => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      if (isOpen(ctx.el)) closePalette(ctx);
      else openPalette(ctx);
    };

    // An open button opens it on a click, and starts the load on hover or focus.
    const onOpenClick = (event: MouseEvent): void => {
      if (openerTarget(event) !== undefined) openPalette(ctx);
    };
    const onOpenIntent = (event: Event): void => {
      if (openerTarget(event) !== undefined) void loadIndex(ctx.el, ctx.state);
    };

    // Back from the palette's entry: the entry is gone already, so only hide the palette. The pop
    // of a close arrives late: a palette opened since then is still open, and needs its entry back.
    const onPopState = (): void => {
      const wasOwnPop = ctx.state.popping;
      ctx.state.popping = false;
      if (!isOpen(ctx.el) || isPaletteEntry(location.hash)) return;
      if (wasOwnPop) {
        ctx.state.pushed = true;
        location.hash = PALETTE_HASH;
        return;
      }
      closePalette(ctx, "keep");
    };

    // These live outside the island's element, so they go on the document and leave on destroy.
    document.addEventListener("keydown", onShortcut);
    document.addEventListener("click", onOpenClick);
    document.addEventListener("mouseover", onOpenIntent);
    document.addEventListener("focusin", onOpenIntent);
    addEventListener("popstate", onPopState);
    ctx.cleanup(() => {
      document.removeEventListener("keydown", onShortcut);
      document.removeEventListener("click", onOpenClick);
      document.removeEventListener("mouseover", onOpenIntent);
      document.removeEventListener("focusin", onOpenIntent);
      removeEventListener("popstate", onPopState);
      cancelPaint(ctx.state);
    });
  },
  onNavStart: ctx => closePalette(ctx, "keep")
});
