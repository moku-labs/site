/**
 * @file Initial state of the search plugin.
 */
import type { SearchState } from "./types";

/**
 * Create the empty state: no build has written the shard yet.
 *
 * @returns State with no write in hand.
 */
export function createSearchState(): SearchState {
  return { pending: undefined };
}
