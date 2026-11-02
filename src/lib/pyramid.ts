/**
 * @file The landing pyramid: brick layout (core on top, packages, demos at the base) and which
 * bricks light up together.
 *
 * Pure and browser-safe: the SSR drawing uses the layout, the `pyramid` island the relations.
 */

/** Kind of a brick: its row. */
export type BrickKind = "core" | "package" | "demo";

/** One brick: its front face rectangle and its label. */
export type Brick = {
  /** Row. */
  kind: BrickKind;
  /** Package or demo id. */
  id: string;
  /** Text on the front face. */
  label: string;
  /** Left edge of the front face. */
  x: number;
  /** Top edge of the front face. */
  y: number;
  /** Front face width. */
  width: number;
  /** Front face height. */
  height: number;
};

/** A package brick: its id and label. */
export type PyramidPackage = {
  /** Package id; `core` goes on top. */
  id: string;
  /** Text on the brick. */
  label: string;
};

/** A demo as the pyramid needs it. */
export type PyramidDemo = {
  /** Demo id. */
  id: string;
  /** Display name, the brick label. */
  name: string;
  /** Package ids it is built on. */
  stack: readonly string[];
};

/** Width of the wide drawing; its rows are centred in it. */
export const PYRAMID_WIDTH = 980;

/** Room the wide drawing keeps right of its width, for the lid of the last brick. */
const WIDE_MARGIN = 20;

/** Width of the stacked drawing, made for a phone: 360px less two 20px gutters is 320px. */
export const STACKED_WIDTH = 340;

/** Height of a brick's front face. */
export const BRICK_HEIGHT = 44;

/** Gap between bricks in a row. */
const BRICK_GAP = 10;

/** Extra gap between rows, room for the lid of the row below. */
const ROW_GAP = 6;

/** Top of the first row, room for the core lid and its lift. */
const TOP = 24;

/** Depth of a brick's lid on screen: right and up. */
const LID_X = 16;
const LID_Y = 10;

/** How the bricks are laid out: one wide pyramid, or rows that wrap to fit a phone. */
export type PyramidLayout = "wide" | "stacked";

/** What a layout fixes for one row: bricks per line, and their width when it is fixed. */
type RowSpec = {
  /** Most bricks on one line; a longer row wraps. */
  perLine: number;
  /** Front face width; computed from the line when absent. */
  width?: number;
};

/** The two layouts. The wide one keeps each row on one line; the stacked one wraps them. */
const LAYOUTS: Readonly<
  Record<
    PyramidLayout,
    { width: number; margin: number; rows: Readonly<Record<BrickKind, RowSpec>> }
  >
> = {
  wide: {
    width: PYRAMID_WIDTH,
    margin: WIDE_MARGIN,
    rows: {
      core: { perLine: 1, width: 220 },
      package: { perLine: Number.POSITIVE_INFINITY, width: 70 },
      demo: { perLine: Number.POSITIVE_INFINITY, width: 150 }
    }
  },
  stacked: {
    width: STACKED_WIDTH,
    margin: 0,
    rows: { core: { perLine: 1 }, package: { perLine: 4 }, demo: { perLine: 2 } }
  }
};

/**
 * Join corner points into an SVG `points` attribute.
 *
 * @param list - The corners in drawing order.
 * @returns `"x,y x,y …"`.
 */
function points(list: readonly (readonly [number, number])[]): string {
  return list.map(([x, y]) => `${x},${y}`).join(" ");
}

/** A brick before it has a position. */
type Unplaced = Pick<Brick, "kind" | "id" | "label">;

/**
 * Cut a row into lines of at most `size` bricks, in order.
 *
 * @param row - The row.
 * @param size - Bricks per line.
 * @returns The lines.
 */
function wrapRow(row: readonly Unplaced[], size: number): Unplaced[][] {
  const lines: Unplaced[][] = [];
  for (let from = 0; from < row.length; from += size) lines.push(row.slice(from, from + size));
  return lines;
}

/**
 * Lay out the bricks: core alone on top, every other package in the middle, the demos at the
 * base, each line centred. The wide layout keeps a row on one line; the stacked layout wraps
 * the packages four to a line and the demos two, so the whole pyramid fits a phone's width.
 *
 * @param packages - The family, `core` included, in family order.
 * @param demos - The demos in display order.
 * @param layout - `wide` (default) or `stacked`.
 * @returns The bricks, the drawing's width for the SVG viewBox and its height.
 * @example
 * ```ts
 * const { bricks, width, height } = pyramidBricks(packages, demos, "stacked");
 * // <svg viewBox={`0 0 ${width} ${height}`}>
 * ```
 */
export function pyramidBricks(
  packages: readonly PyramidPackage[],
  demos: readonly PyramidDemo[],
  layout: PyramidLayout = "wide"
): { bricks: Brick[]; width: number; height: number } {
  const spec = LAYOUTS[layout];
  const usable = spec.width - (layout === "stacked" ? LID_X : 0);
  const rows: Unplaced[][] = [
    packages.filter(entry => entry.id === "core").map(entry => ({ kind: "core", ...entry })),
    packages.filter(entry => entry.id !== "core").map(entry => ({ kind: "package", ...entry })),
    demos.map(demo => ({ kind: "demo", id: demo.id, label: demo.name }))
  ];
  const bricks: Brick[] = [];
  let y = TOP;
  for (const row of rows) {
    const rowSpec = spec.rows[row[0]?.kind ?? "demo"];
    const perLine = Math.min(rowSpec.perLine, row.length);
    const width = rowSpec.width ?? (usable - (perLine - 1) * BRICK_GAP) / perLine;
    for (const line of wrapRow(row, rowSpec.perLine)) {
      let x = (usable - (line.length * width + (line.length - 1) * BRICK_GAP)) / 2;
      for (const brick of line) {
        bricks.push({ ...brick, x, y, width, height: BRICK_HEIGHT });
        x += width + BRICK_GAP;
      }
      y += BRICK_HEIGHT + BRICK_GAP + ROW_GAP;
    }
  }
  return { bricks, width: spec.width + spec.margin, height: y + ROW_GAP };
}

/**
 * The three faces of a brick as SVG `points`: the front rectangle, the lid going up to the right
 * and the right side.
 *
 * @param brick - The brick.
 * @returns The faces.
 * @example
 * ```ts
 * <polygon data-face="front" points={brickFaces(brick).front} />
 * ```
 */
export function brickFaces(brick: Brick): { front: string; top: string; side: string } {
  const { x, y, width, height } = brick;
  const right = x + width;
  const bottom = y + height;
  return {
    front: points([
      [x, y],
      [right, y],
      [right, bottom],
      [x, bottom]
    ]),
    top: points([
      [x, y],
      [x + LID_X, y - LID_Y],
      [right + LID_X, y - LID_Y],
      [right, y]
    ]),
    side: points([
      [right, y],
      [right + LID_X, y - LID_Y],
      [right + LID_X, bottom - LID_Y],
      [right, bottom]
    ])
  };
}

/**
 * The bricks that light up with one brick, as `kind:id` keys. The core is always lit: everything
 * stands on it. A demo lights the packages it is built on; a package lights the demos built on
 * it; the core lights everything.
 *
 * @param kind - Kind of the hovered brick.
 * @param id - Its id.
 * @param demos - Every demo.
 * @param packages - Every package of the middle row.
 * @returns The keys of the related bricks (not the hovered one unless it is the core).
 * @example
 * ```ts
 * relatedBricks("demo", "tracker", demos, packages); // Set { "core:core", "package:web", "package:worker" }
 * ```
 */
export function relatedBricks(
  kind: BrickKind,
  id: string,
  demos: readonly PyramidDemo[],
  packages: readonly PyramidPackage[]
): Set<string> {
  const related = new Set(["core:core"]);
  const keys = (prefix: string, ids: readonly string[]): void => {
    for (const each of ids) related.add(`${prefix}:${each}`);
  };
  if (kind === "core") {
    keys(
      "package",
      packages.filter(entry => entry.id !== "core").map(entry => entry.id)
    );
    keys(
      "demo",
      demos.map(demo => demo.id)
    );
  } else if (kind === "package") {
    keys(
      "demo",
      demos.filter(demo => demo.stack.includes(id)).map(demo => demo.id)
    );
  } else {
    keys("package", demos.find(entry => entry.id === id)?.stack ?? []);
  }
  return related;
}
