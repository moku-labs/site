/**
 * @file The demo apps as plain data.
 */

/** One demo app built on Moku. */
export type DemoEntry = {
  /** Short id used in anchors and art file names, e.g. `timber-town`. */
  id: string;
  /** Display name, e.g. `Timber Town`. */
  name: string;
  /** One-line description. */
  description: string;
  /** Package ids the demo is built on, e.g. `["game", "editor"]`. */
  stack: readonly string[];
};

/**
 * The demos in display order. Filled with the real entries in the data wave.
 *
 * @example
 * ```ts
 * demos.filter(demo => demo.stack.includes("web"));
 * ```
 */
export const demos: readonly DemoEntry[] = [];
