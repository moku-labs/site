/**
 * @file Which `@moku-labs/*` packages a dependency bump moved, read from two `package.json` texts.
 * `scripts/update-docs.ts` names them to the docs agent, so it reads the release notes of exactly
 * those packages and nothing else.
 */

/** The family's npm scope: only these packages have docs on the site. */
const MOKU_SCOPE = "@moku-labs/";

/** A semver range prefix, dropped so `^0.15.92` and `0.15.92` read as the same version. */
const RANGE_PREFIX = /^[\^~]/;

/**
 * One package whose version range changed.
 *
 * @example
 * ```ts
 * const bump: PackageBump = { name: "@moku-labs/game", from: "0.15.92", to: "0.15.95" };
 * ```
 */
export type PackageBump = {
  /** Package name, e.g. `@moku-labs/game`. */
  name: string;
  /** Version range before the bump, without `^` or `~`. */
  from: string;
  /** Version range after the bump, without `^` or `~`. */
  to: string;
};

/** The dependency fields of a `package.json` that can name a moku package. */
type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

/**
 * Every moku package of a manifest with its version, across all dependency fields.
 *
 * @param manifestText - Raw `package.json` text.
 * @returns Package name to version, range prefix removed.
 * @example
 * ```ts
 * mokuVersions('{"dependencies":{"@moku-labs/web":"^2.4.19"}}'); // Map { "@moku-labs/web" => "2.4.19" }
 * ```
 */
function mokuVersions(manifestText: string): Map<string, string> {
  const manifest = JSON.parse(manifestText) as Manifest;
  const fields = [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies];
  const entries = fields.flatMap(field => Object.entries(field ?? {}));

  // Keep the family's packages only; the site has no docs for anything else.
  const moku = entries.filter(([name]) => name.startsWith(MOKU_SCOPE));
  return new Map(moku.map(([name, range]) => [name, range.replace(RANGE_PREFIX, "")]));
}

/**
 * The moku packages whose version changed between two manifests, sorted by name. A package added
 * or removed is not a bump: it has no "from" or no "to" to read release notes between.
 *
 * @param beforeText - `package.json` on the base branch.
 * @param afterText - `package.json` on the bump branch.
 * @returns One entry per moku package present in both manifests whose version differs, sorted by
 *   name; empty when nothing moved.
 * @example
 * ```ts
 * // Dependabot bumps game on the branch.
 * packageBumps(
 *   '{"devDependencies":{"@moku-labs/game":"^0.15.92"}}',
 *   '{"devDependencies":{"@moku-labs/game":"^0.15.95"}}'
 * ); // [{ name: "@moku-labs/game", from: "0.15.92", to: "0.15.95" }]
 * ```
 */
export function packageBumps(beforeText: string, afterText: string): PackageBump[] {
  const before = mokuVersions(beforeText);
  const after = mokuVersions(afterText);

  // A bump has a version on both sides, and the two differ.
  const bumps: PackageBump[] = [];
  for (const [name, to] of after) {
    const from = before.get(name);
    if (from !== undefined && from !== to) bumps.push({ name, from, to });
  }

  // Sorted, so the prompt and the report read the same on every run.
  return bumps.toSorted((left, right) => left.name.localeCompare(right.name));
}
