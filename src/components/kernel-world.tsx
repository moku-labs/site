/**
 * @file The hero world (design §7): a 10×10 isometric platform with terraces, the package blocks,
 * the pink kernel with its five sockets, and the Claude plugin floating above. Drawn at build;
 * the `kernel-world` island fills sockets and lifts blocks.
 */
import type { VNode } from "preact";
import type { TrayPlugin } from "../data/tray";
import type { BlockPlace } from "../lib/hero-world";
import {
  BLOCK_INSET,
  CLAUDE_BOX,
  KERNEL_BOX,
  PLATFORM_DEPTH,
  SOCKET_BLOCK_HEIGHT,
  SOCKET_BLOCK_INSET,
  WORLD_SIZE,
  WORLD_VIEW_BOX,
  world,
  worldItems
} from "../lib/hero-world";
import type { HomePackage } from "../lib/home-data";
import type { IsoBoxSpec } from "../lib/iso";
import { formatPoints } from "../lib/iso";
import type { UrlBuilder } from "../lib/url-builder";
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
  const shadow = formatPoints([
    world.point(x + 0.2, y + 0.2, level),
    world.point(x + 0.9, y + 0.2, level),
    world.point(x + 0.9, y + 0.9, level),
    world.point(x + 0.2, y + 0.9, level)
  ]);
  return (
    <>
      <polygon data-part="shadow" points={shadow} />
      {/* biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be an HTML link; the island navigates on click and Enter */}
      <g
        data-part="block"
        data-href={href}
        data-tip-title={entry.name}
        data-tip-version={entry.version}
        data-tip-text={entry.tagline}
        data-tip-action="Open the docs"
        tabIndex={0}
        role="link"
        aria-label={`${entry.name} ${entry.version}. ${entry.tagline}`}
        style={{ "--depth": x + y }}
      >
        <IsoBox projection={world} box={box} tone="block">
          <IsoGlyph projection={world} box={box} glyph={entry.id} weight={13} />
        </IsoBox>
        <GridLabel
          x={x + 0.5}
          y={y + 0.5}
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
  const outline = formatPoints([
    world.point(x + 0.12, y + 0.12, 0),
    world.point(x + 0.88, y + 0.12, 0),
    world.point(x + 0.88, y + 0.88, 0),
    world.point(x + 0.12, y + 0.88, 0)
  ]);
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
          <IsoGlyph projection={world} box={box} glyph={plugin?.glyph ?? "none"} weight={13} />
        </IsoBox>
        <GridLabel
          x={x + 0.5}
          y={y + 0.5}
          z={SOCKET_BLOCK_HEIGHT}
          gap={16}
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
    <g
      data-part="kernel"
      tabIndex={0}
      aria-label="The kernel. Drop plugins here."
      data-tip-title="the kernel"
      data-tip-version={`@moku-labs/core ${props.version}`}
      data-tip-text="Every plugin is checked here before the app starts. Duplicates, missing deps and reserved names stay out."
      data-tip-action="Drop a plugin on it"
    >
      <IsoBox projection={world} box={KERNEL_BOX} tone="kernel">
        <IsoGlyph projection={world} box={KERNEL_BOX} glyph="kernel" weight={6} />
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
  const [fromX, fromY] = world.point(0.6, 0.6, CLAUDE_BOX.z);
  const [toX, toY] = world.point(5, 5, KERNEL_BOX.height);
  return (
    <>
      <line data-part="wire" x1={fromX} y1={fromY} x2={toX} y2={toY} />
      {/* biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be an HTML link; the island navigates on click and Enter */}
      <g
        data-part="block"
        data-floating=""
        data-href={href}
        data-tip-title={entry.name}
        data-tip-version={entry.version}
        data-tip-text={entry.tagline}
        data-tip-action="Open the docs"
        tabIndex={0}
        role="link"
        aria-label={`${entry.name} ${entry.version}. ${entry.tagline}`}
      >
        <IsoBox projection={world} box={CLAUDE_BOX} tone="block">
          <IsoGlyph projection={world} box={CLAUDE_BOX} glyph="claude" weight={12} accent />
        </IsoBox>
        <GridLabel
          x={0.6}
          y={0.6}
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
  const { packages, accepted, url } = props;
  const docsOf = (id: string): string => url("docsPackage", { pkg: id });
  const claude = packages.find(entry => entry.id === "claude");
  return (
    // biome-ignore lint/a11y/useSemanticElements: an SVG drawing cannot be a fieldset; group names the set of focusable shapes
    <svg
      data-part="world"
      viewBox={WORLD_VIEW_BOX}
      role="group"
      aria-label="Isometric map of the Moku family around the kernel"
    >
      <Platform />
      {worldItems(packages.map(entry => entry.id)).map(item => {
        if (item.kind === "terrace") {
          return (
            <IsoBox
              key={`t${item.x}-${item.y}`}
              projection={world}
              box={{ x: item.x, y: item.y, z: 0, width: 1, depth: 1, height: item.level }}
              tone={item.ring === 0 ? "terrace-1" : "terrace-2"}
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
              plugin={accepted[item.index]}
            />
          );
        }
        if (item.kind === "kernel") return <Kernel key="kernel" version={props.kernelVersion} />;
        const entry = packages.find(candidate => candidate.id === item.id);
        return entry ? (
          <PackageBlock key={item.id} entry={entry} place={item.place} href={docsOf(item.id)} />
        ) : undefined;
      })}
      {claude ? <ClaudeBlock entry={claude} href={docsOf(claude.id)} /> : undefined}
    </svg>
  );
}
