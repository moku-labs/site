/**
 * @file The link builder the route context hands to layouts and pages.
 */

/**
 * Builds the URL of a named route, the `ctx.url` of a route's render and layout. Components take
 * it as a prop instead of importing `urls` from `routes.tsx`, which imports them.
 */
export type UrlBuilder = (name: string, params?: Record<string, string>) => string;
