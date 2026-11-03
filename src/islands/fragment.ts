/**
 * @file SPA navigation and URL fragments. Not an island.
 *
 * The framework scrolls every forward navigation to the top and matches its route on the whole path
 * it is given, so a link to `/docs/x/#y` lands at the top of the page, and `ctx.navigate` with a
 * fragment finds no route and loses the route's meta. `openHref` gives the framework the bare path
 * and puts the fragment back on the URL; `landOnFragment` then goes to it once the page is in.
 */
import { isPaletteEntry } from "../lib/search-palette";

/** The options a programmatic navigation takes. */
type NavigateOptions = {
  /** Swap the current history entry instead of adding one. */
  replace?: boolean;
};

/** The part of an island context that navigates. */
type Navigator = {
  /** The framework's programmatic navigation. */
  navigate: (path: string, options?: NavigateOptions) => void;
};

/**
 * Open an href from a script: a section of the page on show only scrolls, any other target goes
 * through the SPA.
 *
 * @param ctx - The island context.
 * @param href - The target, with or without a fragment.
 * @param options - Passed on to the navigation.
 * @example
 * ```ts
 * openHref(ctx, "/demos/#trivia");
 * ```
 */
export function openHref(ctx: Navigator, href: string, options: NavigateOptions = {}): void {
  const [path = href, fragment] = href.split("#");
  const isSamePage = path === location.pathname + location.search;

  // A fragment of this page is a plain fragment navigation; it also drops the palette's entry.
  if (isSamePage && fragment !== undefined) {
    location.replace(href);
    return;
  }

  ctx.navigate(path, options);
  if (fragment !== undefined) history.replaceState(history.state, "", href);
}

/**
 * Go to the URL's fragment after a navigation. A frame later: the framework restores the scroll of a
 * Back or Forward after the swap, and that position wins, so only a page still at the top moves. A
 * fragment navigation, not `scrollIntoView`: it also keeps the heading clear of the sticky header
 * and sets `:target`, and it adds no history entry.
 *
 * @example
 * ```ts
 * onNavEnd: () => landOnFragment();
 * ```
 */
export function landOnFragment(): void {
  requestAnimationFrame(() => {
    const { hash } = location;
    if (hash === "" || isPaletteEntry(hash) || scrollY !== 0) return;
    location.replace(hash);
  });
}
