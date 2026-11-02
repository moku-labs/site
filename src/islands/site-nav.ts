/**
 * @file The `site-nav` island: the mobile menu and the active link of the persistent header.
 *
 * The menu list is a native popover and the burger its `popovertarget`, so a tap opens it before
 * this island hydrates. The island mirrors the popover state onto the header and the burger,
 * closes the menu on navigation, and toggles it itself only where the browser has no popover.
 */
import { createIsland } from "@moku-labs/web/browser";

const MENU = '[data-part="links"]';
/** The widths where the header shows the burger (site-header.css). */
const PHONE_MENU = "(max-width: 960px)";
const HAS_POPOVER = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

/** Island state: the listener lifetime of the persistent header. */
type SiteNavState = {
  /** Aborts the popover `toggle` listener when the header unmounts. */
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
 * Whether the mobile menu is open.
 *
 * @param header - The header element.
 * @returns `true` while the header has `data-open`.
 */
function isMenuOpen(header: Element): boolean {
  return header instanceof HTMLElement && Object.hasOwn(header.dataset, "open");
}

/**
 * Close the menu: through the popover where the browser has one.
 *
 * @param header - The header element.
 */
function closeMenu(header: Element): void {
  const menu = header.querySelector(MENU);
  showMenuState(header, false);
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
 * The header stays mounted across SPA navigation, so this island keeps it in step: the menu state
 * shows on the header, and every navigation closes the menu and moves the active underline.
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
    keydown: (ctx, event) => {
      const isEscape = event instanceof KeyboardEvent && event.key === "Escape";
      if (!HAS_POPOVER && isEscape) showMenuState(ctx.el, false);
    }
  },
  onMount: ctx => {
    const menu = ctx.el.querySelector(MENU);
    if (!HAS_POPOVER || !(menu instanceof HTMLElement)) return;

    // A tap before hydration may have opened the menu already.
    const { signal } = ctx.state.listeners;
    showMenuState(ctx.el, menu.matches(":popover-open"));
    menu.addEventListener(
      "toggle",
      event => {
        if (event instanceof ToggleEvent) showMenuState(ctx.el, event.newState === "open");
      },
      { signal }
    );

    // An open popover stays in the top layer: close it when the window grows past the phone menu.
    globalThis.matchMedia(PHONE_MENU).addEventListener(
      "change",
      event => {
        if (!event.matches) closeMenu(ctx.el);
      },
      { signal }
    );
  },
  onUnMount: ctx => ctx.state.listeners.abort(),
  onNavEnd: ctx => {
    closeMenu(ctx.el);
    markActive(ctx.el, ctx.meta.nav);
  }
});
