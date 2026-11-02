/**
 * @file The initial state of the `prefetch` plugin.
 */
import type { PrefetchState } from "./types";

/**
 * Empty state: `onStart` sets the warmer and the listeners, `watchViewport` the observer.
 *
 * @returns The state before start.
 * @example
 * ```ts
 * createPrefetchState(); // { warmer: undefined, listeners: undefined, observer: undefined, hover: undefined }
 * ```
 */
export function createPrefetchState(): PrefetchState {
  return { warmer: undefined, listeners: undefined, observer: undefined, hover: undefined };
}
