/**
 * @file The share cards' frozen words and art placement as plain data.
 *
 * Numbers are PNG pixels on a 1200x630 card. The cards of docs pages take their words from the docs
 * and the family: only the site pages are written here.
 */

/** One art file of `public/art` placed on a card. */
export type OgArtPiece = {
  /** File name in `public/art` without extension, e.g. `icon-web-512`. */
  id: string;
  /** Distance from the card's left edge. */
  left: number;
  /** Distance from the card's top edge. */
  top: number;
  /** Drawn width. */
  width: number;
  /** Drawn height. */
  height: number;
};

/** The lit object on the right of a card: the drawn cube cluster, or art files. */
export type OgObject =
  | {
      /** The kernel's cube cluster, drawn from code. */
      kind: "cluster";
    }
  | {
      /** One or more art files. */
      kind: "art";
      /** The files, in drawing order. */
      pieces: readonly OgArtPiece[];
    };

/** The card of a page outside the docs tree. */
export type OgSiteCard = {
  /** URL path of the page. */
  path: string;
  /** Card title. */
  title: string;
  /** Card line, written to fit: the line rule does not touch it. */
  line: string;
  /** The object on the right. */
  object: OgObject;
};

/** Where the single object of a package card or the about card sits. */
export const OG_SINGLE_OBJECT = { left: 664, top: 60, width: 512, height: 512 } as const;

/** Where the drawn cube cluster sits. */
export const OG_CLUSTER_SPOT = { left: 704, top: 64, width: 432, height: 502 } as const;

/**
 * The cards of the home, docs hub, demos and about pages.
 *
 * @example
 * ```ts
 * OG_SITE_CARDS.map(card => card.path); // ["/", "/docs/", "/demos/", "/about/"]
 * ```
 */
export const OG_SITE_CARDS: readonly OgSiteCard[] = [
  {
    path: "/",
    title: "Moku",
    line: "LLMs write the plugins. A micro-kernel checks them.",
    object: { kind: "cluster" }
  },
  {
    path: "/docs/",
    title: "Docs",
    line: "Every package, checked against its release.",
    object: {
      kind: "art",
      pieces: [
        { id: "icon-core-512", left: 800, top: 10, width: 300, height: 300 },
        { id: "icon-web-512", left: 660, top: 160, width: 300, height: 300 },
        { id: "icon-game-512", left: 900, top: 170, width: 300, height: 300 },
        { id: "icon-worker-512", left: 780, top: 320, width: 300, height: 300 }
      ]
    }
  },
  {
    path: "/demos/",
    title: "Demos",
    line: "Six apps on Moku, mostly written by an agent.",
    object: {
      kind: "art",
      pieces: [
        { id: "demo-tracker-960", left: 628, top: 38, width: 450, height: 300 },
        { id: "demo-atlas-960", left: 775, top: 46, width: 430, height: 287 },
        { id: "demo-timber-town-960", left: 612, top: 218, width: 600, height: 400 }
      ]
    }
  },
  {
    path: "/about/",
    title: "About",
    line: "Alex Kucherenko builds Moku.",
    object: { kind: "art", pieces: [{ id: "about-portrait", ...OG_SINGLE_OBJECT }] }
  }
];
