/**
 * @file The demos page filter: which demos use a package.
 *
 * Pure and browser-safe; the demos page renders with it and the `demo-filter` island applies it.
 */
import type { DemoEntry } from "../data/demos";

/** The filter value that shows every demo. */
export const ALL_DEMOS = "all";

/**
 * Whether a demo built on `stack` passes the filter.
 *
 * @param stack - Package ids the demo is built on.
 * @param filter - A package id, or `all`.
 * @returns `true` when the demo shows.
 * @example
 * ```ts
 * usesPackage(["web", "worker"], "worker"); // true
 * ```
 */
export function usesPackage(stack: readonly string[], filter: string): boolean {
  return filter === ALL_DEMOS || stack.includes(filter);
}

/**
 * The demos built on a package.
 *
 * @param demos - Every demo.
 * @param pkg - A package id.
 * @returns The demos that use it, in display order; empty when none does.
 * @example
 * ```ts
 * demosUsing(demos, "ci").length === 0; // the page shows the empty state for ci
 * ```
 */
export function demosUsing(demos: readonly DemoEntry[], pkg: string): DemoEntry[] {
  return demos.filter(demo => usesPackage(demo.stack, pkg));
}
