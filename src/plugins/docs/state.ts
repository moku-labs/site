/**
 * @file Initial state of the docs plugin.
 */
import type { DocumentationState } from "./types";

/**
 * Create the empty state: pages load lazily on the first API call.
 *
 * @returns State with no pages loaded.
 */
export function createDocumentationState(): DocumentationState {
  return { pages: undefined };
}
