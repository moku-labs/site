/**
 * @file The layout of a card as a Satori tree. Pure: words and art arrive as data, nothing is read.
 * Every number is from the design context, §2 and §5.
 */
import { SITE } from "../../config";
import { columnWidth, titleSize } from "./text";
import type { OgCard, OgMeta } from "./types";

/**
 * Bump this after a change to this file or to `svg.ts`: it is part of every card's hash, so the
 * next `bun run og` redraws all cards.
 */
export const OG_LAYOUT_VERSION = 1;

/** The font family names the tree uses; `render.ts` registers the faces under them. */
export const OG_FONT = { title: "Title", body: "Body", mono: "Mono" } as const;

/** Title and strong text colour. */
const INK = "#f6f3ff";

/** Line, section and domain colour. */
const SOFT_INK = "#cfc9ec";

/** Size of the meta row and the foot's text. */
const SMALL_TEXT = 28;

/** The title's tracking, as a share of its size. */
const TITLE_TRACKING = -0.03;

/** The domain in the card's foot. */
const DOMAIN = new URL(SITE.url).host;

/** One CSS value of a Satori style. */
type StyleValue = string | number;

/** A node of the tree Satori draws. */
export type OgNode = {
  /** Element name. */
  type: "div" | "img";
  /** Style, content and image source. */
  props: {
    /** Inline style. */
    style: Readonly<Record<string, StyleValue>>;
    /** Text or child nodes. */
    children?: string | readonly OgNode[];
    /** Data URI of an image. */
    src?: string;
    /** Drawn width of an image. */
    width?: number;
    /** Drawn height of an image. */
    height?: number;
  };
};

/** Size and position of an image on the card. */
type Spot = {
  /** Distance from the left edge. */
  left: number;
  /** Distance from the top edge. */
  top: number;
  /** Drawn width. */
  width: number;
  /** Drawn height. */
  height: number;
};

/** An image of the card's object: a data URI and its place. */
export type OgPlacedImage = Spot & {
  /** PNG data URI. */
  src: string;
};

/** The images a card shows, as PNG data URIs. */
export type OgAssets = {
  /** Floor and glow, 1200x630. */
  background: string;
  /** The logo cube. */
  logo: string;
  /** The object on the right, in drawing order. */
  objects: readonly OgPlacedImage[];
};

/**
 * A box with text or child nodes.
 *
 * @param style - Inline style.
 * @param children - Text or nodes.
 * @returns The node.
 */
function box(style: OgNode["props"]["style"], children: string | readonly OgNode[]): OgNode {
  return { type: "div", props: { style, children } };
}

/**
 * An image placed on the card.
 *
 * @param src - Data URI.
 * @param spot - Its size and position.
 * @returns The node.
 */
function placed(src: string, spot: Spot): OgNode {
  const { left, top, width, height } = spot;
  return { type: "img", props: { src, width, height, style: { position: "absolute", left, top } } };
}

/**
 * The meta row: package name, version chip, section. The name never shrinks.
 *
 * @param meta - The row's content.
 * @returns The node.
 */
function metaRow(meta: OgMeta): OgNode {
  const nodes: OgNode[] = [
    box({ flexShrink: 0, fontFamily: OG_FONT.mono, fontSize: SMALL_TEXT, color: INK }, meta.name)
  ];
  if (meta.version !== undefined) {
    nodes.push(
      box(
        {
          display: "flex",
          marginLeft: 14,
          padding: "4px 13px",
          border: "2px solid rgba(255,92,138,.55)",
          borderRadius: 10,
          backgroundColor: "rgba(255,46,99,.13)",
          fontFamily: OG_FONT.mono,
          fontSize: SMALL_TEXT,
          color: "#ff86a8"
        },
        meta.version
      )
    );
  }
  if (meta.section !== undefined) {
    nodes.push(
      box(
        {
          display: "flex",
          marginLeft: 20,
          paddingLeft: 20,
          borderLeft: "2px solid #3b3270",
          fontFamily: OG_FONT.body,
          fontWeight: 500,
          fontSize: SMALL_TEXT,
          color: SOFT_INK
        },
        meta.section
      )
    );
  }
  return box({ display: "flex", alignItems: "center", marginTop: 24, height: 48 }, nodes);
}

/**
 * The upper part of the text column: title, meta row, line.
 *
 * @param card - The card.
 * @returns The node.
 */
function textBlock(card: OgCard): OgNode {
  const size = titleSize(card.title);
  const title = box(
    {
      display: "block",
      lineClamp: 3,
      fontFamily: OG_FONT.title,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1.08,
      letterSpacing: TITLE_TRACKING * size,
      color: INK
    },
    card.title
  );
  const line = box(
    {
      display: "block",
      lineClamp: 2,
      marginTop: 24,
      fontFamily: OG_FONT.body,
      fontWeight: 400,
      fontSize: 39,
      lineHeight: 1.26,
      color: SOFT_INK
    },
    card.line
  );
  const rows = card.meta === undefined ? [title, line] : [title, metaRow(card.meta), line];
  return box({ display: "flex", flexDirection: "column" }, rows);
}

/**
 * The foot of the text column: logo cube and domain.
 *
 * @param logo - Data URI of the logo.
 * @returns The node.
 */
function foot(logo: string): OgNode {
  const cube: OgNode = {
    type: "img",
    props: { src: logo, width: 42, height: 44, style: { position: "relative" } }
  };
  const domain = box(
    {
      marginLeft: 14,
      fontFamily: OG_FONT.body,
      fontWeight: 500,
      fontSize: SMALL_TEXT,
      color: SOFT_INK
    },
    DOMAIN
  );
  return box({ display: "flex", alignItems: "center" }, [cube, domain]);
}

/**
 * The tree of one card, ready for Satori.
 *
 * @param card - The card.
 * @param assets - Its images as data URIs.
 * @returns The root node of 1200x630.
 * @example
 * ```ts
 * const card = { path: "/", file: "home.png", title: "Moku", meta: undefined, line: "Hi.", object: { kind: "cluster" } } as const;
 * cardTree(card, { background: "a", logo: "b", objects: [] }).props.style.width; // 1200
 * ```
 */
export function cardTree(card: OgCard, assets: OgAssets): OgNode {
  const column = box(
    {
      position: "absolute",
      left: 64,
      top: 64,
      width: columnWidth(card.title),
      height: 502,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    },
    [textBlock(card), foot(assets.logo)]
  );
  return box(
    {
      position: "relative",
      display: "flex",
      width: 1200,
      height: 630,
      color: INK,
      backgroundColor: "#0f0c1e"
    },
    [
      placed(assets.background, { left: 0, top: 0, width: 1200, height: 630 }),
      ...assets.objects.map(image => placed(image.src, image)),
      column
    ]
  );
}
