/**
 * @file "Everything stands on one kernel" (A1, U7): the core brick on top, the other eleven
 * packages under it, the six demos at the base. The `pyramid` island lights relations.
 */
import type { VNode } from "preact";
import type { DemoEntry } from "../data/demos";
import type { HomePackage } from "../lib/home-data";
import type { Brick, PyramidPackage } from "../lib/pyramid";
import { brickFaces, PYRAMID_WIDTH, pyramidBricks } from "../lib/pyramid";
import type { UrlBuilder } from "../lib/url-builder";
import type { IsoTone } from "./iso-shapes";
import { WorldTip } from "./world-tip";

/** Props of {@link Pyramid}. */
type PyramidProperties = {
  /** The family, `core` included, in family order. */
  packages: readonly HomePackage[];
  /** The demos in display order. */
  demos: readonly DemoEntry[];
  /** Route link builder. */
  url: UrlBuilder;
};

/** Face colours per row. */
const TONES: Readonly<Record<Brick["kind"], IsoTone>> = {
  core: "kernel",
  package: "block",
  demo: "terrace-2"
};

/** What a brick says on its tooltip and where it leads. */
type BrickInfo = {
  /** Tooltip title. */
  title: string;
  /** Tooltip version, if any. */
  version?: string;
  /** Tooltip line. */
  text: string;
  /** Tooltip action line. */
  action: string;
  /** Art shown in the tooltip. */
  art: string;
  /** Link target. */
  href: string;
  /** Accessible name. */
  label: string;
};

/**
 * The tooltip and link of a demo brick.
 *
 * @param brick - The brick.
 * @param props - The pyramid's props.
 * @returns The brick's info.
 */
function demoInfo(brick: Brick, props: PyramidProperties): BrickInfo {
  const demo = props.demos.find(entry => entry.id === brick.id);
  const name = demo?.name ?? brick.id;
  const description = demo?.description ?? "";
  const stack = demo?.stack.join(", ") ?? "";
  return {
    title: name,
    text: description,
    action: `Built on ${stack} · open the demo`,
    art: `/art/demo-${brick.id}-960.webp`,
    href: `${props.url("demos")}#${brick.id}`,
    label: `${name}, ${description}. Built on ${stack}`
  };
}

/**
 * The tooltip and link of the core or a package brick.
 *
 * @param brick - The brick.
 * @param props - The pyramid's props.
 * @returns The brick's info.
 */
function packageInfo(brick: Brick, props: PyramidProperties): BrickInfo {
  const entry = props.packages.find(candidate => candidate.id === brick.id);
  const name = entry?.name ?? brick.id;
  const version = entry?.version ?? "";
  const tagline = entry?.tagline ?? "";
  const base = {
    title: name,
    version,
    art: `/art/icon-${brick.id}-256.webp`,
    href: props.url("docsPackage", { pkg: brick.id })
  };
  if (brick.kind === "core") {
    return {
      ...base,
      text: "The kernel. Every package and every demo stands on it.",
      action: "Open the docs",
      label: `${name}, the kernel`
    };
  }
  const users = props.demos.filter(demo => demo.stack.includes(brick.id)).map(demo => demo.name);
  return {
    ...base,
    text: tagline,
    action: users.length > 0 ? `Used by ${users.join(", ")}` : "No demo uses it directly yet",
    label: `${name} ${version}. ${tagline}`
  };
}

/**
 * One brick: lid, side and front with its label.
 *
 * @param props - Component props.
 * @param props.brick - The brick.
 * @param props.info - Its tooltip and link.
 * @param props.stack - A demo's packages, space-separated.
 * @returns The brick group.
 */
function BrickShape(props: { brick: Brick; info: BrickInfo; stack: string | undefined }): VNode {
  const { brick, info } = props;
  const faces = brickFaces(brick);
  return (
    // biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be an HTML link; the island navigates on click and Enter
    <g
      data-brick=""
      data-kind={brick.kind}
      data-id={brick.id}
      data-stack={props.stack}
      data-tone={TONES[brick.kind]}
      data-href={info.href}
      data-tip-title={info.title}
      data-tip-version={info.version}
      data-tip-text={info.text}
      data-tip-action={info.action}
      data-tip-art={info.art}
      tabIndex={0}
      role="link"
      aria-label={info.label}
    >
      <polygon data-face="top" points={faces.top} />
      <polygon data-face="right" points={faces.side} />
      <polygon data-face="left" points={faces.front} />
      <text x={brick.x + brick.width / 2} y={brick.y + brick.height / 2 + 4.5} text-anchor="middle">
        {brick.label}
      </text>
    </g>
  );
}

/**
 * The pyramid with its legend. Wider than a phone: it scrolls sideways in its own box.
 *
 * @param props - Component props.
 * @returns The `<div data-component="pyramid" data-island="pyramid">`.
 * @example
 * ```tsx
 * <Pyramid packages={view.packages} demos={view.demos} url={url} />
 * ```
 */
export function Pyramid(props: PyramidProperties): VNode {
  const labelled: PyramidPackage[] = props.packages.map(entry => ({
    id: entry.id,
    label: entry.id === "core" ? entry.name : entry.id === "claude" ? "Claude" : entry.id
  }));
  const { bricks, height } = pyramidBricks(labelled, props.demos);
  // The base first: a lifted brick slides under the row above, never over it.
  const drawOrder = bricks.toReversed();
  return (
    <div data-component="pyramid" data-island="pyramid">
      <div data-part="scroller">
        {/* biome-ignore lint/a11y/useSemanticElements: an SVG drawing cannot be a fieldset; group names the set of focusable shapes */}
        <svg
          viewBox={`0 0 ${PYRAMID_WIDTH + 20} ${height}`}
          role="group"
          aria-label="Pyramid: the kernel on top, eleven packages, six demo apps at the base"
        >
          {drawOrder.map(brick => (
            <BrickShape
              key={`${brick.kind}-${brick.id}`}
              brick={brick}
              info={brick.kind === "demo" ? demoInfo(brick, props) : packageInfo(brick, props)}
              stack={props.demos
                .find(demo => demo.id === brick.id && brick.kind === "demo")
                ?.stack.join(" ")}
            />
          ))}
        </svg>
      </div>
      <p data-part="legend">
        <span>
          <i data-swatch="kernel" />
          kernel
        </span>
        <span>
          <i data-swatch="package" />
          packages
        </span>
        <span>
          <i data-swatch="demo" />
          demo apps
        </span>
        <span data-part="hint">Scroll sideways on small screens.</span>
      </p>
      <WorldTip withArt />
    </div>
  );
}
