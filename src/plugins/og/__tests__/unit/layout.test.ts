import { describe, expect, it } from "vitest";
import type { OgNode } from "../../layout";
import { cardTree } from "../../layout";
import type { OgCard, OgMeta } from "../../types";

const assets = {
  background: "background",
  logo: "logo",
  objects: [
    { src: "first", left: 1, top: 2, width: 3, height: 4 },
    { src: "second", left: 5, top: 6, width: 7, height: 8 }
  ]
};

/**
 * A card with a given meta row.
 *
 * @param meta - The meta row.
 * @returns The card.
 */
function card(meta: OgMeta | undefined): OgCard {
  return {
    path: "/x/",
    file: "x.png",
    title: "Title",
    meta,
    line: "Line.",
    object: { kind: "cluster" }
  };
}

/**
 * Every text of a tree, in drawing order. A box with nothing in it counts: it draws as an empty chip.
 *
 * @param node - The tree.
 * @returns The texts.
 */
function texts(node: OgNode): string[] {
  if (node.type === "img") return [];
  const { children } = node.props;
  if (children === undefined) return ["(empty box)"];
  return typeof children === "string" ? [children] : children.flatMap(child => texts(child));
}

describe("cardTree", () => {
  // Bug: a site card gets an empty meta row, which pushes its line down.
  it("draws no meta row when the card has none", () => {
    expect(texts(cardTree(card(undefined), assets))).toEqual(["Title", "Line.", "moku-labs.com"]);
  });

  // Bug: a concepts card shows an empty version chip and an empty section after a divider.
  it("draws only the name of a concepts card", () => {
    const meta = { name: "concepts", version: undefined, section: undefined };

    expect(texts(cardTree(card(meta), assets))).toEqual([
      "Title",
      "concepts",
      "Line.",
      "moku-labs.com"
    ]);
  });

  // Bug: the meta row is drawn in another order, or below the line.
  it("draws title, name, version, section, line and domain in that order", () => {
    const meta = { name: "@moku-labs/web", version: "2.4.15", section: "Guides" };

    expect(texts(cardTree(card(meta), assets))).toEqual([
      "Title",
      "@moku-labs/web",
      "2.4.15",
      "Guides",
      "Line.",
      "moku-labs.com"
    ]);
  });

  // Bug: the text column is drawn first, and a long title disappears behind the art.
  it("draws the background, then the object, then the text on top", () => {
    const { children } = cardTree(card(undefined), assets).props;
    const layers = typeof children === "string" ? [] : (children ?? []);

    expect(layers.map(layer => layer.props.src)).toEqual([
      "background",
      "first",
      "second",
      undefined
    ]);
  });
});
