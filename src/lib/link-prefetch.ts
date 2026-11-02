/**
 * @file Which links to warm, and when: the logic of the browser `prefetch` plugin.
 *
 * DOM-free, so it is unit tested in Node. A link is warmed by calling `warm(pathname)` once per
 * path; the plugin passes `app.data.at`, whose in-memory cache the SPA reads on navigation.
 */

/** The part of an `<a>` element the checks read; any DOM `Element` has it. */
export type LinkLike = {
  /** Read an attribute; `null` or `undefined` when it is not set. */
  getAttribute(name: string): string | null | undefined;
  /** Whether an attribute is set. */
  hasAttribute(name: string): boolean;
};

/** The part of `navigator.connection` the checks read. */
export type ConnectionLike = {
  /** The reader asked to save data. */
  readonly saveData?: boolean;
  /** `slow-2g`, `2g`, `3g` or `4g`. */
  readonly effectiveType?: string;
};

/** Warms each page once; links in the viewport only while the page's budget lasts. */
export type LinkWarmer = {
  /**
   * Warm the page a link points to: on hover, touch or focus.
   *
   * @param link - The link.
   * @returns `true` when this call started a warm-up.
   * @example
   * ```ts
   * // The reader touches the "Routing" link twice: the second touch warms nothing.
   * const routing = { getAttribute: () => "/docs/web/routing/", hasAttribute: () => false };
   * warmer.warm(routing); // true
   * warmer.warm(routing); // false
   * ```
   */
  warm(link: LinkLike): boolean;
  /**
   * Warm a link that entered the viewport, while the page's budget lasts.
   *
   * @param link - The link.
   * @returns `true` when this call started a warm-up.
   * @example
   * ```ts
   * // `viewportBudget: 6`, and a 7th link scrolls into view on the same page.
   * const demos = { getAttribute: () => "/demos/", hasAttribute: () => false };
   * warmer.warmVisible(demos); // false: the page's budget is spent
   * ```
   */
  warmVisible(link: LinkLike): boolean;
  /**
   * A new page is shown: its viewport budget starts full.
   *
   * @example
   * ```ts
   * warmer.newPage(); // after spa:navigated
   * ```
   */
  newPage(): void;
  /**
   * Whether this page's viewport budget is spent.
   *
   * @returns `true` when no more links in view are warmed on this page.
   * @example
   * ```ts
   * if (warmer.isSpent()) observer.disconnect();
   * ```
   */
  isSpent(): boolean;
};

/** What `createLinkWarmer` needs. */
export type LinkWarmerOptions = {
  /** Loads the data of a page; called once per path. */
  warm: (path: string) => unknown;
  /** The current page URL. */
  here: () => string;
  /** How many links in view are warmed per page. */
  viewportBudget: number;
};

const SLOW_CONNECTION = /(^|-)2g$/;

/**
 * The path to warm for a link, or `undefined` when it must not be warmed: another origin, a new
 * tab, a download, a file such as `/llms.txt`, or the current page.
 *
 * @param link - The link.
 * @param here - The current page URL.
 * @returns The page path, e.g. `/docs/web/routing/`.
 * @example
 * ```ts
 * const link = { getAttribute: () => "/docs/web/quick-start/", hasAttribute: () => false };
 * prefetchPath(link, "https://moku-labs.com/docs/"); // "/docs/web/quick-start/"
 * prefetchPath(link, "https://moku-labs.com/docs/web/quick-start/"); // undefined: already there
 * ```
 */
export function prefetchPath(link: LinkLike, here: string): string | undefined {
  const target = link.getAttribute("target") ?? "";
  const opensElsewhere = target !== "" && target !== "_self";
  if (link.hasAttribute("download") || opensElsewhere) return undefined;

  // Only pages of this site: same origin, a directory path, not the page shown now.
  const href = link.getAttribute("href") ?? "";
  const current = new URL(here);
  const url = href !== "" && URL.canParse(href, here) ? new URL(href, here) : undefined;
  if (url === undefined || url.origin !== current.origin) return undefined;
  if (!url.pathname.endsWith("/") || url.pathname === current.pathname) return undefined;
  return url.pathname;
}

/**
 * Whether links in view may be warmed without a sign of intent: not on save-data, not on 2g.
 *
 * @param connection - `navigator.connection`, absent in most browsers.
 * @returns `true` when eager warming is allowed.
 * @example
 * ```ts
 * isEagerAllowed({ saveData: false, effectiveType: "4g" }); // true
 * isEagerAllowed({ effectiveType: "slow-2g" }); // false
 * ```
 */
export function isEagerAllowed(connection: ConnectionLike | undefined): boolean {
  if (connection === undefined) return true;
  return connection.saveData !== true && !SLOW_CONNECTION.test(connection.effectiveType ?? "");
}

/**
 * Create the warmer of one browser app: it remembers every path it warmed.
 *
 * @param options - The warm function, the current URL and the viewport budget.
 * @returns The warmer.
 * @example
 * ```ts
 * const warmer = createLinkWarmer({
 *   warm: path => app.data.at(path),
 *   here: () => location.href,
 *   viewportBudget: 6
 * });
 * warmer.warm(anchor);
 * ```
 */
export function createLinkWarmer(options: LinkWarmerOptions): LinkWarmer {
  const warmed = new Set<string>();
  let visibleWarmed = 0;

  const warm = (link: LinkLike): boolean => {
    const path = prefetchPath(link, options.here());
    if (path === undefined || warmed.has(path)) return false;
    warmed.add(path);
    options.warm(path);
    return true;
  };

  return {
    warm,
    warmVisible: link => {
      if (visibleWarmed >= options.viewportBudget || !warm(link)) return false;
      visibleWarmed += 1;
      return true;
    },
    newPage: () => {
      visibleWarmed = 0;
    },
    isSpent: () => visibleWarmed >= options.viewportBudget
  };
}
