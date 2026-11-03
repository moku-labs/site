import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../../../../app";
import { packages } from "../../../../data/packages";
import type { ResolvedPackage } from "../../../../lib/packages";
import { buildCards } from "../../cards";
import type { OgCard, OgPage } from "../../types";

const web: ResolvedPackage = {
  id: "web",
  name: "@moku-labs/web",
  npm: "@moku-labs/web",
  tagline: "Static site + islands SPA. Same render at build and in the browser",
  group: "Frameworks",
  version: "2.4.15",
  versionLabel: "2.4.15"
};

const claude: ResolvedPackage = {
  id: "claude",
  name: "Claude plugin",
  // oxlint-disable-next-line unicorn/no-null -- PackageEntry marks "not on npm" with null.
  npm: null,
  releaseName: "moku",
  manualVersion: "0.85.6",
  tagline: "A conductor in Claude Code: idea → plan → build → verify → release, on rails",
  group: "Start",
  version: "0.85.6",
  versionLabel: "moku 0.85.6"
};

/**
 * A docs page with the fields a card reads.
 *
 * @param overrides - The fields that differ from a plain page of `web`.
 * @returns The page.
 */
function page(overrides: Partial<OgPage> = {}): OgPage {
  return {
    path: "/docs/web/quick-start/",
    pkg: "web",
    slug: "quick-start",
    section: undefined,
    group: "Get started",
    title: "Quick start",
    description: "From an empty folder to a deployed static blog with client navigation.",
    ...overrides
  };
}

/**
 * Build the one card of a page.
 *
 * @param overrides - The fields that differ from a plain page of `web`.
 * @param family - The resolved family.
 * @returns The page's card.
 */
function cardOf(overrides: Partial<OgPage>, family: ResolvedPackage[] = [web, claude]): OgCard {
  const pagePath = overrides.path ?? page().path;
  const card = buildCards([page(overrides)], family).find(item => item.path === pagePath);
  if (card === undefined) throw new Error(`no card for ${pagePath}`);
  return card;
}

/**
 * The art files a card shows.
 *
 * @param card - The card.
 * @returns The art ids, empty for the drawn cluster.
 */
function artIds(card: OgCard): string[] {
  return card.object.kind === "art" ? card.object.pieces.map(piece => piece.id) : [];
}

/**
 * The latin subset of one fontsource package, from its own `unicode.json`.
 *
 * @param face - The fontsource package name.
 * @returns A check that a character is inside the subset.
 */
function latinSubset(face: string): (character: string) => boolean {
  const file = path.join("node_modules", "@fontsource", face, "unicode.json");
  const { latin } = JSON.parse(readFileSync(file, "utf8")) as { latin: string };
  const ranges = latin.split(",").map(range => {
    const [first = "", last = first] = range.replace("U+", "").split("-");
    return [Number.parseInt(first, 16), Number.parseInt(last, 16)] as const;
  });
  return character => {
    const code = character.codePointAt(0) ?? 0;
    return ranges.some(([first, last]) => code >= first && code <= last);
  };
}

const packageHome: Partial<OgPage> = {
  path: "/docs/web/",
  slug: "index",
  title: "@moku-labs/web",
  description: "Content static-site generator."
};

describe("buildCards", () => {
  // Bug: a site page has no card, so its `og:image` is a 404. Rows A1, A2, A6, A7.
  it("makes a card for the home, docs hub, demos and about pages", () => {
    expect(
      buildCards([], [web])
        .map(card => card.path)
        .toSorted()
    ).toEqual(["/", "/about/", "/demos/", "/docs/"]);
  });

  // Bug: the home card shows a package icon or a line that is not the frozen one.
  it("draws the home card with the frozen line and the cube cluster", () => {
    const home = buildCards([], [web]).find(card => card.path === "/");

    expect(home?.file).toBe("home.png");
    expect(home?.line).toBe("LLMs write the plugins. A micro-kernel checks them.");
    expect(home?.meta).toBeUndefined();
    expect(home?.object).toEqual({ kind: "cluster" });
  });

  // Bug: a package home shows the page's title and description instead of the id and tagline, or
  // shows the nav group "Get started" in the meta row. Row A3.
  it("titles a package home with the id, its tagline by the line rule, no section", () => {
    const card = cardOf(packageHome);

    expect(card.title).toBe("web");
    expect(card.line).toBe("Static site + islands SPA.");
    expect(card.meta).toEqual({ name: "@moku-labs/web", version: "2.4.15", section: undefined });
  });

  // Bug: the Claude plugin shows its display name or a doubled `moku moku 0.85.6` chip. Row A3.
  it("shows the Claude plugin as moku with its manual version", () => {
    const card = cardOf({ ...packageHome, path: "/docs/claude/", pkg: "claude", title: "Claude" });

    expect(card.meta).toEqual({ name: "moku", version: "0.85.6", section: undefined });
    expect(card.line).toBe("A conductor in Claude Code");
  });

  // Bug: a package off npm with no release name has an empty name in the meta row.
  it("falls back to the display name for a package with no npm and no release name", () => {
    const local: ResolvedPackage = { ...claude, id: "local", name: "Local tool" };
    delete local.releaseName;
    const card = cardOf({ ...packageHome, path: "/docs/local/", pkg: "local" }, [local]);

    expect(card.meta?.name).toBe("Local tool");
  });

  // Bug: a docs page loses its nav group or version, or its description is not shortened. Row A4.
  it("gives a docs page its title, package, version, nav group and short line", () => {
    const card = cardOf({ section: "guides", group: "Guides" });

    expect(card.title).toBe("Quick start");
    expect(card.meta).toEqual({ name: "@moku-labs/web", version: "2.4.15", section: "Guides" });
    expect(card.line).toBe("From an empty folder to a deployed static blog with…");
    expect(artIds(card)).toEqual(["icon-web-512"]);
  });

  // Bug: a concepts page shows the core icon and version instead of the kernel's own look. Row A5.
  it("gives a concepts page the cluster and the bare concepts label", () => {
    const card = cardOf({
      path: "/docs/concepts/events/",
      pkg: "concepts",
      group: "Concepts",
      title: "Events"
    });

    expect(card.object).toEqual({ kind: "cluster" });
    expect(card.meta).toEqual({ name: "concepts", version: undefined, section: undefined });
  });

  // Bug: a page of an unknown package gets a card with no version instead of stopping the run.
  it("refuses a page whose package is not in the family", () => {
    expect(() => buildCards([page({ pkg: "nope" })], [web])).toThrow(/package "nope"/);
  });
});

describe("the real cards", () => {
  let cards: OgCard[] = [];

  beforeAll(async () => {
    cards = await app.og.cards();
  });

  // Bug: a package of the family has no card, or falls back to another package's icon. Row A3.
  it("gives every package of the family a card with its own icon", () => {
    const missing = packages.filter(entry => {
      const card = cards.find(item => item.path === `/docs/${entry.id}/`);
      return card === undefined || artIds(card)[0] !== `icon-${entry.id}-512`;
    });

    expect(missing.map(entry => entry.id)).toEqual([]);
  });

  // Bug: a concepts page falls back to the core icon. Row A5.
  it("gives every concepts page the cluster", () => {
    const concepts = cards.filter(card => card.path.startsWith("/docs/concepts/"));

    expect(concepts.length).toBeGreaterThan(0);
    expect(concepts.filter(card => card.object.kind !== "cluster")).toEqual([]);
  });

  // Bug: a card names an art file that is not in `public/art`: `bun run og` fails after minutes.
  it("names only art files that exist", () => {
    const named = new Set(cards.flatMap(card => artIds(card)));
    const absent = [...named].filter(id => !existsSync(path.join("public", "art", `${id}.webp`)));

    expect(absent).toEqual([]);
  });

  // Bug: a text keeps a glyph outside the subset (`→` in a description): the card shows an empty
  // square. A card draws only latin woff files, so a new character fails here, before any drawing.
  it("uses only glyphs of the latin subset of each face", () => {
    const inSora = latinSubset("sora");
    const inInstrument = latinSubset("instrument-sans");
    const inMono = latinSubset("jetbrains-mono");
    const outside = cards.flatMap(card => {
      const fields: [string, (character: string) => boolean][] = [
        [card.title, inSora],
        [card.line, inInstrument],
        [card.meta?.section ?? "", inInstrument],
        [`${card.meta?.name ?? ""}${card.meta?.version ?? ""}`, inMono]
      ];
      return fields.flatMap(([text, inSubset]) =>
        [...text]
          .filter(character => !inSubset(character))
          .map(character => `${card.path}: ${character}`)
      );
    });

    expect(outside).toEqual([]);
  });
});
