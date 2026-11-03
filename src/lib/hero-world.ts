/**
 * @file The hero world's map: three stepped platforms (the kernel's ground, the framework's middle
 * ring, your app's outer ring), the kernel, the framework block, the cubes and sockets of a goal,
 * the scenery, where the labels go and the needs arcs.
 *
 * Pure and browser-safe: the SSR drawing and the `kernel-world` island read the same map, so a
 * point means the same thing on both sides. The rules of the assembly are in `./assembly`.
 */

import type { AssemblyGlyph, Cell, Goal, LayerId } from "../data/assembly";
import { assemblyText, scenery } from "../data/assembly";
import type { AssemblyState, ItemRole } from "./assembly";
import { APP_ID, fillText, KERNEL_ID, missingNeed, nameOf } from "./assembly";
import type { GlyphName } from "./glyphs";
import type { IsoBoxSpec, Point } from "./iso";
import { createProjection, formatPoints } from "./iso";

/** The world's projection: 60×30 cells, 34 units per level. */
export const world = createProjection({ tileWidth: 60, tileHeight: 30, levelHeight: 34 });

/** A rectangle of the world's SVG units. */
export type WorldFrame = {
  /** Left edge. */
  x: number;
  /** Top edge. */
  y: number;
  /** Width. */
  width: number;
  /** Height. */
  height: number;
};

/** The frame of the whole world on a desktop. */
export const WORLD_FRAME: WorldFrame = { x: -312, y: -160, width: 624, height: 492 };

/** The SVG viewBox that frames the whole world. */
export const WORLD_VIEW_BOX = `${WORLD_FRAME.x} ${WORLD_FRAME.y} ${WORLD_FRAME.width} ${WORLD_FRAME.height}`;

/**
 * The phone window: the platform's width and nothing more, so the whole platform fits inside the
 * 16px gutters and the drawing is as big as it can be. Its foot ends at the platform's front
 * corner, without the room the desktop keeps there.
 */
export const PHONE_WINDOW: WorldFrame = {
  x: -304,
  y: WORLD_FRAME.y,
  width: 608,
  height: 486
};

/** The SVG viewBox of the phone window; the island sets it on a phone. */
export const PHONE_VIEW_BOX = `${PHONE_WINDOW.x} ${PHONE_WINDOW.y} ${PHONE_WINDOW.width} ${PHONE_WINDOW.height}`;

/** The smallest label text a phone shows, in rendered pixels. */
export const PHONE_MIN_LABEL = 10;

/** The drawing's width on the 390px check phone: the screen less two 16px gutters. */
export const PHONE_MIN_DRAWING = 358;

/**
 * How to place the whole-world SVG so only a window of it shows: the SVG is made wider than its
 * box and pulled left, and the box clips the rest. The browser keeps the drawing's aspect.
 *
 * @param window - The part of the world's width to show.
 * @returns The SVG width and left shift, both in percent of the box's width.
 * @example
 * ```ts
 * windowFraming(PHONE_WINDOW); // { width: 102.6…, shift: -1.3… }
 * ```
 */
export function windowFraming(window: Pick<WorldFrame, "x" | "width">): {
  width: number;
  shift: number;
} {
  return {
    width: (WORLD_FRAME.width / window.width) * 100,
    shift: ((WORLD_FRAME.x - window.x) / window.width) * 100
  };
}

/**
 * Label size in SVG units that renders at least `minimum` pixels when the phone window is
 * `drawingWidth` pixels wide.
 *
 * @param minimum - Smallest rendered size in pixels.
 * @param drawingWidth - Width of the box that shows the window, in pixels.
 * @returns The font size in SVG units, rounded up to a whole unit.
 * @example
 * ```ts
 * labelUnits(10, 358); // 17
 * ```
 */
export function labelUnits(minimum: number, drawingWidth: number): number {
  return Math.ceil(minimum / (drawingWidth / PHONE_WINDOW.width));
}

/** Label size in SVG units on a phone: 10px on the 390px check phone. */
export const PHONE_LABEL_UNITS = labelUnits(PHONE_MIN_LABEL, PHONE_MIN_DRAWING);

/** Cells per side of the platform. */
export const WORLD_SIZE = 10;

/** Thickness of the platform slab under the ground. */
export const PLATFORM_DEPTH = 0.55;

/** Height of the framework's middle ring. */
export const FRAMEWORK_LEVEL = 0.9;

/** Height of your app's outer ring, the highest. */
export const APP_LEVEL = 1.8;

/** Height of each layer's platform. */
const LAYER_LEVELS: Readonly<Record<LayerId, number>> = {
  kernel: 0,
  framework: FRAMEWORK_LEVEL,
  app: APP_LEVEL
};

/** Where each raised ring starts and ends, in cells from the back edges. */
const RING_EDGES: Readonly<Record<"framework" | "app", { outer: number; inner: number }>> = {
  app: { outer: 0, inner: 2 },
  framework: { outer: 2, inner: 4 }
};

/** The pink kernel: a 2×2×2 cube on the ground, one cell in from the framework's step. */
export const KERNEL_BOX: IsoBoxSpec = { x: 5, y: 5, z: 0, width: 2, depth: 2, height: 2 };

/** The framework block: 2×2 on the middle ring, right behind the kernel. */
export const FRAMEWORK_BOX: IsoBoxSpec = {
  x: 2.08,
  y: 2.08,
  z: FRAMEWORK_LEVEL,
  width: 1.84,
  depth: 1.84,
  height: 0.86
};

/** The app cube: 2×2 at the back of the outer ring, where the app socket is. */
export const APP_BOX: IsoBoxSpec = {
  x: 0.12,
  y: 0.12,
  z: APP_LEVEL,
  width: 1.76,
  depth: 1.76,
  height: 1.05
};

/** Inset of a piece or standing plugin inside its cell. */
export const PIECE_INSET = 0.16;

/** Height of a piece or standing plugin cube. */
export const PIECE_HEIGHT = 0.62;

/** Inset of a scenery cube inside its cell. */
const SCENERY_INSET = 0.2;

/** Height of a scenery cube. */
const SCENERY_HEIGHT = 0.56;

/** How high a waiting piece hovers above its socket. */
export const HOVER_LIFT = 20;

/** A square inside a cell (or a run of cells), as offsets from the corner. */
type SquareInset = {
  /** Offset of the back corner along x and y. */
  near: number;
  /** Offset of the front corner along x and y. */
  far: number;
};

/** A piece's shadow inside its cell: shifted toward the front corner. */
const PIECE_SHADOW: SquareInset = { near: 0.2, far: 0.94 };

/** A scenery cube's shadow inside its cell. */
const SCENERY_SHADOW: SquareInset = { near: 0.22, far: 0.92 };

/** An empty socket's outline inside its cell. */
const SOCKET_OUTLINE: SquareInset = { near: 0.12, far: 0.88 };

/** The framework block's shadow on the middle ring, from the back edges. */
const FRAMEWORK_SHADOW: SquareInset = { near: 2.1, far: 4 };

/** The app socket's outline on the outer ring, from the back edges. */
const APP_SOCKET_OUTLINE: SquareInset = { near: 0.12, far: 1.88 };

/**
 * The layer a cell belongs to: the outer two rings are your app's, the next two the framework's,
 * the middle is the kernel's ground.
 *
 * @param x - Cell along x.
 * @param y - Cell along y.
 * @returns The layer.
 * @example
 * ```ts
 * layerAt(4, 1); // "app": comments has its socket on the top platform
 * ```
 */
export function layerAt(x: number, y: number): LayerId {
  const ring = Math.min(x, y);
  if (ring < RING_EDGES.app.inner) return "app";
  if (ring < RING_EDGES.framework.inner) return "framework";
  return "kernel";
}

/**
 * Height of the platform on a cell.
 *
 * @param x - Cell along x.
 * @param y - Cell along y.
 * @returns The level of the cell's layer.
 * @example
 * ```ts
 * platformLevel(2, 4); // 0.9: the framework's middle ring
 * ```
 */
export function platformLevel(x: number, y: number): number {
  return LAYER_LEVELS[layerAt(x, y)];
}

/** One raised cell of the two upper platforms. */
export type PlatformCell = {
  /** Cell along x. */
  x: number;
  /** Cell along y. */
  y: number;
  /** Its layer. */
  layer: "framework" | "app";
  /** Its height. */
  level: number;
};

/**
 * Every raised cell of the framework and app platforms, back to front, so each is drawn as a
 * column from the ground up and a nearer column covers a farther one.
 *
 * @returns The cells in painter's order.
 * @example
 * ```ts
 * platformCells().filter(cell => cell.layer === "app").length; // 36
 * ```
 */
export function platformCells(): PlatformCell[] {
  const cells: PlatformCell[] = [];
  for (let x = 0; x < WORLD_SIZE; x += 1) {
    for (let y = 0; y < WORLD_SIZE; y += 1) {
      const layer = layerAt(x, y);
      if (layer !== "kernel") cells.push({ x, y, layer, level: LAYER_LEVELS[layer] });
    }
  }
  return cells.toSorted((first, second) => first.x + first.y - (second.x + second.y));
}

/**
 * The lip of a raised platform: the line along its inner step, so the three layers read at once.
 *
 * @param layer - The platform.
 * @returns The polyline points.
 * @example
 * ```ts
 * formatPoints(platformLip("app")); // the step from the app ring down to the framework ring
 * ```
 */
export function platformLip(layer: "framework" | "app"): Point[] {
  const { outer, inner } = RING_EDGES[layer];
  const level = LAYER_LEVELS[layer];
  return [
    world.point(outer, WORLD_SIZE, level),
    world.point(inner, WORLD_SIZE, level),
    world.point(inner, inner, level),
    world.point(WORLD_SIZE, inner, level),
    world.point(WORLD_SIZE, outer, level)
  ];
}

/**
 * The points of a square on a cell (or on the cells from a corner), at a height.
 *
 * @param x - Cell along x.
 * @param y - Cell along y.
 * @param z - Height of the square.
 * @param inset - Offsets of its back and front corners.
 * @returns The four corners.
 */
function squareAt(x: number, y: number, z: number, inset: SquareInset): Point[] {
  const { near, far } = inset;
  return [
    world.point(x + near, y + near, z),
    world.point(x + far, y + near, z),
    world.point(x + far, y + far, z),
    world.point(x + near, y + far, z)
  ];
}

/**
 * The middle of a box's lid: where its label and its arcs attach.
 *
 * @param box - The box.
 * @returns The SVG point.
 * @example
 * ```ts
 * lidCentre(KERNEL_BOX); // [0, 112]
 * ```
 */
export function lidCentre(box: IsoBoxSpec): Point {
  return world.point(box.x + box.width / 2, box.y + box.depth / 2, box.z + box.height);
}

/**
 * The middle of the kernel's lid, where a dragged piece is dropped.
 *
 * @returns The SVG point.
 * @example
 * ```ts
 * kernelTop(); // [0, 112]
 * ```
 */
export function kernelTop(): Point {
  return lidCentre(KERNEL_BOX);
}

/**
 * The box of a cube standing on a cell: a piece, a standing plugin.
 *
 * @param cell - Its cell.
 * @returns The box, on the platform of the cell.
 */
function cellBox(cell: Cell): IsoBoxSpec {
  const [x, y] = cell;
  const size = 1 - 2 * PIECE_INSET;
  return {
    x: x + PIECE_INSET,
    y: y + PIECE_INSET,
    z: platformLevel(x, y),
    width: size,
    depth: size,
    height: PIECE_HEIGHT
  };
}

/**
 * Where the cube of an item stands: the kernel, the app, the framework block, or the cell of a
 * standing plugin or a piece's socket.
 *
 * @param goal - The goal.
 * @param id - Item id.
 * @returns Its box, or `undefined` for an id outside the goal.
 * @example
 * ```ts
 * cubeBox(siteGoal, "comments")?.z; // 1.8: on the top platform
 * ```
 */
export function cubeBox(goal: Goal, id: string): IsoBoxSpec | undefined {
  if (id === KERNEL_ID) return KERNEL_BOX;
  if (id === APP_ID) return APP_BOX;
  if (id === goal.framework.id) return FRAMEWORK_BOX;
  const cell = [...goal.standing, ...goal.pieces].find(entry => entry.id === id)?.cell;
  return cell === undefined ? undefined : cellBox(cell);
}

/**
 * The middle of an item's lid, where its label stands and its needs arcs attach. A piece not in
 * yet has the anchor it will have in its socket.
 *
 * @param goal - The goal.
 * @param id - Item id.
 * @returns The SVG point, or `undefined` for an id outside the goal.
 * @example
 * ```ts
 * cubeAnchor(siteGoal, "core"); // kernelTop()
 * ```
 */
export function cubeAnchor(goal: Goal, id: string): Point | undefined {
  const box = cubeBox(goal, id);
  return box === undefined ? undefined : lidCentre(box);
}

/**
 * The silhouette of a box on screen: the hexagon around its three visible faces.
 *
 * @param box - The box.
 * @param lift - How far it is lifted on screen, e.g. {@link HOVER_LIFT} for a waiting piece.
 * @returns The six corners, clockwise from the top.
 * @example
 * ```ts
 * // Labels keep off this outline:
 * cubeOutline(KERNEL_BOX).length; // 6
 * ```
 */
export function cubeOutline(box: IsoBoxSpec, lift = 0): Point[] {
  const { x, y, z, width, depth, height } = box;
  const top = z + height;
  const side = x + width;
  const front = y + depth;
  const corners = [
    world.point(x, y, top),
    world.point(side, y, top),
    world.point(side, y, z),
    world.point(side, front, z),
    world.point(x, front, z),
    world.point(x, front, top)
  ];
  return corners.map(([pointX, pointY]): Point => [pointX, pointY - lift]);
}

/** One cube of a goal's world. */
export type WorldCube = {
  /** Item id. */
  id: string;
  /** What it is. */
  role: ItemRole;
  /** Where it stands. */
  box: IsoBoxSpec;
  /** Glyph on its lid. */
  glyph: AssemblyGlyph;
  /** Its shadow on the platform; empty for the kernel and the app. */
  shadow: readonly Point[];
  /** It hovers over its socket, waiting for its need. */
  waiting: boolean;
  /** How far it is lifted on screen: {@link HOVER_LIFT} while waiting. */
  lift: number;
};

/**
 * Painter's depth of a box: back to front by the middle of its footprint.
 *
 * @param box - The box.
 * @returns The depth; bigger is nearer.
 */
function depthOf(box: IsoBoxSpec): number {
  return box.x + box.width / 2 + box.y + box.depth / 2;
}

/**
 * The cubes a goal shows in a state, in painter's order: the kernel, the framework block, the
 * standing plugins, the pieces in place or waiting, and the app once it runs.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @returns The cubes, back to front.
 * @example
 * ```ts
 * // comments waits, so it hovers over its socket:
 * worldCubes(siteGoal, state).find(cube => cube.id === "comments")?.lift; // 20
 * ```
 */
export function worldCubes(goal: Goal, state: AssemblyState): WorldCube[] {
  // The kernel and the framework block always stand, and never move.
  const still = { waiting: false, lift: 0 };
  const cubes: WorldCube[] = [
    { id: KERNEL_ID, role: "kernel", box: KERNEL_BOX, glyph: "kernel", shadow: [], ...still },
    {
      id: goal.framework.id,
      role: "framework",
      box: FRAMEWORK_BOX,
      glyph: goal.framework.glyph,
      shadow: squareAt(0, 0, FRAMEWORK_LEVEL, FRAMEWORK_SHADOW),
      ...still
    }
  ];

  // The standing plugins, then the pieces added so far; a waiting piece hovers over its socket.
  const added = goal.pieces.filter(piece => [...state.placed, ...state.waiting].includes(piece.id));
  for (const entry of [...goal.standing, ...added]) {
    const waiting = state.waiting.includes(entry.id);
    const [x, y] = entry.cell;
    cubes.push({
      id: entry.id,
      role: "layer" in entry ? "piece" : "standing",
      box: cellBox(entry.cell),
      glyph: entry.glyph,
      shadow: squareAt(x, y, platformLevel(x, y), PIECE_SHADOW),
      waiting,
      lift: waiting ? HOVER_LIFT : 0
    });
  }

  // The app cube stands on its socket once every piece is in.
  if (state.complete) {
    cubes.push({
      id: APP_ID,
      role: "app",
      box: APP_BOX,
      glyph: goal.app.glyph,
      shadow: [],
      ...still
    });
  }

  // Painter's order: a nearer cube covers a farther one.
  return cubes.toSorted((first, second) => depthOf(first.box) - depthOf(second.box));
}

/** An empty socket: the outline a piece lands in. */
export type WorldSocket = {
  /** The piece it waits for, or `app` for the app socket. */
  id: string;
  /** The outline on its platform. */
  outline: readonly Point[];
  /** A waiting piece needs the piece of this socket. */
  wanted: boolean;
};

/**
 * The empty sockets of a state: one for each piece not in place (a waiting piece hovers over
 * its own), and the app socket until the app runs.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @returns The sockets in tray order, the app's last.
 * @example
 * ```ts
 * worldSockets(siteGoal, initialAssembly(siteGoal, versions)).map(socket => socket.id);
 * // ["content", "comments", "newsletter", "app"]
 * ```
 */
export function worldSockets(goal: Goal, state: AssemblyState): WorldSocket[] {
  const wanted = new Set(state.waiting.map(id => missingNeed(goal, state, id)));
  const sockets: WorldSocket[] = goal.pieces
    .filter(piece => !state.placed.includes(piece.id))
    .map(piece => {
      const [x, y] = piece.cell;
      return {
        id: piece.id,
        outline: squareAt(x, y, platformLevel(x, y), SOCKET_OUTLINE),
        wanted: wanted.has(piece.id)
      };
    });
  if (!state.complete) {
    sockets.push({
      id: APP_ID,
      outline: squareAt(0, 0, APP_LEVEL, APP_SOCKET_OUTLINE),
      wanted: false
    });
  }
  return sockets;
}

/** A dimmed family package on the outer ring, without a label. */
export type SceneryCube = {
  /** Package id; also its glyph. */
  package: GlyphName;
  /** Where it stands. */
  box: IsoBoxSpec;
  /** Its shadow. */
  shadow: readonly Point[];
};

/**
 * The scenery of a goal. Where the scenery would show the goal's own framework a second time,
 * the goal's stand-in stands instead (in App, `web` takes the place of `worker`).
 *
 * @param goal - The goal.
 * @returns The scenery cubes.
 * @example
 * ```ts
 * sceneryCubes(appGoal).some(cube => cube.package === "worker"); // false
 * ```
 */
export function sceneryCubes(goal: Goal): SceneryCube[] {
  return scenery.map(place => {
    const [x, y] = place.cell;
    const level = platformLevel(x, y);
    const size = 1 - 2 * SCENERY_INSET;
    const repeatsFramework = place.package === goal.framework.id;
    return {
      package: repeatsFramework ? (goal.sceneryStandIn ?? place.package) : place.package,
      box: {
        x: x + SCENERY_INSET,
        y: y + SCENERY_INSET,
        z: level,
        width: size,
        depth: size,
        height: SCENERY_HEIGHT
      },
      shadow: squareAt(x, y, level, SCENERY_SHADOW)
    };
  });
}

/** Stroke width of a needs arc on a desktop. */
export const ARC_STROKE = 2.4;

/** Stroke width of a needs arc on a phone, where the drawing is smaller. */
export const PHONE_ARC_STROKE = 3.6;

/** How far above the needing cube's lid an arc starts. */
const ARC_START_LIFT = 3;

/** How far above the needed cube's lid an arc ends. */
const ARC_END_LIFT = 4;

/** Below this horizontal distance the two ends stand one above the other. */
const ARC_STEEP_DISTANCE = 12;

/** How far a steep arc bulges out to the right. */
const ARC_STEEP_BULGE = 70;

/** How far a steep arc's bend sits above the middle of its ends. */
const ARC_STEEP_RISE = 10;

/** How far a wide arc's bend rises above the higher end. */
const ARC_RISE = 26;

/** Extra rise of a wide arc per unit of horizontal distance. */
const ARC_RISE_PER_UNIT = 0.18;

/** Arrowhead length, per unit of stroke width: the tip runs past the end, the base sits behind. */
const ARROW_TIP = 0.8;

/** Arrowhead base distance behind the end, per unit of stroke width. */
const ARROW_BACK = 3.2;

/** Arrowhead half width, per unit of stroke width. */
const ARROW_HALF_WIDTH = 2;

/** A needs arc: a quadratic curve over the top with its arrowhead at the needed cube. */
export type NeedArc = {
  /** Where it starts, just above the needing cube. */
  start: Point;
  /** The bend of the curve. */
  bend: Point;
  /** Where it ends, just above the needed cube. */
  end: Point;
  /** The SVG path data. */
  path: string;
  /** Length of the bend's two legs: a dash long enough to draw the whole arc. */
  length: number;
  /** The arrowhead: tip, then its two back corners. */
  head: readonly [tip: Point, left: Point, right: Point];
};

/**
 * Round to one decimal, as the drawing does.
 *
 * @param value - The number.
 * @returns The rounded number.
 */
function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The bend of a needs arc: over the top of both ends, rising more the further apart they are, or
 * out to the right when one stands above the other.
 *
 * @param start - Where the arc starts.
 * @param end - Where it ends.
 * @returns The control point.
 */
function arcBend(start: Point, end: Point): Point {
  const [startX, startY] = start;
  const [endX, endY] = end;
  const across = Math.abs(endX - startX);
  if (across < ARC_STEEP_DISTANCE) {
    return [startX + ARC_STEEP_BULGE, (startY + endY) / 2 - ARC_STEEP_RISE];
  }
  return [(startX + endX) / 2, Math.min(startY, endY) - ARC_RISE - across * ARC_RISE_PER_UNIT];
}

/**
 * The arc of a "needs" edge, from the lid of the cube that needs to the lid of the cube it needs,
 * with its arrowhead pointing into the needed cube.
 *
 * @param from - Lid anchor of the needing cube; lift it by {@link HOVER_LIFT} while it waits.
 * @param to - Lid anchor of the needed cube.
 * @param stroke - The arc's stroke width; the arrowhead scales with it.
 * @returns The arc.
 * @example
 * ```ts
 * // The selected comments cube shows what it needs:
 * // From the lid of comments [90, 7.7] to the lid of content [60, 53.3]:
 * needArc([90, 7.7], [60, 53.3]).path; // "M90,4.7Q75,-26.7 60,49.3"
 * ```
 */
export function needArc(from: Point, to: Point, stroke = ARC_STROKE): NeedArc {
  // The arc leaves just above the needing cube's lid and lands just above the needed one's,
  // bending over the top of both.
  const start: Point = [from[0], from[1] - ARC_START_LIFT];
  const end: Point = [to[0], to[1] - ARC_END_LIFT];
  const bend = arcBend(start, end);

  // The curve arrives along its last leg, from the bend to the end; the arrowhead points that way.
  const towardsX = end[0] - bend[0];
  const towardsY = end[1] - bend[1];
  const reach = Math.hypot(towardsX, towardsY) || 1;
  const along: Point = [towardsX / reach, towardsY / reach];

  // The two legs are long enough for a dash that draws the whole curve.
  return {
    start,
    bend,
    end,
    path: `M${formatPoints([start])}Q${formatPoints([bend, end])}`,
    length: oneDecimal(Math.hypot(bend[0] - start[0], bend[1] - start[1]) + reach),
    head: arrowHead(end, along, stroke)
  };
}

/**
 * The arrowhead at the end of an arc: its tip a little past the end, its base behind it, both
 * sized by the stroke.
 *
 * @param end - Where the arc ends.
 * @param along - The unit direction the arc arrives in.
 * @param stroke - The arc's stroke width.
 * @returns The tip, then the two back corners.
 */
function arrowHead(end: Point, along: Point, stroke: number): NeedArc["head"] {
  const across: Point = [-along[1], along[0]];
  const tipAt = ARROW_TIP * stroke;
  const backAt = ARROW_BACK * stroke;
  const half = ARROW_HALF_WIDTH * stroke;
  const back: Point = [end[0] - along[0] * backAt, end[1] - along[1] * backAt];
  return [
    [end[0] + along[0] * tipAt, end[1] + along[1] * tipAt],
    [back[0] + across[0] * half, back[1] + across[1] * half],
    [back[0] - across[0] * half, back[1] - across[1] * half]
  ];
}

/** How a world label looks: a piece's name, a standing plugin's quieter name, a socket's ghost. */
export type LabelTone = "piece" | "standing" | "socket";

/** A name over a cube or socket, placed by {@link labelPlacement}. */
export type WorldLabel = {
  /** The item it names; it may cover its own cube. */
  owner: string;
  /** The text. */
  text: string;
  /** How it looks. */
  tone: LabelTone;
  /** The lid anchor it stands over. */
  anchor: Point;
  /** Lower goes first and gets the best spot. */
  priority: number;
};

/** A fixed text: the app's name, the waiting callout, the completion strip. */
export type CalloutKind = "app" | "waiting" | "running";

/** A fixed text over a cube; the labels make room for it. */
export type WorldCallout = {
  /** The item it belongs to. */
  owner: string;
  /** The text. */
  text: string;
  /** What it is. */
  kind: CalloutKind;
  /** The lid anchor it stands over. */
  anchor: Point;
};

/** The outline of a cube, which no other cube's label may touch. */
export type CubeOutline = {
  /** The cube's item id; `scenery` for scenery. */
  owner: string;
  /** Its silhouette. */
  outline: readonly Point[];
};

/** Everything the label layout weighs for one state. */
export type LabelScene = {
  /** The labels to place. */
  labels: readonly WorldLabel[];
  /** The fixed texts. */
  callouts: readonly WorldCallout[];
  /** The cube outlines, scenery included. */
  cubes: readonly CubeOutline[];
};

/** Who gets the best spot first: your pieces, then sockets, then standing plugins, then the app. */
const LABEL_PRIORITY: Readonly<Record<LabelTone | "app", number>> = {
  piece: 0,
  socket: 1,
  standing: 2,
  app: 3
};

/** How far below the app socket's back corner its ghost label's anchor sits. */
const APP_SOCKET_LABEL_DROP = 5;

/**
 * The names over the cubes of a state, and the callout over a waiting one.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @param cubes - Its cubes.
 * @returns The labels and the callouts.
 */
function cubeTexts(
  goal: Goal,
  state: AssemblyState,
  cubes: readonly WorldCube[]
): { labels: WorldLabel[]; callouts: WorldCallout[] } {
  const labels: WorldLabel[] = [];
  const callouts: WorldCallout[] = [];
  for (const cube of cubes) {
    const anchor = lidCentre(cube.box);
    if (cube.waiting) {
      const need = nameOf(goal, missingNeed(goal, state, cube.id) ?? "");
      const text = fillText(assemblyText.waitingCallout, { piece: cube.id, need });
      callouts.push({ owner: cube.id, text, kind: "waiting", anchor });
    } else if (cube.role === "piece" || cube.role === "standing") {
      const tone = cube.role;
      labels.push({ owner: cube.id, text: cube.id, tone, anchor, priority: LABEL_PRIORITY[tone] });
    }
  }
  return { labels, callouts };
}

/**
 * The ghost names on the empty sockets, and the app's name: on its socket until it runs, over the
 * risen cube with the completion strip after.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @returns The labels and the callouts.
 */
function socketTexts(
  goal: Goal,
  state: AssemblyState
): { labels: WorldLabel[]; callouts: WorldCallout[] } {
  const labels: WorldLabel[] = goal.pieces
    .filter(piece => !state.placed.includes(piece.id) && !state.waiting.includes(piece.id))
    .map(piece => ({
      owner: piece.id,
      text: piece.id,
      tone: "socket",
      anchor: lidCentre(cellBox(piece.cell)),
      priority: LABEL_PRIORITY.socket
    }));
  if (!state.complete) {
    const [x, y] = world.point(APP_BOX.x, APP_BOX.y, APP_LEVEL);
    labels.push({
      owner: APP_ID,
      text: goal.app.label,
      tone: "socket",
      anchor: [x, y + APP_SOCKET_LABEL_DROP],
      priority: LABEL_PRIORITY.app
    });
    return { labels, callouts: [] };
  }
  const anchor = world.point(APP_BOX.x, APP_BOX.y, APP_BOX.z + APP_BOX.height);
  const running = fillText(assemblyText.completion, { app: goal.app.name });
  return {
    labels,
    callouts: [
      { owner: APP_ID, text: goal.app.label, kind: "app", anchor },
      { owner: APP_ID, text: running, kind: "running", anchor }
    ]
  };
}

/**
 * What the label layout weighs for a state: every label with its anchor and priority, the fixed
 * callouts, and the outline of every cube and scenery block.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @returns The scene.
 * @example
 * ```ts
 * const layout = labelPlacement(labelScene(siteGoal, state), PHONE_LABELS);
 * ```
 */
export function labelScene(goal: Goal, state: AssemblyState): LabelScene {
  const cubes = worldCubes(goal, state);
  const onCubes = cubeTexts(goal, state, cubes);
  const onSockets = socketTexts(goal, state);
  return {
    labels: [...onCubes.labels, ...onSockets.labels],
    callouts: [...onCubes.callouts, ...onSockets.callouts],
    cubes: [
      ...cubes.map(cube => ({ owner: cube.id, outline: cubeOutline(cube.box, cube.lift) })),
      ...sceneryCubes(goal).map(cube => ({ owner: "scenery", outline: cubeOutline(cube.box) }))
    ]
  };
}

/** The visible part of the world and the text sizes it shows there, in SVG units. */
export type LabelViewport = {
  /** The visible frame. */
  frame: WorldFrame;
  /** Size of a name label. */
  label: number;
  /** Size of the app's name over its cube. */
  appLabel: number;
  /** Size of the callout text. */
  callout: number;
};

/** The desktop drawing: the whole frame, labels at 10.5. */
export const DESKTOP_LABELS: LabelViewport = {
  frame: WORLD_FRAME,
  label: 10.5,
  appLabel: 12.5,
  callout: 10.5
};

/** The phone drawing: the phone window, labels big enough to read at 390px. */
export const PHONE_LABELS: LabelViewport = {
  frame: PHONE_WINDOW,
  label: PHONE_LABEL_UNITS,
  appLabel: 19,
  callout: 16
};

/** The `text-anchor` of a label. */
export type TextAlign = "start" | "middle" | "end";

/** The box a text covers. */
export type TextBox = {
  /** Left edge. */
  x: number;
  /** Top edge. */
  y: number;
  /** Width. */
  width: number;
  /** Height. */
  height: number;
};

/** A label in its spot. */
export type PlacedLabel = WorldLabel & {
  /** Text x. */
  x: number;
  /** Text baseline. */
  y: number;
  /** Text anchor. */
  align: TextAlign;
  /** The box the text covers. */
  box: TextBox;
  /** A leader tick from just over the anchor to the label's nearer edge, for a label set apart. */
  tick?: readonly [from: Point, to: Point];
};

/** A callout in its spot. */
export type PlacedCallout = WorldCallout & {
  /** Text x, centred. */
  x: number;
  /** Text baseline. */
  y: number;
  /** The box it covers: the pill around a waiting or completion text, the text of the app name. */
  box: TextBox;
};

/** Where every text of a state goes. */
export type LabelLayout = {
  /** The labels, in the order they were placed. */
  labels: PlacedLabel[];
  /** The callouts. */
  callouts: PlacedCallout[];
};

/** Size of a face's glyphs, per unit of font size. */
type FaceMetrics = {
  /** Advance of one character. */
  advance: number;
  /** Height above the baseline. */
  ascent: number;
  /** Depth below the baseline. */
  descent: number;
};

/** JetBrains Mono, the labels' face: every character advances 0.6 em (read from the font). */
const MONO: FaceMetrics = { advance: 0.6, ascent: 1.02, descent: 0.3 };

/**
 * Instrument Sans, the callouts' face, at weight 600. Its characters vary; 0.55 em covers the
 * widest callout ("comments needs content", 0.548 em measured in the browser), so the layout keeps
 * a label off the pill the island fits to the drawn text.
 */
const SANS: FaceMetrics = { advance: 0.55, ascent: 1, descent: 0.25 };

/** Padding of a callout pill, across and along, per unit of its text height. */
export const PILL_PADDING = { across: 0.6, along: 0.28 };

/** Gap from the app cube's back corner to the baseline of its name. */
const APP_NAME_GAP = 10;

/**
 * Height of the completion strip's baseline above the app cube's back corner. The strip rises
 * further only when the app's name would touch it (the bigger phone name).
 */
const RUNNING_RISE = 38;

/** Room the completion strip keeps above the app's name when it has to rise for it. */
const RUNNING_ROOM = 1;

/** Height of a waiting callout's baseline above the waiting piece's lid. */
const WAITING_RISE = 50;

/** Share of a text's width left of its x, per anchor. */
const ALIGN_SHIFT: Readonly<Record<TextAlign, number>> = { start: 0, middle: 0.5, end: 1 };

/** A spot to try for a label, relative to its anchor. */
type Spot = {
  /** Shift along x. */
  dx: number;
  /** Baseline shift along y. */
  dy: number;
  /** Text anchor. */
  align: TextAlign;
  /** Draw a leader tick back to the anchor. */
  tick: boolean;
};

/** The spots in the order they are tried: above, beside, higher with a tick, below, further out. */
const SPOTS: readonly [Spot, ...Spot[]] = [
  { dx: 0, dy: -13, align: "middle", tick: false },
  { dx: 24, dy: 7, align: "start", tick: false },
  { dx: -24, dy: 7, align: "end", tick: false },
  { dx: 0, dy: -38, align: "middle", tick: true },
  { dx: 28, dy: -22, align: "start", tick: true },
  { dx: -28, dy: -22, align: "end", tick: true },
  { dx: 0, dy: 48, align: "middle", tick: false },
  { dx: 36, dy: -40, align: "start", tick: true },
  { dx: -36, dy: -40, align: "end", tick: true },
  { dx: 0, dy: -60, align: "middle", tick: true },
  { dx: 44, dy: 26, align: "start", tick: true },
  { dx: -44, dy: 26, align: "end", tick: true },
  { dx: 56, dy: -6, align: "start", tick: true },
  { dx: -56, dy: -6, align: "end", tick: true },
  { dx: 0, dy: -82, align: "middle", tick: true },
  { dx: 60, dy: -50, align: "start", tick: true },
  { dx: -60, dy: -50, align: "end", tick: true }
];

/** Room a label keeps around itself while it looks for a spot. */
const LABEL_ROOM = 2;

/** Room a label keeps from the frame's left and right edges. */
const FRAME_ROOM = 2;

/** Gap between a lid anchor and the foot of a leader tick. */
const TICK_GAP = 6;

/** Weight of a spot outside the frame: never, while another spot exists. */
const OUTSIDE_WEIGHT = 1_000_000;

/** Weight of each other text a spot touches. */
const TEXT_WEIGHT = 1000;

/** Weight of each other cube a spot touches. */
const CUBE_WEIGHT = 500;

/**
 * The box a line of text covers.
 *
 * @param text - The text.
 * @param size - Font size.
 * @param face - The face's metrics.
 * @param at - Text x and baseline.
 * @param align - Text anchor.
 * @returns The box.
 */
function textBox(
  text: string,
  size: number,
  face: FaceMetrics,
  at: Point,
  align: TextAlign
): TextBox {
  const width = [...text].length * face.advance * size;
  return {
    x: at[0] - width * ALIGN_SHIFT[align],
    y: at[1] - face.ascent * size,
    width,
    height: (face.ascent + face.descent) * size
  };
}

/**
 * The pill around a callout text.
 *
 * @param text - The text.
 * @param size - Font size.
 * @param at - Text x (centre) and baseline.
 * @returns The pill's box.
 */
function pillBox(text: string, size: number, at: Point): TextBox {
  const inner = textBox(text, size, SANS, at, "middle");
  const across = inner.height * PILL_PADDING.across;
  const along = inner.height * PILL_PADDING.along;
  return {
    x: inner.x - across,
    y: inner.y - along,
    width: inner.width + 2 * across,
    height: inner.height + 2 * along
  };
}

/**
 * Where a callout goes: the app's name just over the risen cube, the completion strip just over the
 * name, a waiting callout well above the hovering piece.
 *
 * @param callout - The callout.
 * @param viewport - The text sizes.
 * @returns The callout in place.
 */
function placeCallout(callout: WorldCallout, viewport: LabelViewport): PlacedCallout {
  const [x, anchorY] = callout.anchor;
  const nameBaseline = anchorY - APP_NAME_GAP;
  if (callout.kind === "app") {
    const box = textBox(callout.text, viewport.appLabel, MONO, [x, nameBaseline], "middle");
    return { ...callout, x, y: nameBaseline, box };
  }
  const size = viewport.callout;
  const pillFoot = (SANS.descent + PILL_PADDING.along * (SANS.ascent + SANS.descent)) * size;
  const y =
    callout.kind === "running"
      ? Math.min(
          anchorY - RUNNING_RISE,
          nameBaseline - MONO.ascent * viewport.appLabel - pillFoot - RUNNING_ROOM
        )
      : anchorY - WAITING_RISE;
  return { ...callout, x, y, box: pillBox(callout.text, size, [x, y]) };
}

/**
 * The corners of a box, grown by some room.
 *
 * @param box - The box.
 * @param room - Room on every side.
 * @returns The four corners.
 */
function corners(box: TextBox, room: number): Point[] {
  const left = box.x - room;
  const right = box.x + box.width + room;
  const top = box.y - room;
  const bottom = box.y + box.height + room;
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom]
  ];
}

/**
 * The extent of a polygon along an axis.
 *
 * @param polygon - The polygon.
 * @param axis - The axis.
 * @returns The lowest and highest projection.
 */
function extent(polygon: readonly Point[], axis: Point): readonly [number, number] {
  const values = polygon.map(([x, y]) => x * axis[0] + y * axis[1]);
  return [Math.min(...values), Math.max(...values)];
}

/**
 * Whether two convex polygons overlap; touching edges do not count. Separating-axis test over the
 * edges of both.
 *
 * @param first - One polygon.
 * @param second - The other.
 * @returns `true` when they overlap.
 */
function overlap(first: readonly Point[], second: readonly Point[]): boolean {
  for (const polygon of [first, second]) {
    for (const [index, [fromX, fromY]] of polygon.entries()) {
      const [toX, toY] = polygon[(index + 1) % polygon.length] ?? [fromX, fromY];
      const axis: Point = [toY - fromY, fromX - toX];
      const [firstLow, firstHigh] = extent(first, axis);
      const [secondLow, secondHigh] = extent(second, axis);
      if (firstHigh <= secondLow || secondHigh <= firstLow) return false;
    }
  }
  return true;
}

/**
 * How bad a spot is: outside the frame, on another text, on another cube.
 *
 * @param box - The label's box in the spot.
 * @param owner - The label's own cube, which it may cover.
 * @param frame - The visible frame.
 * @param taken - Boxes of the texts already placed.
 * @param cubes - The cube outlines.
 * @returns `0` for a clean spot; more the worse it is.
 */
function clashWeight(
  box: TextBox,
  owner: string,
  frame: WorldFrame,
  taken: readonly TextBox[],
  cubes: readonly CubeOutline[]
): number {
  const outside =
    box.x < frame.x + FRAME_ROOM ||
    box.x + box.width > frame.x + frame.width - FRAME_ROOM ||
    box.y < frame.y ||
    box.y + box.height > frame.y + frame.height;
  const grown = corners(box, LABEL_ROOM);
  const texts = taken.filter(other => overlap(grown, corners(other, 0))).length;
  const blocks = cubes.filter(cube => cube.owner !== owner && overlap(grown, cube.outline)).length;
  return (outside ? OUTSIDE_WEIGHT : 0) + texts * TEXT_WEIGHT + blocks * CUBE_WEIGHT;
}

/** A spot weighed for a label: where its text goes, the box it covers and how bad it is. */
type WeighedSpot = {
  /** The spot. */
  spot: Spot;
  /** Text x and baseline. */
  at: Point;
  /** The box the text covers there. */
  box: TextBox;
  /** How bad the spot is; `0` is clean. */
  weight: number;
};

/**
 * The best spot for a label: the first that touches no other text and no other cube, or, when
 * every spot clashes, the least bad one.
 *
 * @param label - The label.
 * @param viewport - The frame and text sizes.
 * @param taken - Boxes of the texts already placed.
 * @param cubes - The cube outlines.
 * @returns The spot, weighed.
 */
function bestSpot(
  label: WorldLabel,
  viewport: LabelViewport,
  taken: readonly TextBox[],
  cubes: readonly CubeOutline[]
): WeighedSpot {
  const [anchorX, anchorY] = label.anchor;
  const weigh = (spot: Spot): WeighedSpot => {
    const at: Point = [anchorX + spot.dx, anchorY + spot.dy];
    const box = textBox(label.text, viewport.label, MONO, at, spot.align);
    return { spot, at, box, weight: clashWeight(box, label.owner, viewport.frame, taken, cubes) };
  };

  // The spots are tried in order; the first clean one ends the search.
  const [firstSpot, ...laterSpots] = SPOTS;
  let best = weigh(firstSpot);
  for (const spot of laterSpots) {
    if (best.weight === 0) break;
    const option = weigh(spot);
    if (option.weight < best.weight) best = option;
  }
  return best;
}

/**
 * The leader tick of a label set apart from its cube: from just over the cube's lid to the
 * label's nearer edge, its foot when the label is above, its top when it is below.
 *
 * @param anchor - The lid anchor.
 * @param box - The box the label covers.
 * @returns The tick's two ends.
 */
function leaderTick(anchor: Point, box: TextBox): readonly [from: Point, to: Point] {
  const [anchorX, anchorY] = anchor;
  const tickTop = anchorY - TICK_GAP;
  const boxBottom = box.y + box.height;
  const footX = Math.min(Math.max(anchorX, box.x), box.x + box.width);
  const footY = boxBottom <= tickTop ? boxBottom : box.y;
  return [
    [anchorX, tickTop],
    [footX, footY]
  ];
}

/**
 * Put one label in the first spot that touches no other text and no other cube, or, when every
 * spot clashes, in the least bad one.
 *
 * @param label - The label.
 * @param viewport - The frame and text sizes.
 * @param taken - Boxes of the texts already placed.
 * @param cubes - The cube outlines.
 * @returns The label in its spot.
 */
function placeLabel(
  label: WorldLabel,
  viewport: LabelViewport,
  taken: readonly TextBox[],
  cubes: readonly CubeOutline[]
): PlacedLabel {
  // The label takes the best spot around its cube.
  const { spot, at, box } = bestSpot(label, viewport, taken, cubes);
  const placed: PlacedLabel = { ...label, x: at[0], y: at[1], align: spot.align, box };

  // A label set apart from its cube gets a leader tick back to it.
  if (spot.tick) placed.tick = leaderTick(label.anchor, box);
  return placed;
}

/**
 * Lay out every text of a state so none touches another text or another cube: the callouts stand
 * where they belong, then each label, best priority first, takes the first spot around its cube
 * that is clean (above, beside, higher with a leader tick, below, further out).
 *
 * @param scene - The labels, callouts and cube outlines of a state.
 * @param viewport - The visible frame and its text sizes: {@link DESKTOP_LABELS} or
 *   {@link PHONE_LABELS}.
 * @returns Where every label and callout goes.
 * @example
 * ```ts
 * // On a phone, after the island measured the media query:
 * const layout = labelPlacement(labelScene(siteGoal, state), PHONE_LABELS);
 * layout.labels.find(label => label.owner === "newsletter")?.align; // "middle", "start" or "end"
 * ```
 */
export function labelPlacement(scene: LabelScene, viewport: LabelViewport): LabelLayout {
  const callouts = scene.callouts.map(callout => placeCallout(callout, viewport));
  const taken: TextBox[] = callouts.map(callout => callout.box);
  const labels: PlacedLabel[] = [];
  for (const label of scene.labels.toSorted((first, second) => first.priority - second.priority)) {
    const placed = placeLabel(label, viewport, taken, scene.cubes);
    labels.push(placed);
    taken.push(placed.box);
  }
  return { labels, callouts };
}
