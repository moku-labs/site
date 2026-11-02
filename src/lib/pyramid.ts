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

/** Width of the drawing; rows are centred in it. */
export const PYRAMID_WIDTH = 980;

/** Height of a brick's front face. */
const BRICK_HEIGHT = 44;

/** Gap between bricks in a row. */
const BRICK_GAP = 10;

/** Extra gap between rows, room for the lid of the row below. */
const ROW_GAP = 6;

/** Top of the first row, room for the core lid and its lift. */
const TOP = 24;

/** Depth of a brick's lid on screen: right and up. */
const LID_X = 16;
const LID_Y = 10;

/** Front face width per row. */
const ROW_WIDTH: Readonly<Record<BrickKind, number>> = { core: 220, package: 70, demo: 150 };

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
 * Lay out the bricks: core alone on top, every other package in the middle row, the demos at
 * the base, each row centred.
 *
 * @param packages - The family, `core` included, in family order.
 * @param demos - The demos in display order.
 * @returns The bricks and the drawing height.
 * @example
 * ```ts
 * const { bricks, height } = pyramidBricks(packages, demos);
 * // <svg viewBox={`0 0 ${PYRAMID_WIDTH + 20} ${height}`}>
 * ```
 */
export function pyramidBricks(
  packages: readonly PyramidPackage[],
  demos: readonly PyramidDemo[]
): { bricks: Brick[]; height: number } {
  const rows: Unplaced[][] = [
    packages.filter(entry => entry.id === "core").map(entry => ({ kind: "core", ...entry })),
    packages.filter(entry => entry.id !== "core").map(entry => ({ kind: "package", ...entry })),
    demos.map(demo => ({ kind: "demo", id: demo.id, label: demo.name }))
  ];
  const bricks: Brick[] = [];
  let y = TOP;
  for (const row of rows) {
    const width = ROW_WIDTH[row[0]?.kind ?? "demo"];
    let x = (PYRAMID_WIDTH - (row.length * width + (row.length - 1) * BRICK_GAP)) / 2;
    for (const brick of row) {
      bricks.push({ ...brick, x, y, width, height: BRICK_HEIGHT });
      x += width + BRICK_GAP;
    }
    y += BRICK_HEIGHT + BRICK_GAP + ROW_GAP;
  }
  return { bricks, height: y + ROW_GAP };
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
