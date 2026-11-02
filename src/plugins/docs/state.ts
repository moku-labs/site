/**
 * @file State of the docs plugin: the page cache of one build run.
 */
import type { DocumentationState } from "./types";

/**
 * Create the empty state: pages load lazily on the first API call.
 *
 * @returns State with no pages loaded and no load in flight.
 */
export function createDocumentationState(): DocumentationState {
  return { pages: undefined, pending: undefined };
}

/**
 * Drop the loaded pages and the load in flight, so the next API call reads the docs tree again.
 *
 * @param state - The plugin state, changed in place.
 * @example
 * ```ts
 * resetDocumentationState(ctx.state);
 * ctx.state.pages; // undefined: the next app.docs call reads content/docs again
 * ```
 */
export function resetDocumentationState(state: DocumentationState): void {
  state.pages = undefined;
  state.pending = undefined;
}
