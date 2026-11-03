/**
 * @file The `site-nav` island: the mobile menu and the active link of the persistent header.
 *
 * The menu list is a manual popover and the burger its `popovertarget`, so a tap opens and a second
 * tap closes it before this island hydrates. `manual`, not `auto`: an auto popover light-dismisses
 * on the burger's pointerdown and the click then opens it again (seen on iPhone). The island mirrors
 * the popover state onto the header and the burger, closes the menu on a tap outside the header, on
 * Esc and on navigation, and toggles it itself only where the browser has no popover. There the
 * burger toggles and Esc closes; a tap outside does not (browsers before 2024).
 */
import { createIsland } from "@moku-labs/web/browser";
import { landOnFragment } from "./fragment";

const MENU = '[data-part="links"]';
/** The widths where the header shows the burger (site-header.css). */
const PHONE_MENU = "(max-width: 960px)";
const HAS_POPOVER = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

/** Island state: the listener lifetime of the persistent header. */
type SiteNavState = {
  /** Aborts the toggle, document pointerdown and keydown, focusout and resize listeners on unmount. */
  listeners: AbortController;
};

/**
 * Show the menu state on the header and the burger.
 *
 * @param header - The header element.
 * @param open - Whether the menu is open.
 */
function showMenuState(header: Element, open: boolean): void {
  if (!(header instanceof HTMLElement)) return;
  if (open) header.dataset.open = "";
  else delete header.dataset.open;
  header.querySelector('[data-part="burger"]')?.setAttribute("aria-expanded", String(open));
}

/**
 * Whether the mobile menu is open: the popover's own state where the browser has popover (its
 * `toggle` events arrive late and can be stale), the header's `data-open` otherwise.
 *
 * @param header - The header element.
 * @returns `true` while the menu is open.
 */
function isMenuOpen(header: Element): boolean {
  const menu = header.querySelector(MENU);
  if (HAS_POPOVER && menu instanceof HTMLElement) return menu.matches(":popover-open");
  return header instanceof HTMLElement && Object.hasOwn(header.dataset, "open");
}

/**
 * Close the menu: through the popover where the browser has one.
 *
 * @param header - The header element.
 */
function closeMenu(header: Element): void {
  showMenuState(header, false);

  const menu = header.querySelector(MENU);
  if (!HAS_POPOVER || !(menu instanceof HTMLElement)) return;
  if (menu.matches(":popover-open")) menu.hidePopover();
}

/**
 * Mark the link of the current route section; the route's `meta.nav` names it.
 *
 * @param header - The header element.
 * @param nav - The route's `meta.nav`.
 */
function markActive(header: Element, nav: unknown): void {
  for (const link of header.querySelectorAll<HTMLElement>("a[data-nav]")) {
    if (link.dataset.nav === nav) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

/**
 * Keep the header in step with the menu: mirror the popover state, and close the menu on a tap
 * outside the header, on Esc, when focus leaves the header and when the window grows to desktop.
 *
 * @param header - The header element.
 * @param menu - The menu popover.
 * @param signal - Removes every listener when the island unmounts.
 */
function listenForMenu(header: Element, menu: HTMLElement, signal: AbortSignal): void {
  // A tap before hydration may have opened the menu already.
  showMenuState(header, menu.matches(":popover-open"));
  menu.addEventListener(
    "toggle",
    // `toggle` is queued and coalesced: read the state now, not the event's `newState`.
    () => showMenuState(header, isMenuOpen(header)),
    { signal }
  );

  // A manual popover has no light dismiss: a tap outside the header or Esc closes it.
  document.addEventListener(
    "pointerdown",
    event => {
      const isOutside = event.target instanceof Node && !header.contains(event.target);
      if (isOutside && isMenuOpen(header)) closeMenu(header);
    },
    { signal }
  );
  document.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Escape" || !isMenuOpen(header)) return;
      closeMenu(header);
      header.querySelector<HTMLElement>('[data-part="burger"]')?.focus();
    },
    { signal }
  );

  // A keyboard user who tabs out of the header leaves the menu: close it.
  header.addEventListener(
    "focusout",
    event => {
      const next = event instanceof FocusEvent ? event.relatedTarget : undefined;
      const leftHeader = next instanceof Node && !header.contains(next);
      if (leftHeader && isMenuOpen(header)) closeMenu(header);
    },
    { signal }
  );

  // An open popover stays in the top layer: close it when the window grows past the phone menu.
  globalThis.matchMedia(PHONE_MENU).addEventListener(
    "change",
    event => {
      if (!event.matches) closeMenu(header);
    },
    { signal }
  );
}

/**
 * The header stays mounted across SPA navigation, so this island keeps it in step: the menu state
 * shows on the header, and every navigation closes the menu, moves the active underline and goes
 * to the URL's fragment.
 */
export const siteNavIsland = createIsland("site-nav", {
  state: (): SiteNavState => ({ listeners: new AbortController() }),
  events: {
    // Browsers without popover: the island is the menu.
    "click [data-part='burger']": ctx => {
      if (!HAS_POPOVER) showMenuState(ctx.el, !isMenuOpen(ctx.el));
    },
    // A tap inside a popover does not dismiss it, and a hash or outbound link ends no navigation.
    "click [data-part='links'] a": ctx => closeMenu(ctx.el),
    // The palette opens over the page: the menu must not stay open under it.
    "click [data-part='search']": ctx => closeMenu(ctx.el),
    keydown: (ctx, event) => {
      const isEscape = event instanceof KeyboardEvent && event.key === "Escape";
      if (!HAS_POPOVER && isEscape) showMenuState(ctx.el, false);
    }
  },
  onMount: ctx => {
    const menu = ctx.el.querySelector(MENU);
    if (!HAS_POPOVER || !(menu instanceof HTMLElement)) return;

    // A fresh controller per mount: the header stays mounted across SPA navigation, but after an
    // unmount (teardown, hot reload) listeners on the last mount's aborted signal would never fire.
    ctx.state.listeners = new AbortController();
    const { signal } = ctx.state.listeners;
    listenForMenu(ctx.el, menu, signal);
  },
  onUnMount: ctx => ctx.state.listeners.abort(),
  onNavEnd: ctx => {
    closeMenu(ctx.el);
    markActive(ctx.el, ctx.meta.nav);
    landOnFragment();
  }
});
