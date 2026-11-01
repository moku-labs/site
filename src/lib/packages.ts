/**
 * @file Resolves the package family with versions read from the installed packages.
 *
 * Build-time only (Node). A version is never typed by hand: it comes from
 * `node_modules/<npm>/package.json`, so the site cannot drift from what npm ships.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PackageEntry } from "../data/packages";

/** A package entry with its resolved version. */
export type ResolvedPackage = PackageEntry & {
  /** Installed version, or `manualVersion` for packages that are not on npm. */
  version: string;
};

/** The one field of an installed `package.json` the site reads. */
type InstalledManifest = {
  /** Installed version; checked before use because the file is outside our control. */
  version?: unknown;
};

/**
 * Read the installed version of one npm package.
 *
 * @param npm - npm package name, e.g. `@moku-labs/web`.
 * @param nodeModulesDirectory - Directory holding the installed packages.
 * @returns The `version` field of the installed `package.json`.
 * @throws {Error} When the package is not installed or its `package.json` has no version.
 */
function readInstalledVersion(npm: string, nodeModulesDirectory: string): string {
  const manifestPath = path.join(nodeModulesDirectory, npm, "package.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `[site] package "${npm}" is not installed.\n  Add "${npm}" to package.json and run bun install.`
    );
  }
  const manifest: InstalledManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (typeof manifest.version !== "string") {
    throw new TypeError(
      `[site] package "${npm}" has no version in its package.json.\n  Reinstall it with bun install.`
    );
  }
  return manifest.version;
}

/**
 * Pick the version of one entry: installed for npm packages, `manualVersion` otherwise.
 *
 * @param entry - One package of the family.
 * @param nodeModulesDirectory - Directory holding the installed packages.
 * @returns The version to show on the site.
 * @throws {Error} When the package is not installed or a manual version is missing.
 */
function versionOf(entry: PackageEntry, nodeModulesDirectory: string): string {
  if (entry.npm !== null) return readInstalledVersion(entry.npm, nodeModulesDirectory);
  if (entry.manualVersion === undefined) {
    throw new Error(
      `[site] package "${entry.id}" has no manualVersion.\n  Set manualVersion in src/data/packages.ts: the package is not on npm.`
    );
  }
  return entry.manualVersion;
}

/**
 * Attach the installed version to every package entry. An npm package always takes the
 * version from its installed `package.json`, even when the entry also sets `manualVersion`.
 *
 * @param entries - The family from `src/data/packages.ts`.
 * @param nodeModulesDirectory - Directory holding the installed packages.
 * @returns The entries in the same order, each with its `version`.
 * @throws {Error} When a package is not installed or a manual version is missing.
 * @example
 * ```ts
 * // At build, with @moku-labs/web 2.4.11 installed:
 * const web = { id: "web", name: "@moku-labs/web", npm: "@moku-labs/web", tagline: "Web.", group: "Frameworks" } as const;
 * resolvePackages([web], "node_modules")[0]?.version; // "2.4.11"
 * ```
 */
export function resolvePackages(
  entries: readonly PackageEntry[],
  nodeModulesDirectory: string
): ResolvedPackage[] {
  return entries.map(entry => ({ ...entry, version: versionOf(entry, nodeModulesDirectory) }));
}
