/**
 * @file Draws a card to PNG: Satori lays out the text, resvg rasterises, sharp encodes.
 *
 * Satori, resvg, sharp and the fonts load only inside {@link createCardDrawer}, so listing the cards
 * and the normal build never touch them. Satori reads no woff2, so the faces are the static `.woff`
 * files of `@fontsource/*`, not the site's fonts.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Font } from "satori";
import { OG_CLUSTER_SPOT } from "../../data/og";
import { OG_IMAGE_SIZE } from "../../lib/og-path";
import type { OgPlacedImage } from "./layout";
import { cardTree, OG_FONT } from "./layout";
import { clusterSvg, floorSvg, logoSvg } from "./svg";
import type { DrawCard, OgCard } from "./types";

/** The faces of a card, by package and file. */
const FACES = [
  { name: OG_FONT.title, weight: 700, file: "sora/files/sora-latin-700-normal.woff" },
  {
    name: OG_FONT.body,
    weight: 400,
    file: "instrument-sans/files/instrument-sans-latin-400-normal.woff"
  },
  {
    name: OG_FONT.body,
    weight: 500,
    file: "instrument-sans/files/instrument-sans-latin-500-normal.woff"
  },
  {
    name: OG_FONT.mono,
    weight: 500,
    file: "jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff"
  }
] as const;

/** The cluster and logo are drawn at twice their size on the card, so their edges stay sharp. */
const CLUSTER_RASTER_WIDTH = 864;

/** See {@link CLUSTER_RASTER_WIDTH}. */
const LOGO_RASTER_WIDTH = 84;

/** The final encoding: a palette keeps a card near 70 KB, because the cards are committed to git. */
const PNG_OPTIONS = { palette: true, quality: 90, compressionLevel: 9 } as const;

/** Where the drawer reads its files. */
export type DrawerDirectories = {
  /** The folder of the art files. */
  art: string;
  /** The folder of the installed packages. */
  nodeModules: string;
};

/**
 * PNG bytes as a data URI.
 *
 * @param png - The bytes.
 * @returns The URI.
 */
function asDataUri(png: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}

/**
 * Read the faces of a card from the installed `@fontsource/*` packages.
 *
 * @param nodeModules - The folder of the installed packages.
 * @returns The fonts, as Satori takes them.
 * @throws {Error} When a font is not installed.
 */
function loadFonts(nodeModules: string): Promise<Font[]> {
  return Promise.all(
    FACES.map(async ({ name, weight, file }) => ({
      name,
      weight,
      data: await readFile(path.join(nodeModules, "@fontsource", file))
    }))
  );
}

/**
 * Load the drawing libraries and fonts once, and return the function that draws a card.
 *
 * @param directories - Where the art and the installed packages are.
 * @returns The drawing function.
 * @throws {Error} When a font is not installed.
 * @example
 * ```ts
 * // `bun run og`: only when a card has to be drawn.
 * const draw = await createCardDrawer({ art: "public/art", nodeModules: "node_modules" });
 * const png = await draw({ path: "/", file: "home.png", title: "Moku", meta: undefined, line: "Hi.", object: { kind: "cluster" } });
 * ```
 */
export async function createCardDrawer(directories: DrawerDirectories): Promise<DrawCard> {
  // The libraries load here and nowhere else: listing the cards and the build never pay for them.
  const [{ default: satori }, { Resvg }, { default: sharp }] = await Promise.all([
    import("satori"),
    import("@resvg/resvg-js"),
    import("sharp")
  ]);
  const fonts = await loadFonts(directories.nodeModules);

  // resvg turns the SVGs below, and Satori's output, into PNG bytes.
  const rasterise = (svg: string, width: number): Uint8Array =>
    new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();

  // Many cards share these three images, so they are drawn once.
  const background = asDataUri(rasterise(floorSvg(), OG_IMAGE_SIZE.width));
  const cluster = asDataUri(rasterise(clusterSvg(), CLUSTER_RASTER_WIDTH));
  const logo = asDataUri(rasterise(logoSvg(), LOGO_RASTER_WIDTH));

  // All pages of a package show the same icon, so an art file is resized once per width.
  const artCache = new Map<string, Promise<string>>();
  const loadArt = (id: string, width: number): Promise<string> => {
    const key = `${id}@${width}`;
    const cached = artCache.get(key);
    if (cached !== undefined) return cached;

    const file = path.join(directories.art, `${id}.webp`);
    const loaded = sharp(file).resize(width).png().toBuffer().then(asDataUri);
    artCache.set(key, loaded);
    return loaded;
  };

  // The object on the right of a card: the drawn cluster, or its art files in drawing order.
  const objectsOf = (card: OgCard): Promise<OgPlacedImage[]> => {
    if (card.object.kind === "cluster") {
      return Promise.resolve([{ ...OG_CLUSTER_SPOT, src: cluster }]);
    }
    return Promise.all(
      card.object.pieces.map(async piece => ({
        ...piece,
        src: await loadArt(piece.id, piece.width)
      }))
    );
  };

  // Satori lays out the text, resvg rasterises, sharp encodes the file that gets committed.
  return async card => {
    const tree = cardTree(card, { background, logo, objects: await objectsOf(card) });
    const svg = await satori(tree, { ...OG_IMAGE_SIZE, fonts });
    return sharp(rasterise(svg, OG_IMAGE_SIZE.width)).png(PNG_OPTIONS).toBuffer();
  };
}
