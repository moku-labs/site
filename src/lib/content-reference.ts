/**
 * @file A browser-safe reference to the content plugin for route loaders.
 *
 * The home loader renders a code sample through the same Markdown pipeline as the docs (Shiki
 * with the site's CSS-variable theme). Only the name is read at run time; the type-only import
 * keeps the framework's Node entry out of the client bundle.
 */
import type { contentPlugin } from "@moku-labs/web";

/**
 * Stands in for `contentPlugin` in `ctx.require` inside route loaders.
 *
 * @example
 * ```ts
 * route("/").load(ctx => ctx.require(contentReference).renderMarkdown("```ts\nconst a = 1;\n```"));
 * ```
 */
export const contentReference = { name: "content" } as typeof contentPlugin;
