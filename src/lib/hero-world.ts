/**
 * @file The hero world's map: the platform, the terraces, where every block stands, the kernel
 * and its sockets, and the order they are drawn in.
 *
 * Pure and browser-safe: the SSR drawing reads the map, the `kernel-world` island reads the
 * anchor points the flying plugins aim at.
 */
import type { IsoBoxSpec, Point } from "./iso";
import { createProjection } from "./iso";

/** The world's projection: 60×30 cells, 34 units per level. */
export const world = createProjection({ tileWidth: 60, tileHeight: 30, levelHeight: 34 });

/** The SVG viewBox that frames the whole world, the floating Claude block included. */
export const WORLD_VIEW_BOX = "-310 -165 620 485";

/** Cells per side of the platform. */
export const WORLD_SIZE = 10;

/** Thickness of the platform slab under the ground. */
export const PLATFORM_DEPTH = 0.55;

/** Where a block stands: its cell, the level of the ground under it and its height. */
export type BlockPlace = {
  /** Cell along x. */
  x: number;
  /** Cell along y. */
  y: number;
  /** Level of the ground (or terrace) under the block. */
  level: number;
  /** Height of the block. */
  height: number;
};

/** Terrace height of the outer ring, the highest. */
const OUTER_TERRACE_LEVEL = 1.6;

/** Terrace height of the second ring, half the outer one. */
const INNER_TERRACE_LEVEL = 0.8;

/** Package blocks: core and common on the ground, frameworks on the middle ring, the rest on top. */
const BLOCK_PLACES: Readonly<Record<string, BlockPlace>> = {
  core: { x: 3, y: 7, level: 0, height: 0.8 },
  common: { x: 7, y: 3, level: 0, height: 0.64 },
  web: { x: 1, y: 4, level: INNER_TERRACE_LEVEL, height: 0.64 },
  worker: { x: 1, y: 1, level: INNER_TERRACE_LEVEL, height: 0.64 },
  room: { x: 4, y: 1, level: INNER_TERRACE_LEVEL, height: 0.64 },
  system: { x: 0, y: 7, level: OUTER_TERRACE_LEVEL, height: 0.64 },
  native: { x: 0, y: 5, level: OUTER_TERRACE_LEVEL, height: 0.64 },
  game: { x: 0, y: 2, level: OUTER_TERRACE_LEVEL, height: 0.64 },
  editor: { x: 2, y: 0, level: OUTER_TERRACE_LEVEL, height: 0.64 },
  ai: { x: 5, y: 0, level: OUTER_TERRACE_LEVEL, height: 0.64 },
  ci: { x: 7, y: 0, level: OUTER_TERRACE_LEVEL, height: 0.64 }
};

/** Inset of a package block inside its cell; the block is `1 - 2 × inset` wide. */
export const BLOCK_INSET = 0.18;

/** The pink kernel: a 2×2×2 cube in the middle of the platform. */
export const KERNEL_BOX: IsoBoxSpec = { x: 4, y: 4, z: 0, width: 2, depth: 2, height: 2 };

/** The Claude plugin block, floating above the far corner. */
export const CLAUDE_BOX: IsoBoxSpec = {
  x: 0.2,
  y: 0.2,
  z: 3.5,
  width: 0.8,
  depth: 0.8,
  height: 0.8
};

/** The five sockets around the kernel, in the order plugins fill them. */
export const SOCKETS: readonly (readonly [x: number, y: number])[] = [
  [5, 6],
  [6, 5],
  [4, 6],
  [6, 4],
  [6, 6]
];

/** Inset of a plugin block inside its socket cell. */
export const SOCKET_BLOCK_INSET = 0.16;

/** Height of a plugin block in a socket. */
export const SOCKET_BLOCK_HEIGHT = 0.62;

/** Offset from a cell's corner to its middle. */
const CELL_MIDDLE = 0.5;

/** Height above the ground where an accepted plugin lands in its socket. */
const SOCKET_LANDING_LEVEL = 0.7;

/** Grid distance from the back edge to the fall point: past the platform's front edge. */
const FALL_OUTWARD = 11.2;

/** Grid distance along the front edge to the fall point, a little past its middle. */
const FALL_ALONG = 6.2;

/** Painter's layer of each item kind at one depth: the kernel first, then terraces, sockets, blocks. */
const DRAW_LAYERS: Readonly<Record<WorldItem["kind"], number>> = {
  kernel: -1,
  terrace: 0,
  socket: 0.5,
  block: 1
};

/** One thing the world draws, in painter's order. */
export type WorldItem =
  | {
      /** A terrace cell of the two outer rings. */
      kind: "terrace";
      /** Cell along x. */
      x: number;
      /** Cell along y. */
      y: number;
      /** Ring: 0 is the outer, highest ring. */
      ring: 0 | 1;
      /** Terrace height. */
      level: number;
    }
  | {
      /** A socket next to the kernel. */
      kind: "socket";
      /** Fill order. */
      index: number;
      /** Cell along x. */
      x: number;
      /** Cell along y. */
      y: number;
    }
  | {
      /** A package block. */
      kind: "block";
      /** Package id. */
      id: string;
      /** Where it stands. */
      place: BlockPlace;
    }
  | {
      /** The kernel cube. */
      kind: "kernel";
    };

/**
 * Height of the terrace on a cell: the outer ring is the highest, the next ring half as high,
 * the middle of the platform is flat ground.
 *
 * @param x - Cell along x.
 * @param y - Cell along y.
 * @returns The terrace height, `0` for flat ground.
 * @example
 * ```ts
 * terraceLevel(0, 7); // 1.6
 * ```
 */
export function terraceLevel(x: number, y: number): number {
  const ring = Math.min(x, y);
  if (ring === 0) return OUTER_TERRACE_LEVEL;
  if (ring === 1) return INNER_TERRACE_LEVEL;
  return 0;
}

/**
 * Every terrace cell of the two outer rings.
 *
 * @returns The terrace items in row order.
 */
function terraces(): WorldItem[] {
  const cells: WorldItem[] = [];
  for (let x = 0; x < WORLD_SIZE; x += 1) {
    for (let y = 0; y < WORLD_SIZE; y += 1) {
      const ring = Math.min(x, y);
      if (ring === 0 || ring === 1)
        cells.push({ kind: "terrace", x, y, ring, level: terraceLevel(x, y) });
    }
  }
  return cells;
}

/**
 * Depth and layer of an item for the painter's sort: back to front by `x + y`; at one depth the
 * kernel first, then terraces, sockets and blocks.
 *
 * @param item - A world item.
 * @returns `[depth, layer]`.
 */
function drawKey(item: WorldItem): readonly [number, number] {
  if (item.kind === "kernel") {
    const depth = KERNEL_BOX.x + KERNEL_BOX.width / 2 + KERNEL_BOX.y + KERNEL_BOX.depth / 2;
    return [depth, DRAW_LAYERS.kernel];
  }
  if (item.kind === "block") return [item.place.x + item.place.y, DRAW_LAYERS.block];
  return [item.x + item.y, DRAW_LAYERS[item.kind]];
}

/**
 * The world's items in painter's order. Packages without a place on the map (the Claude plugin
 * floats and is drawn on top) are left out.
 *
 * @param blockIds - Package ids in family order.
 * @returns Terraces, sockets, blocks and the kernel, back to front.
 * @example
 * ```ts
 * worldItems(packages.map(entry => entry.id)).filter(item => item.kind === "block").length; // 11
 * ```
 */
export function worldItems(blockIds: readonly string[]): WorldItem[] {
  const blocks: WorldItem[] = [];
  for (const id of blockIds) {
    const place = BLOCK_PLACES[id];
    if (place) blocks.push({ kind: "block", id, place });
  }
  const sockets = SOCKETS.map(([x, y], index): WorldItem => ({ kind: "socket", index, x, y }));
  return [...terraces(), ...sockets, ...blocks, { kind: "kernel" } satisfies WorldItem].toSorted(
    (first, second) => {
      const [firstDepth, firstLayer] = drawKey(first);
      const [secondDepth, secondLayer] = drawKey(second);
      return firstDepth - secondDepth || firstLayer - secondLayer;
    }
  );
}

/**
 * The middle of the kernel's lid, where a flying plugin is judged.
 *
 * @returns The SVG point.
 * @example
 * ```ts
 * kernelTop(); // [0, 82]
 * ```
 */
export function kernelTop(): Point {
  return world.point(
    KERNEL_BOX.x + KERNEL_BOX.width / 2,
    KERNEL_BOX.y + KERNEL_BOX.depth / 2,
    KERNEL_BOX.z + KERNEL_BOX.height
  );
}

/**
 * The middle of a socket cell just above the ground, where an accepted plugin lands.
 *
 * @param index - Socket fill order.
 * @returns The SVG point; the last socket for an index past the end.
 * @example
 * ```ts
 * socketCentre(0); // the cell at 5,6
 * ```
 */
export function socketCentre(index: number): Point {
  const [x, y] = SOCKETS[Math.min(index, SOCKETS.length - 1)] ?? [0, 0];
  return world.point(x + CELL_MIDDLE, y + CELL_MIDDLE, SOCKET_LANDING_LEVEL);
}

/**
 * A point past the platform's front edge, where a refused plugin tumbles off.
 *
 * @param toRight - Fall off the right edge; the left edge otherwise.
 * @returns The SVG point.
 * @example
 * ```ts
 * // A refused plugin tumbles off the right edge:
 * fallPoint(true); // about [150, 261], past the right front edge
 * ```
 */
export function fallPoint(toRight: boolean): Point {
  return toRight
    ? world.point(FALL_OUTWARD, FALL_ALONG, 0)
    : world.point(FALL_ALONG, FALL_OUTWARD, 0);
}
