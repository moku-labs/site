/**
 * @file Maps docs files to URL paths and enforces the depth rule.
 */

/** Where a docs file lands. */
export type DocumentLocation = {
  /** URL path with a trailing slash. */
  path: string;
  /** Package id or `concepts`. */
  pkg: string;
  /** Section folder or `undefined`. */
  section: string | undefined;
  /** File name without extension. */
  slug: string;
};

/**
 * Map a file under the docs dir to its URL location.
 *
 * @param _relativeFile - Path relative to the docs dir, e.g. `web/guides/routing.md`.
 * @param _knownPackages - Package ids allowed as the first segment (plus `concepts`).
 * @throws {Error} When the file is deeper than `<pkg>/<section>/<page>` or its package is unknown.
 */
export function locateDocument(
  _relativeFile: string,
  _knownPackages: readonly string[]
): DocumentLocation {
  throw new Error("not implemented");
}
