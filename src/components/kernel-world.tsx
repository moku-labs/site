/**
 * @file The hero world (design §7): a 10×10 isometric platform with terraces, the package blocks,
 * the pink kernel with its five sockets, and the Claude plugin floating above. Drawn at build;
 * the `kernel-world` island fills sockets and lifts blocks.
 */
import type { VNode } from "preact";
import type { TrayPlugin } from "../data/tray";
import type { BlockPlace, WorldItem } from "../lib/hero-world";
import {
  BLOCK_INSET,
  CLAUDE_BOX,
  KERNEL_BOX,
  PHONE_LABEL_UNITS,
  PHONE_WINDOW,
  PLATFORM_DEPTH,
  SOCKET_BLOCK_HEIGHT,
  SOCKET_BLOCK_INSET,
  socketLabelLift,
  WORLD_SIZE,
  WORLD_VIEW_BOX,
  windowFraming,
  world,
  worldItems
} from "../lib/hero-world";
import type { HomePackage } from "../lib/home-data";
import type { IsoBoxSpec } from "../lib/iso";
import { formatPoints } from "../lib/iso";
import type { UrlBuilder } from "../lib/url-builder";
import type { IsoTone } from "./iso-shapes";
import { IsoBox, IsoGlyph } from "./iso-shapes";

/** Props of {@link KernelWorld}. */
type KernelWorldProperties = {
  /** The family, in family order. */
  packages: readonly HomePackage[];
  /** The plugins in the sockets, in socket order. */
  accepted: readonly TrayPlugin[];
  /** Installed `@moku-labs/core` version, for the kernel's tooltip. */
  kernelVersion: string;
  /** Route link builder. */
  url: UrlBuilder;
};

/** Gap between a block's lid and its label. */
const LABEL_GAP = 13;

/** Gap between a socket's plugin block and its label. */
const SOCKET_LABEL_GAP = 16;

/** Offset from a cell's corner to its middle, where labels stand. */
const CELL_MIDDLE = 0.5;

/** A package block's shadow inside its cell: shifted toward the front corner. */
const SHADOW_SQUARE: CellSquare = { near: 0.2, far: 0.9 };

/** A socket's dashed outline inside its cell. */
const SOCKET_OUTLINE_SQUARE: CellSquare = { near: 0.12, far: 0.88 };

/** Stroke weight of the glyph on a package or plugin block. */
const BLOCK_GLYPH_WEIGHT = 13;

/** Stroke weight of the glyph on the kernel, thinner since the cube is larger. */
const KERNEL_GLYPH_WEIGHT = 6;

/** Stroke weight of the glyph on the floating Claude block. */
const CLAUDE_GLYPH_WEIGHT = 12;

/** Grid x and y of the point the Claude block floats over, and its wire starts from. */
const CLAUDE_ANCHOR = 0.6;

/** Tone of a terrace cell, by ring: the outer ring first. */
const TERRACE_TONES: readonly [IsoTone, IsoTone] = ["terrace-1", "terrace-2"];

/** A square on the ground inside one cell, as offsets from the cell's corner. */
type CellSquare = {
  /** Offset of the back corner along x and y. */
  near: number;
  /** Offset of the front corner along x and y. */
  far: number;
};

/**
 * The points of a square inside a cell, at a height.
 *
 * @param x - Cell along x.
 * @param y - Cell along y.
 * @param z - Height of the square.
 * @param square - Its offsets inside the cell.
 * @returns The polygon points.
 */
function cellSquarePoints(x: number, y: number, z: number, square: CellSquare): string {
  const { near, far } = square;
  return formatPoints([
    world.point(x + near, y + near, z),
    world.point(x + far, y + near, z),
    world.point(x + far, y + far, z),
    world.point(x + near, y + far, z)
  ]);
}

/**
 * The platform: a slab under the ground, the cell grid and the pink rim on the two front edges.
 *
 * @returns The platform group.
 */
function Platform(): VNode {
  const lines: string[] = [];
  for (let index = 1; index < WORLD_SIZE; index += 1) {
    lines.push(
      `M${formatPoints([world.point(index, 0, 0)])}L${formatPoints([world.point(index, WORLD_SIZE, 0)])}`,
      `M${formatPoints([world.point(0, index, 0)])}L${formatPoints([world.point(WORLD_SIZE, index, 0)])}`
    );
  }
  const rim = formatPoints([
    world.point(WORLD_SIZE, 0, 0),
    world.point(WORLD_SIZE, WORLD_SIZE, 0),
    world.point(0, WORLD_SIZE, 0)
  ]);
  const slab: IsoBoxSpec = {
    x: 0,
    y: 0,
    z: -PLATFORM_DEPTH,
    width: WORLD_SIZE,
    depth: WORLD_SIZE,
    height: PLATFORM_DEPTH
  };
  return (
    <g data-part="platform">
      <IsoBox projection={world} box={slab} tone="ground" />
      <path data-part="grid" d={lines.join("")} />
      <polyline data-part="rim" points={rim} />
    </g>
  );
}

/**
 * A text label centred above a point of the grid.
 *
 * @param props - Component props.
 * @param props.x - Grid x of the label's anchor.
 * @param props.y - Grid y.
 * @param props.z - Height of the anchor.
 * @param props.gap - Screen gap above the anchor.
 * @param props.text - The label.
 * @param props.part - `data-part` of the text.
 * @returns The `<text>`.
 */
function GridLabel(props: {
  x: number;
  y: number;
  z: number;
  gap: number;
  text: string;
  part: string;
}): VNode {
  const [x, y] = world.point(props.x, props.y, props.z);
  return (
    <text data-part={props.part} x={x} y={y - props.gap} text-anchor="middle">
      {props.text}
    </text>
  );
}

/** Radius of the invisible hit circle behind a block: 64 units are 41px on a 320px phone. */
const HIT_RADIUS = 32;

/**
 * An invisible circle around a block's middle. On a phone CSS turns it on, so a finger gets a
 * target of at least 40px for a block that is drawn smaller than that.
 *
 * @param props - Component props.
 * @param props.x - Grid x of the block's middle.
 * @param props.y - Grid y.
 * @param props.z - Height of the block's middle.
 * @returns The `<circle>`.
 */
function HitArea(props: { x: number; y: number; z: number }): VNode {
  const [cx, cy] = world.point(props.x, props.y, props.z);
  return <circle data-part="hit" cx={cx} cy={cy} r={HIT_RADIUS} />;
}

/**
 * One package block: its shadow on the ground, then the block, its glyph and its label. Hover and
 * focus show the tooltip; click opens the docs (the island navigates).
 *
 * @param props - Component props.
 * @param props.entry - The package.
 * @param props.place - Where it stands.
 * @param props.href - Its docs page.
 * @returns The shadow and the block group.
 */
function PackageBlock(props: { entry: HomePackage; place: BlockPlace; href: string }): VNode {
  const { entry, place, href } = props;
  const { x, y, level, height } = place;
  const size = 1 - 2 * BLOCK_INSET;
  const box: IsoBoxSpec = {
    x: x + BLOCK_INSET,
    y: y + BLOCK_INSET,
    z: level,
    width: size,
    depth: size,
    height
  };
  const shadow = cellSquarePoints(x, y, level, SHADOW_SQUARE);
  return (
    <>
      <polygon data-part="shadow" points={shadow} />
      {/* biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be an HTML link; the island navigates on click and Enter */}
      <g
        data-part="block"
        data-href={href}
        data-tip-title={entry.name}
        data-tip-version={entry.versionLabel}
        data-tip-text={entry.tagline}
        data-tip-action="Open the docs"
        tabIndex={0}
        role="link"
        aria-label={`${entry.name} ${entry.versionLabel}. ${entry.tagline}`}
        style={{ "--depth": x + y }}
      >
        <IsoBox projection={world} box={box} tone="block">
          <IsoGlyph projection={world} box={box} glyph={entry.id} weight={BLOCK_GLYPH_WEIGHT} />
        </IsoBox>
        <HitArea x={x + CELL_MIDDLE} y={y + CELL_MIDDLE} z={level + height / 2} />
        <GridLabel
          x={x + CELL_MIDDLE}
          y={y + CELL_MIDDLE}
          z={level + height}
          gap={LABEL_GAP}
          text={entry.id}
          part="label"
        />
      </g>
    </>
  );
}

/**
 * One socket next to the kernel: a dashed outline while empty, a plugin block once filled. The
 * block is always drawn so the island only fills its glyph and label.
 *
 * @param props - Component props.
 * @param props.index - Fill order.
 * @param props.x - Cell along x.
 * @param props.y - Cell along y.
 * @param props.plugin - The plugin in it, if any.
 * @returns The socket group.
 */
function Socket(props: {
  index: number;
  x: number;
  y: number;
  plugin: TrayPlugin | undefined;
}): VNode {
  const { index, x, y, plugin } = props;
  const outline = cellSquarePoints(x, y, 0, SOCKET_OUTLINE_SQUARE);
  const size = 1 - 2 * SOCKET_BLOCK_INSET;
  const box: IsoBoxSpec = {
    x: x + SOCKET_BLOCK_INSET,
    y: y + SOCKET_BLOCK_INSET,
    z: 0,
    width: size,
    depth: size,
    height: SOCKET_BLOCK_HEIGHT
  };
  return (
    <g data-part="socket" data-index={index} data-filled={plugin ? "" : undefined}>
      <polygon data-part="outline" points={outline} />
      <g data-part="plugin">
        <IsoBox projection={world} box={box} tone="block">
          <IsoGlyph
            projection={world}
            box={box}
            glyph={plugin?.glyph ?? "none"}
            weight={BLOCK_GLYPH_WEIGHT}
          />
        </IsoBox>
        <GridLabel
          x={x + CELL_MIDDLE}
          y={y + CELL_MIDDLE}
          z={SOCKET_BLOCK_HEIGHT}
          gap={SOCKET_LABEL_GAP + socketLabelLift(index)}
          text={plugin?.plugin ?? ""}
          part="plugin-label"
        />
      </g>
    </g>
  );
}

/**
 * The kernel: the pink 2×2×2 cube with the nested-square glyph. Drop target of the tray.
 *
 * @param props - Component props.
 * @param props.version - Installed `@moku-labs/core` version.
 * @returns The kernel group.
 */
function Kernel(props: { version: string }): VNode {
  return (
    // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: focusable only to show its tip; a named image is its role
    <g
      data-part="kernel"
      tabIndex={0}
      role="img"
      aria-label="The kernel. Drop plugins here."
      data-tip-title="the kernel"
      data-tip-version={`@moku-labs/core ${props.version}`}
      data-tip-text="Every plugin is checked here before the app starts. Duplicates, missing deps and reserved names stay out."
      data-tip-action="Drop a plugin on it"
    >
      <IsoBox projection={world} box={KERNEL_BOX} tone="kernel">
        <IsoGlyph projection={world} box={KERNEL_BOX} glyph="kernel" weight={KERNEL_GLYPH_WEIGHT} />
      </IsoBox>
    </g>
  );
}

/**
 * The Claude plugin floating above the far corner, wired to the kernel by a dashed line.
 *
 * @param props - Component props.
 * @param props.entry - The Claude plugin package.
 * @param props.href - Its docs page.
 * @returns The line and the block.
 */
function ClaudeBlock(props: { entry: HomePackage; href: string }): VNode {
  const { entry, href } = props;
  const [fromX, fromY] = world.point(CLAUDE_ANCHOR, CLAUDE_ANCHOR, CLAUDE_BOX.z);
  const [toX, toY] = world.point(
    KERNEL_BOX.x + KERNEL_BOX.width / 2,
    KERNEL_BOX.y + KERNEL_BOX.depth / 2,
    KERNEL_BOX.height
  );
  return (
    <>
      <line data-part="wire" x1={fromX} y1={fromY} x2={toX} y2={toY} />
      {/* biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be an HTML link; the island navigates on click and Enter */}
      <g
        data-part="block"
        data-floating=""
        data-href={href}
        data-tip-title={entry.name}
        data-tip-version={entry.versionLabel}
        data-tip-text={entry.tagline}
        data-tip-action="Open the docs"
        tabIndex={0}
        role="link"
        aria-label={`${entry.name} ${entry.versionLabel}. ${entry.tagline}`}
      >
        <IsoBox projection={world} box={CLAUDE_BOX} tone="block">
          <IsoGlyph
            projection={world}
            box={CLAUDE_BOX}
            glyph="claude"
            weight={CLAUDE_GLYPH_WEIGHT}
            accent
          />
        </IsoBox>
        <HitArea
          x={CLAUDE_BOX.x + CLAUDE_BOX.width / 2}
          y={CLAUDE_BOX.y + CLAUDE_BOX.depth / 2}
          z={CLAUDE_BOX.z + CLAUDE_BOX.height / 2}
        />
        <GridLabel
          x={CLAUDE_ANCHOR}
          y={CLAUDE_ANCHOR}
          z={CLAUDE_BOX.z + CLAUDE_BOX.height}
          gap={LABEL_GAP}
          text="claude plugin"
          part="label"
        />
      </g>
    </>
  );
}

/**
 * One item of the world in painter's order: a terrace cell, a socket, the kernel or a package
 * block.
 *
 * @param item - The world item.
 * @param props - The world's props.
 * @param docsOf - The docs page of a package id.
 * @returns The item's shape; nothing for a block whose package is not in the family.
 */
function renderWorldItem(
  item: WorldItem,
  props: KernelWorldProperties,
  docsOf: (id: string) => string
): VNode | undefined {
  if (item.kind === "terrace") {
    return (
      <IsoBox
        key={`t${item.x}-${item.y}`}
        projection={world}
        box={{ x: item.x, y: item.y, z: 0, width: 1, depth: 1, height: item.level }}
        tone={TERRACE_TONES[item.ring]}
      />
    );
  }
  if (item.kind === "socket") {
    return (
      <Socket
        key={`s${item.index}`}
        index={item.index}
        x={item.x}
        y={item.y}
        plugin={props.accepted[item.index]}
      />
    );
  }
  if (item.kind === "kernel") return <Kernel key="kernel" version={props.kernelVersion} />;
  const entry = props.packages.find(candidate => candidate.id === item.id);
  if (entry === undefined) return undefined;
  return <PackageBlock key={item.id} entry={entry} place={item.place} href={docsOf(item.id)} />;
}

/**
 * The hero world SVG. Scales to its container's width.
 *
 * @param props - Component props.
 * @returns The `<svg data-part="world">`.
 * @example
 * ```tsx
 * <KernelWorld packages={view.packages} accepted={[router]} kernelVersion="1.7.6" url={url} />
 * ```
 */
export function KernelWorld(props: KernelWorldProperties): VNode {
  const { packages, url } = props;
  const docsOf = (id: string): string => url("docsPackage", { pkg: id });
  const claude = packages.find(entry => entry.id === "claude");
  // On a phone the CSS shows only the middle window of the drawing, with bigger labels.
  const framing = windowFraming(PHONE_WINDOW);
  return (
    // biome-ignore lint/a11y/useSemanticElements: an SVG drawing cannot be a fieldset; group names the set of focusable shapes
    <svg
      data-part="world"
      viewBox={WORLD_VIEW_BOX}
      style={{
        "--phone-width": `${framing.width}%`,
        "--phone-shift": `${framing.shift}%`,
        "--phone-label": PHONE_LABEL_UNITS
      }}
      role="group"
      aria-label="Isometric map of the Moku family around the kernel"
    >
      <Platform />
      {worldItems(packages.map(entry => entry.id)).map(item =>
        renderWorldItem(item, props, docsOf)
      )}
      {claude ? <ClaudeBlock entry={claude} href={docsOf(claude.id)} /> : undefined}
    </svg>
  );
}
