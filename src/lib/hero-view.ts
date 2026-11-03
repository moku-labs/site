/**
 * @file What the hero shows for a goal and its progress, as plain data: the world drawing as a
 * tree of SVG nodes, the tray cards, the standing chips, the code card, kernel.log and the info
 * card.
 *
 * Pure and browser-safe. The SSR components turn the nodes into Preact elements and the
 * `kernel-world` island turns them into DOM elements, so the first paint and every later state
 * are drawn by the same code. The rules are in `./assembly`, the geometry in `./hero-world`.
 */
import type { Goal, LayerId } from "../data/assembly";
import { assemblyText, layers } from "../data/assembly";
import type {
  AssemblyState,
  AssemblyVersions,
  ItemInfo,
  ItemRole,
  LogLine,
  TrayCardState
} from "./assembly";
import {
  APP_ID,
  cardNote,
  codeLines,
  fillText,
  finishEdges,
  infoFor,
  isIn,
  KERNEL_ID,
  missingNeed,
  nameOf,
  needsOf,
  trayCardState
} from "./assembly";
import type { CubeTone, GlyphName } from "./glyphs";
import { glyphPath } from "./glyphs";
import type { LabelViewport, PlacedCallout, PlacedLabel, WorldCube } from "./hero-world";
import {
  ARC_STROKE,
  cubeAnchor,
  DESKTOP_LABELS,
  HOVER_LIFT,
  KERNEL_BOX,
  labelPlacement,
  labelScene,
  needArc,
  PHONE_ARC_STROKE,
  PHONE_LABELS,
  PLATFORM_DEPTH,
  platformCells,
  platformLip,
  sceneryCubes,
  WORLD_SIZE,
  world,
  worldCubes,
  worldSockets
} from "./hero-world";
import type { IsoBoxSpec, Point } from "./iso";
import { formatPoints } from "./iso";

/** The SVG elements the world drawing uses. */
export type SvgTag =
  | "g"
  | "polygon"
  | "polyline"
  | "path"
  | "line"
  | "circle"
  | "ellipse"
  | "rect"
  | "text";

/** The attributes of a drawn element by name; `undefined` leaves an attribute out. */
export type SvgAttributes = Readonly<Record<string, string | number | undefined>>;

/** One element of the world drawing, as plain data. */
export type SvgNode = {
  /** Element name. */
  tag: SvgTag;
  /** Its attributes. */
  attributes: SvgAttributes;
  /** Its children: elements or text. */
  children: readonly SvgChild[];
};

/** A child of a drawn element: another element or a run of text. */
export type SvgChild = SvgNode | string;

/** The motion a drawing starts with; every flag off draws the state at rest. */
export type WorldMotion = {
  /** First paint: the cubes rise in, the kernel grows. */
  intro?: boolean;
  /** Pieces that just went in or started to wait: they snap into place. */
  landed?: readonly string[];
  /** Waiting pieces whose need just came in: they slide down into their socket. */
  settled?: readonly string[];
  /** The kernel flashes: a piece just went through it. */
  flash?: boolean;
  /** The finish: light runs up the needs arcs, bottom to top. */
  pulse?: boolean;
  /** The finish: the app cube rises and the completion strip fades in. */
  rise?: boolean;
};

/** What to draw: a goal, its progress and the cube whose info card is open. */
export type WorldView = {
  /** The goal. */
  goal: Goal;
  /** Its progress, as the hero shows it. */
  state: AssemblyState;
  /** The installed versions. */
  versions: AssemblyVersions;
  /** The cube whose info card is open: its needs arcs show. */
  selected?: string | undefined;
  /** The motion to start with. */
  motion?: WorldMotion;
};

/** The colour set of a drawn box. */
type Shade =
  | "ground"
  | "framework-ring"
  | "app-ring"
  | "kernel"
  | "piece"
  | "standing"
  | "app"
  | "scenery";

/** How an arc looks: a selected cube's need, a waiting piece's missing need, the finish pulse. */
type ArcKind = "need" | "wait" | "finish";

/** Id of the radial gradient that glows under the kernel. */
export const KERNEL_GLOW_ID = "hero-kernel-glow";

/** Radii of the pink glow under the kernel, across and along. */
const KERNEL_GLOW_RADIUS = { across: 150, along: 75 };

/** Colour set of each item's cube. */
const ROLE_SHADES: Readonly<Record<ItemRole, Shade>> = {
  kernel: "kernel",
  framework: "piece",
  standing: "standing",
  piece: "piece",
  app: "app"
};

/** Stroke weight of the lid glyph per item, in the glyph's 100-unit box: thinner on big lids. */
const GLYPH_WEIGHTS: Readonly<Record<ItemRole, number>> = {
  kernel: 6,
  framework: 6,
  standing: 12,
  piece: 12,
  app: 5
};

/** Stroke weight of a scenery cube's glyph. */
const SCENERY_GLYPH_WEIGHT = 13;

/** Radius of the invisible circle a finger hits on a small cube; a phone turns it on. */
const HIT_RADIUS = 36;

/** Height of the "core" sign on the kernel's left face. */
const KERNEL_SIGN_LEVEL = 0.8;

/** The ring a bracket spans, in cells along the front-left edge, from the back. */
type BracketSpan = {
  /** The layer it names. */
  layer: LayerId;
  /** Where its ring starts. */
  from: number;
  /** Where its ring ends. */
  to: number;
};

/** The ring each bracket spans. */
const BRACKET_SPANS: readonly BracketSpan[] = [
  { layer: "app", from: 0, to: 2 },
  { layer: "framework", from: 2, to: 4 },
  { layer: "kernel", from: 4, to: WORLD_SIZE }
];

/** Gap between a bracket's ends and the ring edges it spans, in cells. */
const BRACKET_INSET = 0.15;

/** How far below the platform's front-left edge a bracket runs. */
const BRACKET_DROP = 14;

/** Length of a bracket's end hooks. */
const BRACKET_HOOK = 6;

/** Baseline of a bracket's layer name below the bracket. */
const BRACKET_NAME_GAP = 22;

/** Baseline of a bracket's version below the bracket. */
const BRACKET_VERSION_GAP = 36;

/** How many kernel.log lines the code card shows: the newest. */
export const LOG_LINES = 3;

/** Face colours of the info card's cube, per item. */
const ROLE_TONES: Readonly<Record<ItemRole, CubeTone>> = {
  kernel: "kernel",
  framework: "piece",
  standing: "standing",
  piece: "piece",
  app: "app"
};

/**
 * Round to one decimal for an attribute.
 *
 * @param value - The number.
 * @returns The rounded number.
 */
function oneDecimal(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

/**
 * One element of the drawing.
 *
 * @param tag - Element name.
 * @param attributes - Its attributes.
 * @param children - Its children.
 * @returns The node.
 */
function svg(tag: SvgTag, attributes: SvgAttributes, children: readonly SvgChild[] = []): SvgNode {
  return { tag, attributes, children };
}

/**
 * A boolean `data-*` flag: present and empty when on, left out when off.
 *
 * @param on - Whether the flag is set.
 * @returns `""` or `undefined`.
 */
function flag(on: boolean): string | undefined {
  return on ? "" : undefined;
}

/**
 * A glyph lying flat on the lid of a box.
 *
 * @param box - The box.
 * @param glyph - Glyph name.
 * @param weight - Stroke weight in the glyph's 100-unit box.
 * @returns The glyph group, or nothing for a glyph without a path.
 */
function lidGlyph(box: IsoBoxSpec, glyph: GlyphName, weight: number): SvgNode[] {
  const path = glyphPath(glyph);
  if (path === "") return [];
  const { x, y, z, width, depth, height } = box;
  return [
    svg("g", { transform: world.topFaceTransform(x, y, z + height, width, depth) }, [
      svg("path", {
        "data-part": "glyph",
        d: path,
        transform: "translate(15 15) scale(.7)",
        "stroke-width": weight
      })
    ])
  ];
}

/**
 * A shaded box: left, right and top faces, then whatever lies on it.
 *
 * @param box - The box.
 * @param shade - Its colour set.
 * @param extra - Drawn on top: a glyph, a sign.
 * @returns The box group.
 */
function shadedBox(box: IsoBoxSpec, shade: Shade, extra: readonly SvgChild[] = []): SvgNode {
  const faces = world.box(box);
  return svg("g", { "data-shade": shade }, [
    svg("polygon", { "data-face": "left", points: faces.left }),
    svg("polygon", { "data-face": "right", points: faces.right }),
    svg("polygon", { "data-face": "top", points: faces.top }),
    ...extra
  ]);
}

/**
 * The grid lines on the kernel's ground.
 *
 * @returns The path data.
 */
function gridPath(): string {
  const lines: string[] = [];
  for (let index = 1; index < WORLD_SIZE; index += 1) {
    lines.push(
      `M${formatPoints([world.point(index, 0, 0)])}L${formatPoints([world.point(index, WORLD_SIZE, 0)])}`,
      `M${formatPoints([world.point(0, index, 0)])}L${formatPoints([world.point(WORLD_SIZE, index, 0)])}`
    );
  }
  return lines.join("");
}

/**
 * The world that never changes: the slab and grid of the kernel's ground, the pink glow under the
 * kernel, the two raised rings with their lips and the pink rim along the front edges.
 *
 * @returns The platform nodes, back to front.
 * @example
 * ```tsx
 * <g data-part="platform">{platformNodes().map(svgVNode)}</g>
 * ```
 */
export function platformNodes(): SvgNode[] {
  const slab: IsoBoxSpec = {
    x: 0,
    y: 0,
    z: -PLATFORM_DEPTH,
    width: WORLD_SIZE,
    depth: WORLD_SIZE,
    height: PLATFORM_DEPTH
  };
  const [glowX, glowY] = world.point(
    KERNEL_BOX.x + KERNEL_BOX.width / 2,
    KERNEL_BOX.y + KERNEL_BOX.depth / 2,
    0
  );
  const rim = [
    world.point(WORLD_SIZE, 0, 0),
    world.point(WORLD_SIZE, WORLD_SIZE, 0),
    world.point(0, WORLD_SIZE, 0)
  ];
  return [
    shadedBox(slab, "ground"),
    svg("path", { "data-part": "grid", d: gridPath() }),
    svg("ellipse", {
      "data-part": "kernel-glow",
      cx: glowX,
      cy: glowY,
      rx: KERNEL_GLOW_RADIUS.across,
      ry: KERNEL_GLOW_RADIUS.along,
      fill: `url(#${KERNEL_GLOW_ID})`
    }),
    ...platformCells().map(cell =>
      shadedBox(
        { x: cell.x, y: cell.y, z: 0, width: 1, depth: 1, height: cell.level },
        cell.layer === "app" ? "app-ring" : "framework-ring"
      )
    ),
    svg("polyline", { "data-part": "lip", points: formatPoints(platformLip("framework")) }),
    svg("polyline", { "data-part": "lip", points: formatPoints(platformLip("app")) }),
    svg("polyline", { "data-part": "rim", points: formatPoints(rim) })
  ];
}

/**
 * A point of a bracket: under the platform's front-left edge, at a distance along it.
 *
 * @param along - Cells from the back corner.
 * @returns The SVG point.
 */
function bracketEnd(along: number): Point {
  const [x, y] = world.point(along, WORLD_SIZE, -PLATFORM_DEPTH);
  return [x, y + BRACKET_DROP];
}

/**
 * The top of a bracket's end hook.
 *
 * @param point - An end of the bracket.
 * @returns The point the hook rises to.
 */
function bracketHook(point: Point): Point {
  return [point[0], point[1] - BRACKET_HOOK];
}

/**
 * One text of a bracket, centred under it.
 *
 * @param part - The bracket's name or its version.
 * @param x - Centre.
 * @param y - Baseline.
 * @param text - The text.
 * @returns The text node.
 */
function bracketText(
  part: "bracket-name" | "bracket-version",
  x: number,
  y: number,
  text: string
): SvgNode {
  return svg("text", { "data-part": part, x, y: oneDecimal(y), "text-anchor": "middle" }, [text]);
}

/**
 * One layer bracket: the line under its ring's span of the edge, its layer's name, and its
 * version when it has one.
 *
 * @param span - The ring it spans.
 * @param version - The version it shows, if any.
 * @returns The bracket group.
 */
function bracketNode(span: BracketSpan, version: string | undefined): SvgNode {
  // The line runs under the ring's span of the front-left edge, hooked up at both ends.
  const start = bracketEnd(span.from + BRACKET_INSET);
  const end = bracketEnd(span.to - BRACKET_INSET);
  const line = svg("polyline", {
    points: formatPoints([bracketHook(start), start, end, bracketHook(end)])
  });

  // The layer's name and its version stand centred under the line.
  const middleX = oneDecimal((start[0] + end[0]) / 2);
  const middleY = (start[1] + end[1]) / 2;
  const name = layers.find(entry => entry.id === span.layer)?.name ?? span.layer;
  const nameText = bracketText("bracket-name", middleX, middleY + BRACKET_NAME_GAP, name);
  const versionText =
    version === undefined
      ? []
      : [bracketText("bracket-version", middleX, middleY + BRACKET_VERSION_GAP, version)];
  return svg("g", { "data-part": "bracket", "data-layer": span.layer }, [
    line,
    nameText,
    ...versionText
  ]);
}

/**
 * The layer brackets under the platform's front-left edge: each layer's name, and the version of
 * the framework and of the kernel.
 *
 * @param goal - The goal.
 * @param versions - The installed versions.
 * @returns The brackets group.
 */
function bracketNodes(goal: Goal, versions: AssemblyVersions): SvgNode {
  // Only the framework and the kernel show a version: the installed one (D1).
  const versionOf: Readonly<Record<LayerId, string | undefined>> = {
    app: undefined,
    framework: fillText(assemblyText.frameworkSign, {
      framework: goal.framework.id,
      version: versions[goal.framework.id]
    }),
    kernel: fillText(assemblyText.kernelSign, { core: versions.core })
  };
  return svg(
    "g",
    { "data-part": "brackets" },
    BRACKET_SPANS.map(span => bracketNode(span, versionOf[span.layer]))
  );
}

/**
 * The dimmed family packages on the outer ring, without labels.
 *
 * @param goal - The goal.
 * @returns The scenery group.
 */
function sceneryNodes(goal: Goal): SvgNode {
  return svg(
    "g",
    { "data-part": "scenery", "aria-hidden": "true" },
    sceneryCubes(goal).flatMap(cube => [
      svg("polygon", { "data-part": "shadow", points: formatPoints(cube.shadow) }),
      shadedBox(cube.box, "scenery", lidGlyph(cube.box, cube.package, SCENERY_GLYPH_WEIGHT))
    ])
  );
}

/**
 * The empty sockets: one per piece not in, the app's until it runs.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @returns The sockets group.
 */
function socketNodes(goal: Goal, state: AssemblyState): SvgNode {
  return svg(
    "g",
    { "data-part": "sockets" },
    worldSockets(goal, state).map(socket =>
      svg("polygon", {
        "data-socket": socket.id,
        "data-wanted": flag(socket.wanted),
        points: formatPoints(socket.outline)
      })
    )
  );
}

/**
 * The screen-reader name of a cube or chip: what it is, where it comes from, and that it opens
 * its details.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @param id - Item id.
 * @param versions - The installed versions.
 * @returns The name; the bare id for an id outside the goal.
 * @example
 * ```ts
 * itemLabel(siteGoal, state, "core", versions);
 * // "kernel, @moku-labs/core 1.7.6. Drop pieces here. Show details"
 * ```
 */
export function itemLabel(
  goal: Goal,
  state: AssemblyState,
  id: string,
  versions: AssemblyVersions
): string {
  const info = infoFor(goal, id, versions);
  if (info === undefined) return id;

  // Every cube says what it is and where it comes from; a waiting piece also says that it waits,
  // and the kernel that the pieces are dropped on it.
  const { aria } = assemblyText;
  let template = aria.item;
  if (state.waiting.includes(id)) template = aria.waiting;
  if (id === KERNEL_ID) template = aria.kernel;
  return fillText(template, { name: info.name, source: info.source });
}

/**
 * The motion a cube starts with.
 *
 * @param cube - The cube.
 * @param motion - The drawing's motion.
 * @returns The `data-motion` value, if any.
 */
function cubeMotion(cube: WorldCube, motion: WorldMotion): string | undefined {
  if (motion.intro === true) return "intro";
  if (cube.role === "app" && motion.rise === true) return "rise";
  if (motion.settled?.includes(cube.id) === true) return "settle";
  if (motion.landed?.includes(cube.id) === true) return "snap";
  return undefined;
}

/**
 * The kernel's sign: its version on the left face.
 *
 * @param versions - The installed versions.
 * @returns The sign text.
 */
function kernelSign(versions: AssemblyVersions): SvgNode {
  const [x, y] = world.point(
    KERNEL_BOX.x + KERNEL_BOX.width / 2,
    KERNEL_BOX.y + KERNEL_BOX.depth,
    KERNEL_SIGN_LEVEL
  );
  return svg(
    "text",
    {
      "data-part": "sign",
      "text-anchor": "middle",
      transform: `matrix(1 .5 0 1 ${oneDecimal(x)} ${oneDecimal(y)})`
    },
    [fillText(assemblyText.kernelSign, { core: versions.core })]
  );
}

/**
 * The attributes of a cube's group: which item it is, its states, and its button semantics.
 *
 * @param view - What is drawn.
 * @param cube - The cube.
 * @returns The attributes.
 */
function itemAttributes(view: WorldView, cube: WorldCube): SvgAttributes {
  const { goal, state, versions, selected, motion = {} } = view;
  return {
    "data-item": cube.id,
    "data-role": cube.role,
    "data-waiting": flag(cube.waiting),
    "data-selected": flag(selected === cube.id),
    "data-flash": flag(cube.role === "kernel" && motion.flash === true),
    tabindex: 0,
    role: "button",
    "aria-label": itemLabel(goal, state, cube.id, versions)
  };
}

/**
 * A cube's body, lifted: the hover group carries the waiting lift, the lift group inside it the
 * lift on hover and focus.
 *
 * @param cube - The cube.
 * @param body - The box and its finger target.
 * @returns The hover group.
 */
function liftedBox(cube: WorldCube, body: readonly SvgChild[]): SvgNode {
  const transform = cube.lift === 0 ? undefined : `translate(0 ${-cube.lift})`;
  return svg("g", { "data-part": "hover", transform }, [svg("g", { "data-part": "lift" }, body)]);
}

/**
 * One cube of the world: its shadow, the box with its glyph, and on a small cube the circle a
 * finger hits. Focusable; Enter or a tap opens its info card.
 *
 * @param view - What is drawn.
 * @param cube - The cube.
 * @returns The cube group.
 */
function cubeNode(view: WorldView, cube: WorldCube): SvgNode {
  const { versions, motion = {} } = view;
  const { box, role } = cube;

  // The body: the shaded box with its lid glyph, and on the kernel its version.
  const sign = role === "kernel" ? [kernelSign(versions)] : [];
  const glyph = lidGlyph(box, cube.glyph, GLYPH_WEIGHTS[role]);
  const body = shadedBox(box, ROLE_SHADES[role], [...glyph, ...sign]);

  // A small cube gets an invisible circle a finger can hit, at the middle of the box.
  const isSmall = role === "standing" || role === "piece";
  const [hitX, hitY] = world.point(
    box.x + box.width / 2,
    box.y + box.depth / 2,
    box.z + box.height / 2
  );
  const hit = isSmall
    ? [svg("circle", { "data-part": "hit", cx: hitX, cy: hitY, r: HIT_RADIUS })]
    : [];

  // A cube standing on a platform casts its shadow there; it stays put while the cube hovers.
  const shadow =
    cube.shadow.length === 0
      ? []
      : [svg("polygon", { "data-part": "shadow", points: formatPoints(cube.shadow) })];

  // The motion wrapper carries the cube's depth, which staggers the intro back to front.
  const depth = oneDecimal(box.x + box.width / 2 + box.y + box.depth / 2);
  return svg("g", itemAttributes(view, cube), [
    svg("g", { "data-motion": cubeMotion(cube, motion), style: `--d:${depth}` }, [
      ...shadow,
      liftedBox(cube, [body, ...hit])
    ])
  ]);
}

/**
 * A needs arc with its arrowhead, at the desktop and the phone stroke; a finish arc also carries
 * the spark that runs along it.
 *
 * @param kind - How it looks.
 * @param from - Lid anchor of the cube that needs.
 * @param to - Lid anchor of the cube it needs.
 * @param order - When a finish arc lights, bottom to top.
 * @returns The arc group.
 */
function arcNode(kind: ArcKind, from: Point, to: Point, order = 0): SvgNode {
  const arc = needArc(from, to, ARC_STROKE);
  const phone = needArc(from, to, PHONE_ARC_STROKE);
  const isFinish = kind === "finish";
  return svg(
    "g",
    { "data-arc": kind, style: isFinish ? `--t:${order};--len:${arc.length}` : undefined },
    [
      svg("path", { "data-part": "arc-line", d: arc.path }),
      svg("polygon", {
        "data-part": "arrow",
        "data-size": "desktop",
        points: formatPoints(arc.head)
      }),
      svg("polygon", {
        "data-part": "arrow",
        "data-size": "phone",
        points: formatPoints(phone.head)
      }),
      ...(isFinish ? [svg("path", { "data-part": "spark", d: arc.path })] : [])
    ]
  );
}

/**
 * Lid anchor of an item; the origin for an id outside the goal.
 *
 * @param goal - The goal.
 * @param id - Item id.
 * @returns The SVG point.
 */
function anchorOf(goal: Goal, id: string): Point {
  return cubeAnchor(goal, id) ?? [0, 0];
}

/**
 * The finish pulse: one arc per needs edge, lit bottom to top.
 *
 * @param view - What is drawn.
 * @returns The arcs; none outside the finish.
 */
function finishArcs(view: WorldView): SvgNode[] {
  const { goal, motion = {} } = view;
  if (motion.pulse !== true) return [];
  return finishEdges(goal).map(edge =>
    arcNode("finish", anchorOf(goal, edge.from), anchorOf(goal, edge.to), edge.order)
  );
}

/**
 * The amber arc of each waiting piece, from where it hovers to the need it waits for.
 *
 * @param view - What is drawn.
 * @returns The arcs.
 */
function waitingArcs(view: WorldView): SvgNode[] {
  const { goal, state } = view;
  return state.waiting.flatMap(id => {
    const need = missingNeed(goal, state, id);
    if (need === undefined) return [];
    const [x, y] = anchorOf(goal, id);
    return [arcNode("wait", [x, y - HOVER_LIFT], anchorOf(goal, need))];
  });
}

/**
 * Whether the selected cube shows its needs arcs.
 *
 * @param view - What is drawn.
 * @returns `true` for a selected cube that is in, or the app.
 */
function showsSelectedNeeds(view: WorldView): boolean {
  const { goal, state, selected, motion = {} } = view;
  // The finish pulse owns the arcs, a waiting piece already shows its amber arc, and a piece not
  // in yet has no cube to point from; the app points from its socket.
  if (selected === undefined || motion.pulse === true || state.waiting.includes(selected)) {
    return false;
  }
  return selected === APP_ID || isIn(goal, state, selected);
}

/**
 * The selected cube's needs arcs, to each need that is in.
 *
 * @param view - What is drawn.
 * @returns The arcs; none when nothing is selected or the selected cube shows none.
 */
function selectedNeedArcs(view: WorldView): SvgNode[] {
  const { goal, state, selected } = view;
  if (selected === undefined || !showsSelectedNeeds(view)) return [];
  return needsOf(goal, selected)
    .filter(need => need === KERNEL_ID || isIn(goal, state, need))
    .map(need => arcNode("need", anchorOf(goal, selected), anchorOf(goal, need)));
}

/**
 * The arcs a state shows: the finish pulse, each waiting piece's missing need, and the needs of
 * the selected cube that are in.
 *
 * @param view - What is drawn.
 * @returns The arcs group.
 */
function arcNodes(view: WorldView): SvgNode {
  return svg("g", { "data-part": "arcs", "aria-hidden": "true" }, [
    ...finishArcs(view),
    ...waitingArcs(view),
    ...selectedNeedArcs(view)
  ]);
}

/**
 * A fixed text: the app's name over its cube, or the pill of a waiting callout or the completion
 * strip.
 *
 * @param callout - The placed callout.
 * @param viewport - The text sizes.
 * @param motion - The drawing's motion.
 * @returns The callout node.
 */
function calloutNode(
  callout: PlacedCallout,
  viewport: LabelViewport,
  motion: WorldMotion
): SvgNode {
  const at = { x: oneDecimal(callout.x), y: oneDecimal(callout.y), "text-anchor": "middle" };
  if (callout.kind === "app") {
    return svg("text", { "data-callout": "app", ...at, "font-size": viewport.appLabel }, [
      callout.text
    ]);
  }
  const { box } = callout;
  const isLate = callout.kind === "running" && motion.rise === true;
  return svg("g", { "data-callout": callout.kind, "data-motion": isLate ? "late" : undefined }, [
    svg("rect", {
      x: oneDecimal(box.x),
      y: oneDecimal(box.y),
      width: oneDecimal(box.width),
      height: oneDecimal(box.height),
      rx: oneDecimal(box.height / 2)
    }),
    svg("text", { ...at, "font-size": viewport.callout }, [callout.text])
  ]);
}

/**
 * One name over a cube or socket, with its leader tick when it stands apart.
 *
 * @param label - The placed label.
 * @param viewport - The text sizes.
 * @param motion - The drawing's motion: a settling cube's name slides down with it.
 * @returns The tick, if any, then the text.
 */
function labelNode(label: PlacedLabel, viewport: LabelViewport, motion: WorldMotion): SvgNode[] {
  // A label set apart from its cube gets a leader tick back to it.
  const tick =
    label.tick === undefined
      ? []
      : [
          svg("line", {
            "data-part": "tick",
            x1: oneDecimal(label.tick[0][0]),
            y1: oneDecimal(label.tick[0][1]),
            x2: oneDecimal(label.tick[1][0]),
            y2: oneDecimal(label.tick[1][1])
          })
        ];

  // The name, at the size of its viewport.
  const settles = motion.settled?.includes(label.owner) === true;
  const text = svg(
    "text",
    {
      "data-label": label.tone,
      "data-motion": settles ? "settle" : undefined,
      x: oneDecimal(label.x),
      y: oneDecimal(label.y),
      "text-anchor": label.align,
      "font-size": viewport.label
    },
    [label.text]
  );
  return [...tick, text];
}

/**
 * Every text of the world for one viewport: the names over the cubes and sockets, each where it
 * touches no other text or cube, and the callouts.
 *
 * @param view - What is drawn.
 * @param viewport - The frame and its text sizes.
 * @param size - Which viewport, for the CSS that shows one layer.
 * @returns The label layer.
 */
function labelNodes(view: WorldView, viewport: LabelViewport, size: "desktop" | "phone"): SvgNode {
  const { goal, state, motion = {} } = view;
  const layout = labelPlacement(labelScene(goal, state), viewport);
  const labels = layout.labels.flatMap(label => labelNode(label, viewport, motion));
  const callouts = layout.callouts.map(callout => calloutNode(callout, viewport, motion));
  return svg("g", { "data-labels": size, "aria-hidden": "true" }, [...labels, ...callouts]);
}

/**
 * The part of the world that follows the goal and its progress: the layer brackets, the scenery,
 * the sockets, the cubes in painter's order, the arcs, and the labels for a desktop and a phone.
 *
 * @param view - The goal, its progress, the versions, the selected cube and the motion.
 * @returns The scene nodes, back to front.
 * @example
 * ```ts
 * // The first paint of the Site goal, and after comments came first:
 * worldScene({ goal: siteGoal, state: initialAssembly(siteGoal, versions), versions, motion: { intro: true } });
 * worldScene({ goal: siteGoal, state: waiting, versions, motion: { landed: ["comments"], flash: true } });
 * ```
 */
export function worldScene(view: WorldView): SvgNode[] {
  const { goal, state, versions } = view;
  return [
    bracketNodes(goal, versions),
    sceneryNodes(goal),
    socketNodes(goal, state),
    svg(
      "g",
      { "data-part": "cubes" },
      worldCubes(goal, state).map(cube => cubeNode(view, cube))
    ),
    arcNodes(view),
    labelNodes(view, DESKTOP_LABELS, "desktop"),
    labelNodes(view, PHONE_LABELS, "phone")
  ];
}

/** How a run of code is coloured. */
export type CodeTokenKind = "keyword" | "string" | "function" | "plugin";

/** A run of code with its colour; plain text has no kind. */
export type CodeToken = {
  /** The text. */
  text: string;
  /** Its colour, if any. */
  kind?: CodeTokenKind;
};

/** Strings, keywords, the two factories and plugin names, in that order of preference. */
const CODE_PATTERN =
  /("[^"]*")|\b(import|from|export|const)\b|\b(createApp|defineFeature)\b|\b(\w+Plugin|screen)\b/g;

/** The token kind of each capture group of {@link CODE_PATTERN}, in group order. */
const CODE_GROUP_KINDS: readonly CodeTokenKind[] = ["string", "keyword", "function", "plugin"];

/**
 * Split a code line into coloured runs: strings, keywords, `createApp` and `defineFeature`, and
 * plugin names.
 *
 * @param line - One line of the code card.
 * @returns The runs; joined, they give the line back.
 * @example
 * ```ts
 * highlightCode('import { createApp } from "@moku-labs/web";');
 * // [{ text: "import", kind: "keyword" }, { text: " { " }, { text: "createApp", kind: "function" }, …]
 * ```
 */
export function highlightCode(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let last = 0;
  for (const match of line.matchAll(CODE_PATTERN)) {
    if (match.index > last) tokens.push({ text: line.slice(last, match.index) });
    const group = match.slice(1).findIndex(capture => capture !== undefined);
    const kind = CODE_GROUP_KINDS[group] ?? "plugin";
    tokens.push({ text: match[0], kind });
    last = match.index + match[0].length;
  }
  if (last < line.length) tokens.push({ text: line.slice(last) });
  return tokens;
}

/** One tray card. */
export type TrayCard = {
  /** Piece id; also its name. */
  id: string;
  /** Glyph on its cube icon. */
  glyph: GlyphName;
  /** How it looks. */
  state: TrayCardState;
  /** The line under its name. */
  note: string;
  /** Its screen-reader name: the piece, its note and what pressing it does. */
  label: string;
};

/** One standing chip: the framework or a plugin standing from the start. */
export type StandingChip = {
  /** Item id; also the chip's text. */
  id: string;
  /** Its screen-reader name. */
  label: string;
};

/** One line of the code card. */
export type CodeRow = {
  /** Line number, from 1. */
  number: number;
  /** The coloured runs. */
  tokens: readonly CodeToken[];
  /** The last step changed it: it carries the new-line mark. */
  isNew: boolean;
};

/** Everything around the world the hero shows for a state. */
export type HeroPanel = {
  /** Tray heading: "Pieces for <app>", or "Now try another app" once it runs. */
  heading: string;
  /** Tray hint: how to add, or that the app runs. */
  hint: string;
  /** The three tray cards. */
  cards: readonly TrayCard[];
  /** The lead-in of the standing chips. */
  standingLead: string;
  /** The framework and its standing plugins. */
  chips: readonly StandingChip[];
  /** The code card. */
  code: readonly CodeRow[];
  /** The newest kernel.log lines. */
  log: readonly LogLine[];
  /** The newest line, for the phone's verdict line. */
  verdict: LogLine | undefined;
};

/** The screen-reader name of a tray card, by how it looks: add it, see why it waits, or it is in. */
const CARD_ARIA: Readonly<Record<TrayCardState, string>> = {
  idle: assemblyText.aria.cardAdd,
  next: assemblyText.aria.cardAdd,
  waiting: assemblyText.aria.cardWaiting,
  placed: assemblyText.aria.cardPlaced
};

/**
 * One tray card for a piece.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @param id - Piece id.
 * @param glyph - The piece's glyph.
 * @returns The card.
 */
function trayCard(goal: Goal, state: AssemblyState, id: string, glyph: GlyphName): TrayCard {
  const cardState = trayCardState(goal, state, id);
  const note = cardNote(goal, state, id);
  const label = fillText(CARD_ARIA[cardState], { piece: id, note });
  return { id, glyph, state: cardState, note, label };
}

/**
 * Everything around the world for a state: the tray heading and hint, the cards, the standing
 * chips, the code card, the newest log lines and the phone's verdict line.
 *
 * @param goal - The goal.
 * @param state - Its progress, as the hero shows it.
 * @param versions - The installed versions.
 * @returns The panel.
 * @example
 * ```ts
 * heroPanel(siteGoal, initialAssembly(siteGoal, versions), versions).heading; // "Pieces for Field Notes"
 * ```
 */
export function heroPanel(goal: Goal, state: AssemblyState, versions: AssemblyVersions): HeroPanel {
  const app = goal.app.name;
  const standing = [goal.framework.id, ...goal.standing.map(plugin => plugin.id)];
  return {
    heading: state.complete
      ? assemblyText.trayHeadingDone
      : fillText(assemblyText.trayHeading, { app }),
    hint: state.complete ? fillText(assemblyText.trayHintDone, { app }) : assemblyText.trayHint,
    cards: goal.pieces.map(piece => trayCard(goal, state, piece.id, piece.glyph)),
    standingLead: fillText(assemblyText.standingLead, { framework: goal.framework.id }),
    chips: standing.map(id => ({ id, label: itemLabel(goal, state, id, versions) })),
    code: codeLines(goal, state).map((line, index) => ({
      number: index + 1,
      tokens: highlightCode(line.text),
      isNew: line.isNew
    })),
    log: state.log.slice(-LOG_LINES),
    verdict: state.log.at(-1)
  };
}

/** The info card of an item. */
export type InfoCard = ItemInfo & {
  /** Face colours of its cube icon. */
  tone: CubeTone;
  /** A line on where it stands: waiting, not in yet, not running yet. */
  status?: string;
  /** The label of its Add button, for a piece not in yet. */
  add?: string;
};

/**
 * The status line and the Add button of an info card.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @param info - The item.
 * @returns The status and the button label, each left out when the card has none.
 */
function infoStatus(
  goal: Goal,
  state: AssemblyState,
  info: ItemInfo
): Pick<InfoCard, "status" | "add"> {
  const { info: text } = assemblyText;
  if (info.role === "app") return state.complete ? {} : { status: text.notRunning };
  if (info.role !== "piece" || state.placed.includes(info.id)) return {};
  const need = missingNeed(goal, state, info.id);
  if (state.waiting.includes(info.id)) {
    return { status: fillText(text.waiting, { need: nameOf(goal, need ?? "") }) };
  }
  return { status: text.notInYet, add: fillText(text.add, { piece: info.id }) };
}

/**
 * The info card of any cube, socket or chip: what the item is, what it needs and who needs it,
 * where it stands and, for a piece not in yet, its Add button.
 *
 * @param goal - The goal.
 * @param state - Its progress, as the hero shows it.
 * @param id - Item id.
 * @param versions - The installed versions.
 * @returns The card, or `undefined` for an id outside the goal.
 * @example
 * ```ts
 * infoCard(siteGoal, initialAssembly(siteGoal, versions), "content", versions)?.add; // "Add content"
 * ```
 */
export function infoCard(
  goal: Goal,
  state: AssemblyState,
  id: string,
  versions: AssemblyVersions
): InfoCard | undefined {
  const info = infoFor(goal, id, versions);
  if (info === undefined) return undefined;
  return { ...info, tone: ROLE_TONES[info.role], ...infoStatus(goal, state, info) };
}
