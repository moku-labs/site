/**
 * @file A browser-safe reference to the kernel plugin for route loaders.
 *
 * The kernel plugin runs the real kernel through `@moku-labs/web`'s Node entry, so it is composed
 * only in `src/app.ts`. A route's `.load()` runs only at build, and its `ctx.require` finds a
 * plugin by name; this reference carries the name and, through a type-only import, the API type.
 */
import type { kernelPlugin } from "../plugins/kernel";

/**
 * Stands in for `kernelPlugin` in `ctx.require` inside route loaders. Only the name is read at
 * run time.
 *
 * @example
 * ```ts
 * route("/").load(ctx => ctx.require(kernelReference).trayMessages(trayPlugins));
 * ```
 */
export const kernelReference = { name: "kernel" } as typeof kernelPlugin;
