import { describe, expect, it } from "vitest";
import { packageBumps } from "../../../src/lib/package-bumps";

/**
 * A `package.json` text with the given dependency fields.
 *
 * @param fields - The manifest's fields.
 * @returns The JSON text.
 */
function manifest(fields: Record<string, Record<string, string>>): string {
  return JSON.stringify({ name: "site", ...fields });
}

describe("packageBumps", () => {
  // Bug: the agent is sent to read release notes of a package whose version did not move.
  it("names only the moku packages whose version changed", () => {
    const before = manifest({
      devDependencies: { "@moku-labs/game": "^0.15.92", "@moku-labs/web": "^2.4.19" }
    });
    const after = manifest({
      devDependencies: { "@moku-labs/game": "^0.15.95", "@moku-labs/web": "^2.4.19" }
    });
    expect(packageBumps(before, after)).toEqual([
      { name: "@moku-labs/game", from: "0.15.92", to: "0.15.95" }
    ]);
  });

  // Bug: a third-party bump in the same manifest sends the agent to docs the site does not have.
  it("ignores packages outside the moku scope", () => {
    const before = manifest({ devDependencies: { vitest: "^4.0.0" } });
    const after = manifest({ devDependencies: { vitest: "^4.1.0" } });
    expect(packageBumps(before, after)).toEqual([]);
  });

  // Bug: a moku package in `dependencies` or `peerDependencies` is missed, and its docs go stale.
  it("reads every dependency field", () => {
    const before = manifest({
      dependencies: { "@moku-labs/web": "2.4.19" },
      peerDependencies: { "@moku-labs/system": "~0.3.7" }
    });
    const after = manifest({
      dependencies: { "@moku-labs/web": "2.5.0" },
      peerDependencies: { "@moku-labs/system": "~0.3.8" }
    });
    expect(packageBumps(before, after)).toEqual([
      { name: "@moku-labs/system", from: "0.3.7", to: "0.3.8" },
      { name: "@moku-labs/web", from: "2.4.19", to: "2.5.0" }
    ]);
  });

  // Bug: a package added by hand is reported as a bump from `undefined`.
  it("does not report a package that is new on the branch", () => {
    const before = manifest({ devDependencies: {} });
    const after = manifest({ devDependencies: { "@moku-labs/room": "^0.8.18" } });
    expect(packageBumps(before, after)).toEqual([]);
  });

  // Bug: a package dropped on the branch is reported as a bump to `undefined`.
  it("does not report a package removed on the branch", () => {
    const before = manifest({ devDependencies: { "@moku-labs/room": "^0.8.10" } });
    const after = manifest({ devDependencies: {} });
    expect(packageBumps(before, after)).toEqual([]);
  });
});
