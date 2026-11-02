/**
 * @file Isometric projection: grid coordinates to SVG points, and the faces of a box on the grid.
 *
 * Pure and browser-safe. The SSR drawings (hero world, layers stack, pipeline diagram) and the
 * `kernel-world` island share it, so a point means the same thing on both sides.
 */

/** A point in SVG user units. */
export type Point = readonly [x: number, y: number];

/** How big one grid cell is on screen. */
export type IsoScale = {
  /** Width of one cell's diamond. */
  tileWidth: number;
  /** Height of one cell's diamond. */
  tileHeight: number;
  /** Screen height of one unit of `z`. */
  levelHeight: number;
};

/** A box on the grid: its back corner, its size and its height. */
export type IsoBoxSpec = {
  /** Back corner along x. */
  x: number;
  /** Back corner along y. */
  y: number;
  /** Ground level the box stands on. */
  z: number;
  /** Size along x. */
  width: number;
  /** Size along y. */
  depth: number;
  /** Height along z. */
  height: number;
};

/** The three visible faces of a box, as SVG `points` strings. */
export type BoxFaces = {
  /** The lid. */
  top: string;
  /** The face toward the viewer's left (the `y + depth` side). */
  left: string;
  /** The face toward the viewer's right (the `x + width` side). */
  right: string;
};

/** A projection for one scale. */
export type IsoProjection = {
  /**
   * Project a grid point to SVG units.
   *
   * @param x - Grid x.
   * @param y - Grid y.
   * @param z - Height.
   * @returns The SVG point.
   */
  point(x: number, y: number, z: number): Point;
  /**
   * The faces of a box.
   *
   * @param spec - The box.
   * @returns The three visible faces.
   */
  box(spec: IsoBoxSpec): BoxFaces;
  /**
   * The SVG `transform` that maps a 100×100 drawing onto the top face of a box, so a glyph
   * drawn flat lies on the lid.
   *
   * @param x - Back corner along x.
   * @param y - Back corner along y.
   * @param z - Height of the lid.
   * @param width - Lid size along x.
   * @param depth - Lid size along y.
   * @returns A `matrix(…)` string.
   */
  topFaceTransform(x: number, y: number, z: number, width: number, depth: number): string;
};

/**
 * Round to a number of decimals and drop a negative zero.
 *
 * @param value - The number.
 * @param digits - Decimals to keep.
 * @returns The rounded number.
 */
function round(value: number, digits: number): number {
  const rounded = Number(value.toFixed(digits));
  return rounded === 0 ? 0 : rounded;
}

/**
 * Join points into an SVG `points` attribute, one decimal each.
 *
 * @param points - The points in drawing order.
 * @returns `"x,y x,y …"`.
 * @example
 * ```ts
 * formatPoints([[0, 52], [60, 82]]); // "0,52 60,82"
 * ```
 */
export function formatPoints(points: readonly Point[]): string {
  return points.map(([x, y]) => `${round(x, 1)},${round(y, 1)}`).join(" ");
}

/**
 * Create an isometric projection: +x runs to the lower right, +y to the lower left, +z up.
 *
 * @param scale - Cell size and level height in SVG units.
 * @returns The projection.
 * @example
 * ```ts
 * const world = createProjection({ tileWidth: 60, tileHeight: 30, levelHeight: 34 });
 * world.point(1, 0, 0); // [30, 15]
 * ```
 */
export function createProjection(scale: IsoScale): IsoProjection {
  const halfWidth = scale.tileWidth / 2;
  const halfHeight = scale.tileHeight / 2;
  const point = (x: number, y: number, z: number): Point => [
    (x - y) * halfWidth,
    (x + y) * halfHeight - z * scale.levelHeight
  ];
  return {
    point,
    box: ({ x, y, z, width, depth, height }) => {
      const lid = z + height;
      const front = y + depth;
      const side = x + width;
      return {
        top: formatPoints([
          point(x, y, lid),
          point(side, y, lid),
          point(side, front, lid),
          point(x, front, lid)
        ]),
        left: formatPoints([
          point(x, front, lid),
          point(side, front, lid),
          point(side, front, z),
          point(x, front, z)
        ]),
        right: formatPoints([
          point(side, y, lid),
          point(side, front, lid),
          point(side, front, z),
          point(side, y, z)
        ])
      };
    },
    topFaceTransform: (x, y, z, width, depth) => {
      const [originX, originY] = point(x, y, z);
      const values = [
        round((halfWidth * width) / 100, 4),
        round((halfHeight * width) / 100, 4),
        round((-halfWidth * depth) / 100, 4),
        round((halfHeight * depth) / 100, 4),
        round(originX, 1),
        round(originY, 1)
      ];
      return `matrix(${values.join(" ")})`;
    }
  };
}
