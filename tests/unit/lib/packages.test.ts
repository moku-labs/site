import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PackageEntry } from "../../../src/data/packages";
import { resolvePackages } from "../../../src/lib/packages";

const installed = path.join(import.meta.dirname, "fixtures", "installed");

const web: PackageEntry = {
  id: "web",
  name: "@moku-labs/web",
  npm: "@moku-labs/web",
  tagline: "Web framework.",
  group: "Frameworks"
};

const claude: PackageEntry = {
  id: "claude",
  name: "Moku for Claude Code",
  // oxlint-disable-next-line unicorn/no-null -- PackageEntry marks "not on npm" with null.
  npm: null,
  manualVersion: "0.48.0",
  tagline: "Claude Code plugin.",
  group: "Tooling"
};

describe("resolvePackages", () => {
  // Bug: a version typed in the data (manualVersion) wins over the installed one.
  it("reads the version of an npm package from its installed package.json", () => {
    const typed: PackageEntry = { ...web, manualVersion: "0.0.1" };

    expect(resolvePackages([typed, claude], installed)).toEqual([
      { ...typed, version: "9.8.7", versionLabel: "9.8.7" },
      { ...claude, version: "0.48.0", versionLabel: "0.48.0" }
    ]);
  });

  // Bug: a package that is not on npm is looked up in node_modules and crashes the build.
  it("uses manualVersion for a package that is not on npm", () => {
    expect(resolvePackages([claude], installed)[0]?.version).toBe("0.48.0");
  });

  // Bug: the Claude plugin shows a bare "0.85.6" instead of the release it ships as.
  it("prefixes the version label with the release name", () => {
    const named: PackageEntry = { ...claude, releaseName: "moku" };

    expect(resolvePackages([named], installed)[0]).toMatchObject({
      version: "0.48.0",
      versionLabel: "moku 0.48.0"
    });
  });

  // Bug: a package with no npm name and no manualVersion renders "undefined" on the site.
  it("throws when a package that is not on npm has no manualVersion", () => {
    const { manualVersion: _dropped, ...bare } = claude;

    expect(() => resolvePackages([bare], installed)).toThrow(
      '[site] package "claude" has no manualVersion.\n  Set manualVersion in src/data/packages.ts: the package is not on npm.'
    );
  });

  // Bug: a missing install fails with a bare ENOENT that does not say which package.
  it("throws naming the npm package when it is not installed", () => {
    const missing: PackageEntry = { ...web, id: "game", npm: "@moku-labs/game" };

    expect(() => resolvePackages([missing], installed)).toThrow(
      /^\[site\] package "@moku-labs\/game" is not installed\.\n {2}Add "@moku-labs\/game" to package\.json and run bun install\.$/
    );
  });

  // Bug: a package.json without a version renders "undefined" on the site.
  it("throws when the installed package.json has no version", () => {
    const broken: PackageEntry = { ...web, id: "broken", npm: "no-version" };

    expect(() => resolvePackages([broken], installed)).toThrow(
      '[site] package "no-version" has no version in its package.json.'
    );
  });
});
