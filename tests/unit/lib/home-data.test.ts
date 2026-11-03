import { describe, expect, it } from "vitest";
import { goals } from "../../../src/data/assembly";
import type { PackageEntry } from "../../../src/data/packages";
import { loadHome } from "../../../src/lib/home-data";
import type { ResolvedPackage } from "../../../src/lib/packages";

/**
 * One installed package of the family.
 *
 * @param id - Package id.
 * @param version - Its installed version.
 * @param group - Its docs group.
 * @returns The resolved package.
 */
function installed(id: string, version: string, group: PackageEntry["group"]): ResolvedPackage {
  const npm = `@moku-labs/${id}`;
  return { id, name: npm, npm, tagline: `${id}.`, group, version, versionLabel: version };
}

const packages: ResolvedPackage[] = [
  {
    id: "claude",
    name: "Claude plugin",
    // oxlint-disable-next-line unicorn/no-null -- PackageEntry marks "not on npm" with null.
    npm: null,
    manualVersion: "0.85.6",
    tagline: "Conductor.",
    group: "Start",
    version: "0.85.6",
    versionLabel: "moku 0.85.6"
  },
  installed("core", "1.0.1", "Core"),
  installed("common", "2.0.2", "Core"),
  installed("web", "3.0.3", "Frameworks"),
  installed("worker", "4.0.4", "Frameworks"),
  installed("game", "5.0.5", "Game")
];

/** Sources with a renderer that records what it was given. */
function sources() {
  const rendered: string[] = [];
  return {
    rendered,
    input: {
      content: {
        renderMarkdown: async (markdown: string) => {
          rendered.push(markdown);
          return "<figure>code</figure>";
        }
      },
      packages
    }
  };
}

describe("loadHome", () => {
  // Bug: a version on the hero is typed, or read from the wrong package (D1), or the hero gets
  // another set of goals than the island's data.
  it("hands the hero the three goals and the installed versions of each package it shows", async () => {
    const view = await loadHome(sources().input);

    expect(view.hero.goals).toBe(goals);
    expect(view.hero.versions).toEqual({
      core: "1.0.1",
      common: "2.0.2",
      web: "3.0.3",
      worker: "4.0.4",
      game: "5.0.5"
    });
    expect(view.claude.version).toBe("0.85.6");
  });

  // Bug: a package missing from the family throws or shows "undefined" on the hero, instead of an
  // empty version.
  it("gives an empty version for a package missing from the family", async () => {
    const family = packages.filter(entry => entry.id !== "game");
    const view = await loadHome({ ...sources().input, packages: family });

    expect(view.hero.versions.game).toBe("");
  });

  // Bug: the layers code skips the docs pipeline and ships unhighlighted, or loses its file tab.
  it("renders the layers code through the Markdown pipeline with its file name", async () => {
    const { input, rendered } = sources();
    const view = await loadHome(input);

    expect(view.layersCode).toBe("<figure>code</figure>");
    expect(rendered[0]).toMatch(/^```ts file="my-site\.ts"/);
    expect(rendered[0]?.split("\n")).toHaveLength(5);
  });
});
