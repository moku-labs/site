/**
 * @file A browser-safe reference to the docs plugin for route loaders.
 *
 * `routes.tsx` ships to the browser, but the docs plugin reads the file system. A route's
 * `.generate()` and `.load()` run only at build, and their `ctx.require` finds a plugin by its
 * name. So the routes hold this reference, typed as the plugin through a type-only import, and the
 * plugin's code never enters the client bundle.
 */
import type { docsPlugin } from "../plugins/docs";

/**
 * Stands in for `docsPlugin` in `ctx.require` inside route loaders. Only the name is read at
 * run time; the type gives `ctx.require(docsReference)` the full docs API.
 *
 * @example
 * ```ts
 * route("/docs/{pkg}/").generate(ctx => ctx.require(docsReference).params(1));
 * ```
 */
export const docsReference = { name: "docs" } as typeof docsPlugin;
