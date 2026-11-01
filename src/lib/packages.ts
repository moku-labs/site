/**
 * @file Resolves the package family with versions read from the installed packages.
 *
 * Build-time only (Node). A version is never typed by hand: it comes from
 * `node_modules/<npm>/package.json`, so the site cannot drift from what npm ships.
 */
import type { PackageEntry } from "../data/packages";

/** A package entry with its resolved version. */
export type ResolvedPackage = PackageEntry & {
  /** Installed version, or `manualVersion` for packages that are not on npm. */
  version: string;
};

/**
 * Attach the installed version to every package entry.
 *
 * @param _entries - The family from `src/data/packages.ts`.
 * @param _nodeModulesDirectory - Directory holding the installed packages.
 * @throws {Error} When a package is not installed or a manual version is missing.
 */
export function resolvePackages(
  _entries: readonly PackageEntry[],
  _nodeModulesDirectory: string
): ResolvedPackage[] {
  throw new Error("not implemented");
}
