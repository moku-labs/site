import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../../../../app";
import { planCards } from "../../manifest";
import type { OgCard, OgManifest } from "../../types";

// No drawing: the cards are committed, and neither CI nor the build ever draws them.
const REPAIR = "run bun run og and commit public/og and src/data/og-manifest.json";
const OUT_DIRECTORY = path.join("public", "og");
const MANIFEST = path.join("src", "data", "og-manifest.json");
// `cards()` loads every docs page. A busy CI runner can stall that past the default 10 s.
const LOAD_TIMEOUT = 120_000;

/**
 * The PNG files under the committed card folder.
 *
 * @returns Paths relative to that folder.
 */
function committedFiles(): Set<string> {
  const entries = existsSync(OUT_DIRECTORY)
    ? readdirSync(OUT_DIRECTORY, { recursive: true, withFileTypes: true })
    : [];
  return new Set(
    entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".png"))
      .map(entry => path.relative(OUT_DIRECTORY, path.join(entry.parentPath, entry.name)))
  );
}

describe("committed share cards", () => {
  let cards: OgCard[] = [];
  let manifest: OgManifest = {};

  beforeAll(async () => {
    // A card reads the frontmatter, never the HTML, and rendering every page is slow.
    vi.spyOn(app.content, "renderMarkdown").mockResolvedValue("");
    cards = await app.og.cards();
    manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  }, LOAD_TIMEOUT);

  // Bug: a new page, a changed title or a bumped version ships an old or missing card, because
  // nothing but a person remembers `bun run og`.
  it("has a card file with a matching hash for every page", () => {
    const { draw } = planCards(cards, manifest, committedFiles());

    expect(
      draw.map(card => card.file),
      REPAIR
    ).toEqual([]);
  });

  // Bug: the PNG of a removed page stays in git and in every deploy.
  it("has no card file without a page", () => {
    const { orphans } = planCards(cards, manifest, committedFiles());

    expect(orphans, REPAIR).toEqual([]);
  });
});
