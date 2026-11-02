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

/** Package id of the core concepts pages; always allowed, listed before every package. */
export const CONCEPTS_PACKAGE = "concepts";

/**
 * The docs package order: `concepts` first, then the family in data order.
 *
 * @param packageIds - Package ids in display order, from `src/data/packages.ts`.
 * @returns Every id a docs folder may use, in nav and prev/next order.
 * @example
 * ```ts
 * documentationPackageOrder(["core", "web"]); // ["concepts", "core", "web"]
 * ```
 */
export function documentationPackageOrder(packageIds: readonly string[]): string[] {
  return [CONCEPTS_PACKAGE, ...packageIds.filter(id => id !== CONCEPTS_PACKAGE)];
}

/**
 * Map a file under the docs dir to its URL location.
 *
 * @param relativeFile - Path relative to the docs dir with `/` separators, e.g. `web/guides/routing.md`.
 * @param knownPackages - Package ids allowed as the first segment.
 * @param shownFile - The file as named in error messages, e.g. `content/docs/web/guides/routing.md`.
 * @returns The URL path, package, section and slug of the file.
 * @throws {Error} When the file is not in a package folder, is deeper than `<pkg>/<section>/<page>`, or its package is unknown.
 * @example
 * ```ts
 * locateDocument("web/guides/routing.md", ["web"], "content/docs/web/guides/routing.md");
 * // { path: "/docs/web/guides/routing/", pkg: "web", section: "guides", slug: "routing" }
 * ```
 */
export function locateDocument(
  relativeFile: string,
  knownPackages: readonly string[],
  shownFile: string
): DocumentLocation {
  const segments = relativeFile.replace(/\.md$/, "").split("/");
  const [pkg, ...rest] = segments;
  if (pkg === undefined || rest.length === 0) {
    throw new Error(
      `[docs] ${shownFile} is not inside a package folder.\n  Move it to <pkg>/<page>.md.`
    );
  }
  if (rest.length > 2) {
    throw new Error(
      `[docs] ${shownFile} is deeper than <pkg>/<section>/<page>.\n  Move it to at most <pkg>/<section>/<page>.md.`
    );
  }
  if (!knownPackages.includes(pkg)) {
    throw new Error(
      `[docs] ${shownFile} is in the unknown package folder "${pkg}".\n  Use a package id from src/data/packages.ts or "${CONCEPTS_PACKAGE}".`
    );
  }
  const [first = "", second] = rest;
  if (second !== undefined) {
    return { path: `/docs/${pkg}/${first}/${second}/`, pkg, section: first, slug: second };
  }
  const path = first === "index" ? `/docs/${pkg}/` : `/docs/${pkg}/${first}/`;
  return { path, pkg, section: undefined, slug: first };
}
