/**
 * @file The `site-nav` island: the mobile menu and the active link of the persistent header.
 */
import { createIsland } from "@moku-labs/web/browser";

/**
 * Open or close the mobile menu.
 *
 * @param header - The header element.
 * @param open - Whether the menu is open.
 */
function setMenuOpen(header: Element, open: boolean): void {
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
 * The header stays mounted across SPA navigation, so this island keeps it in step: the burger
 * opens the menu under 960px, and every navigation closes it and moves the active underline.
 */
export const siteNavIsland = createIsland("site-nav", {
  events: {
    "click [data-part='burger']": ctx => setMenuOpen(ctx.el, !isMenuOpen(ctx.el)),
    keydown: (ctx, event) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") setMenuOpen(ctx.el, false);
    }
  },
  onNavEnd: ctx => {
    setMenuOpen(ctx.el, false);
    markActive(ctx.el, ctx.meta.nav);
  }
});
