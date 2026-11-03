import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const documentsDirectory = path.resolve(import.meta.dirname, "..", "..", "content", "docs");

/** Three or more dot-separated numbers: the shape of a package version. */
const VERSION = /\d+(?:\.\d+){2,}/g;

/** A number group that has the shape of a version but is allowed in the docs. */
type Allowed = {
  /** The text, with enough context to match nothing else. */
  match: RegExp;
  /** Why it is not a typed package version. */
  reason: string;
};

/** The only number groups the docs may type (D1). Every entry says why. */
const ALLOWED: readonly Allowed[] = [
  {
    match: /\b127\.0\.0\.1\b/g,
    reason: "the loopback address the editor server binds to: an address, not a version"
  },
  {
    match: /\b192\.168\.\d+\.\d+\b/g,
    reason: "a LAN address in the sample output of the dev server: an address, not a version"
  },
  {
    match: /\bBun 1\.3\.14\b/g,
    reason:
      "the Bun runtime floor of the Claude plugin's requirements, not a version of a Moku package"
  }
];

describe("typed versions in the docs", () => {
  // Bug: a page types a package version, which goes stale on the next release (D1: versions
  // come from node_modules at build, never from the text).
  it("no page under content/docs types a version string", async () => {
    const entries = await readdir(documentsDirectory, { recursive: true });
    const files = entries.filter(entry => entry.endsWith(".md")).toSorted();
    const found: string[] = [];
    for (const file of files) {
      const markdown = await readFile(path.join(documentsDirectory, file), "utf8");
      for (const [index, line] of markdown.split("\n").entries()) {
        let rest = line;
        for (const allowed of ALLOWED) rest = rest.replaceAll(allowed.match, "");
        for (const [version] of rest.matchAll(VERSION)) {
          found.push(`${file}:${index + 1} ${version}`);
        }
      }
    }

    expect(found).toEqual([]);
  });
});
