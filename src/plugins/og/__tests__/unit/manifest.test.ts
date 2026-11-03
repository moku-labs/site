import { describe, expect, it } from "vitest";
import { cardHash, planCards, renderManifest } from "../../manifest";
import type { OgCard } from "../../types";

const card: OgCard = {
  path: "/docs/web/",
  file: "docs/web.png",
  title: "web",
  meta: { name: "@moku-labs/web", version: "2.4.15", section: undefined },
  line: "Static site + islands SPA.",
  object: {
    kind: "art",
    pieces: [{ id: "icon-web-512", left: 664, top: 60, width: 512, height: 512 }]
  }
};
const other: OgCard = { ...card, path: "/about/", file: "about.png", title: "About" };

describe("cardHash", () => {
  // Bug: an input is left out of the hash, and a changed card is never redrawn, so a shared link
  // shows an old title, line, version or icon.
  it.each([
    ["title", { ...card, title: "other" }],
    ["line", { ...card, line: "other" }],
    [
      "version",
      { ...card, meta: { name: "@moku-labs/web", version: "9.9.9", section: undefined } }
    ],
    [
      "art id",
      {
        ...card,
        object: {
          kind: "art",
          pieces: [{ id: "icon-ai-512", left: 664, top: 60, width: 512, height: 512 }]
        }
      }
    ]
  ] satisfies [string, OgCard][])("changes when the %s changes", (_, changed) => {
    expect(cardHash(changed)).not.toBe(cardHash(card));
  });

  // Bug: a layout change keeps every old hash, and `bun run og` keeps every old drawing.
  it("changes when the layout version changes", () => {
    expect(cardHash(card, 2)).not.toBe(cardHash(card, 3));
  });

  // Bug: the file name is hashed, and renaming a page redraws a card that looks the same.
  it("ignores where the card is written", () => {
    expect(cardHash({ ...card, path: "/x/", file: "x.png" })).toBe(cardHash(card));
  });
});

describe("planCards", () => {
  const current = { [card.file]: cardHash(card), [other.file]: cardHash(other) };

  // Bug: an unchanged card is drawn again on every run, and the diff of a small change is huge.
  it("keeps a card whose hash matches and whose file exists", () => {
    const plan = planCards([card, other], current, new Set([card.file, other.file]));

    expect(plan.draw).toEqual([]);
    expect(plan.keep).toEqual([card, other]);
    expect(plan.orphans).toEqual([]);
  });

  // Bug: a bumped version keeps the old card.
  it("draws a card whose hash changed", () => {
    const plan = planCards(
      [card, other],
      { ...current, [card.file]: "stale" },
      new Set([card.file, other.file])
    );

    expect(plan.draw).toEqual([card]);
    expect(plan.keep).toEqual([other]);
  });

  // Bug: a deleted PNG stays missing forever because the manifest still lists it.
  it("draws a card whose file is missing", () => {
    expect(planCards([card], current, new Set()).draw).toEqual([card]);
  });

  // Bug: a new page never gets a card because the manifest has no entry to compare.
  it("draws a card the manifest does not know", () => {
    expect(planCards([card], {}, new Set([card.file])).draw).toEqual([card]);
  });

  // Bug: the PNG of a deleted page stays in git and ships for ever.
  it("lists a file no card owns as an orphan", () => {
    const plan = planCards([card], current, new Set([card.file, "docs/gone.png"]));

    expect(plan.orphans).toEqual(["docs/gone.png"]);
  });
});

describe("renderManifest", () => {
  // Bug: the keys follow the card order, and adding one page reorders the whole file in the diff.
  it("sorts the keys by card file and ends with a newline", () => {
    const text = renderManifest([card, other]);

    expect(Object.keys(JSON.parse(text) as object)).toEqual(["about.png", "docs/web.png"]);
    expect(text.endsWith("}\n")).toBe(true);
    expect(JSON.parse(text)).toEqual({
      "about.png": cardHash(other),
      "docs/web.png": cardHash(card)
    });
  });
});
