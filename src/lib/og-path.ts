/**
 * @file Where the share card of a page lives. Browser-safe: the head helpers of `src/routes.tsx`
 * and the Node `og` plugin share this one mapping, so a page never points at a card nobody draws.
 */

/** URL folder of the cards: `public/og/` is copied to `dist/og/` by the build. */
const CARD_URL_BASE = "/og/";

/** File name of the site root's card. */
const HOME_CARD = "home";

/** Size of every share card, in pixels. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * The card file of a page, relative to the card folder.
 *
 * @param pagePath - URL path of the page, with its trailing slash.
 * @returns The file path.
 * @example
 * ```ts
 * ogCardFile("/docs/web/guides/routing/"); // "docs/web/guides/routing.png"
 * ```
 */
export function ogCardFile(pagePath: string): string {
  const name = pagePath.replaceAll(/^\/+|\/+$/g, "");
  return `${name === "" ? HOME_CARD : name}.png`;
}

/**
 * The URL path of a page's card, for the page's `image` head field.
 *
 * @param pagePath - URL path of the page, with its trailing slash.
 * @returns The card's URL path.
 * @example
 * ```ts
 * ogImagePath("/docs/web/"); // "/og/docs/web.png"
 * ogImagePath("/"); // "/og/home.png"
 * ```
 */
export function ogImagePath(pagePath: string): string {
  return `${CARD_URL_BASE}${ogCardFile(pagePath)}`;
}
