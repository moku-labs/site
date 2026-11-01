/**
 * @file The Moku package family as plain data: names, taglines, groups and order.
 *
 * Versions are NOT stored here. They are read from the installed packages at build
 * (`src/lib/packages.ts`), so a version on the site can never drift from npm.
 */

/** The docs group a package is listed under. */
export type PackageGroup = "Start" | "Core" | "Frameworks" | "Native" | "Game" | "Tooling";

/** One package of the family, without its version. */
export type PackageEntry = {
  /** Short id used in URLs and file names, e.g. `web`. */
  id: string;
  /** Display name, e.g. `@moku-labs/web`. */
  name: string;
  /** npm package name, or `null` when the package is not on npm (the Claude plugin). */
  npm: string | null;
  /** Version for packages that are not on npm. Ignored when `npm` is set. */
  manualVersion?: string;
  /** One-line tagline shown on cards and in the docs hub. */
  tagline: string;
  /** Docs group. */
  group: PackageGroup;
};

/**
 * The family in display order. Filled with the real entries in the data wave.
 *
 * @example
 * ```ts
 * packages.map(entry => entry.id); // ["claude", "core", "common", "web", ...]
 * ```
 */
export const packages: readonly PackageEntry[] = [];
