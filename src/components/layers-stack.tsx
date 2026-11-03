/**
 * @file "Three layers" (A1, U8): three isometric slabs, three numbered steps and a three-line
 * sample. The `layers-stack` island keeps slab, step and code line in step on hover and focus.
 */
import type { VNode } from "preact";
import type { IsoBoxSpec } from "../lib/iso";
import { createProjection } from "../lib/iso";
import type { IsoTone } from "./iso-shapes";
import { IsoBox, IsoGlyph } from "./iso-shapes";

/** The stack's projection. */
const stack = createProjection({ tileWidth: 52, tileHeight: 26, levelHeight: 30 });

/** Slab size and thickness. */
const SLAB = 4;
const SLAB_HEIGHT = 0.42;

/** One layer: slab level and colours, labels, step copy. */
type Layer = {
  /** Layer number, 1 at the bottom. */
  level: 1 | 2 | 3;
  /** Height of the slab's base. */
  z: number;
  /** Slab colours. */
  tone: IsoTone;
  /** The call that makes this layer. */
  call: string;
  /** What it holds. */
  holds: string;
  /** Step title. */
  title: string;
  /** Step text after the call. */
  text: string;
  /** What stands on the slab: the core glyph, or a plugin cube. */
  top: "core" | "plugin";
};

/** The three layers, bottom up. */
export const LAYERS: readonly Layer[] = [
  {
    level: 1,
    z: 0,
    tone: "terrace-2",
    call: "createCoreConfig",
    holds: "core config",
    title: "Core config",
    text: "names the framework and types its config and events. Written once, by the framework author.",
    top: "core"
  },
  {
    level: 2,
    z: 1.6,
    tone: "block",
    call: "createCore",
    holds: "framework + routerPlugin",
    title: "Framework",
    text: "bakes in the default plugins. @moku-labs/web is one. So are worker and room.",
    top: "plugin"
  },
  {
    level: 3,
    z: 3.2,
    tone: "kernel",
    call: "createApp",
    holds: "your app + blogPlugin",
    title: "App",
    text: "adds your plugins. The kernel checks the list before start.",
    top: "plugin"
  }
];

/** The layer lit before any hover: the app, the one a reader writes. */
const ACTIVE = 3;

/**
 * One slab with what stands on it and its two labels.
 *
 * @param props - Component props.
 * @param props.layer - The layer.
 * @returns The slab group.
 */
function Slab(props: { layer: Layer }): VNode {
  const { layer } = props;
  const slab: IsoBoxSpec = {
    x: 0,
    y: 0,
    z: layer.z,
    width: SLAB,
    depth: SLAB,
    height: SLAB_HEIGHT
  };
  const lid = layer.z + SLAB_HEIGHT;
  const core: IsoBoxSpec = { x: 1, y: 1, z: layer.z, width: 2, depth: 2, height: SLAB_HEIGHT };
  const cube: IsoBoxSpec = { x: 1.5, y: 1.5, z: lid, width: 1, depth: 1, height: 0.9 };
  const [labelX, labelY] = stack.point(SLAB, 0, layer.z + 0.2);
  return (
    // biome-ignore lint/a11y/useSemanticElements: an SVG group cannot be an HTML button; it is a focusable slab
    <g
      data-layer={layer.level}
      data-active={layer.level === ACTIVE ? "" : undefined}
      tabIndex={0}
      role="button"
      aria-label={`Layer ${layer.level}: ${layer.call}()`}
    >
      <IsoBox projection={stack} box={slab} tone={layer.tone}>
        {layer.top === "core" ? (
          <IsoGlyph projection={stack} box={core} glyph="core" weight={8} />
        ) : undefined}
      </IsoBox>
      {layer.top === "plugin" ? (
        <IsoBox projection={stack} box={cube} tone="plugin">
          <IsoGlyph projection={stack} box={cube} glyph="plug" weight={12} />
        </IsoBox>
      ) : undefined}
      <text data-part="call" x={labelX + 18} y={labelY + 2}>
        {layer.call}()
      </text>
      <text data-part="holds" x={labelX + 18} y={labelY + 18}>
        {layer.holds}
      </text>
    </g>
  );
}

/**
 * The stack drawing: dashed posts at the corners and the three slabs, bottom up.
 *
 * @returns The `<svg>`.
 */
function StackDrawing(): VNode {
  const top = LAYERS.at(-1)?.z ?? 0;
  const posts = (
    [
      [SLAB, 0],
      [SLAB, SLAB],
      [0, SLAB]
    ] as const
  ).map(([x, y]) => {
    const [x1, y1] = stack.point(x, y, 0);
    const [x2, y2] = stack.point(x, y, top);
    return <line key={`${x}-${y}`} data-part="post" x1={x1} y1={y1} x2={x2} y2={y2} />;
  });
  return (
    // biome-ignore lint/a11y/useSemanticElements: an SVG drawing cannot be a fieldset; group names the set of focusable shapes
    <svg
      data-part="drawing"
      viewBox="-115 -130 420 250"
      role="group"
      aria-label="Three layers stacked: core config, framework, app"
    >
      {posts}
      {LAYERS.map(layer => (
        <Slab key={layer.level} layer={layer} />
      ))}
    </svg>
  );
}

/**
 * The three-layers block: drawing and steps on the left, the sample on the right.
 *
 * @param props - Component props.
 * @param props.code - The sample, rendered by the docs pipeline (one line per layer).
 * @returns The `<div data-component="layers-stack" data-island="layers-stack">`.
 * @example
 * ```tsx
 * <LayersStack code={view.layersCode} />
 * ```
 */
export function LayersStack(props: { code: string }): VNode {
  return (
    <div data-component="layers-stack" data-island="layers-stack">
      <div>
        <StackDrawing />
        <ol data-part="steps">
          {LAYERS.map(layer => (
            <li
              key={layer.level}
              data-layer={layer.level}
              data-active={layer.level === ACTIVE ? "" : undefined}
            >
              <span data-part="number">{layer.level}</span>
              <div>
                <b>{layer.title}</b>
                <span>
                  <code>{layer.call}</code> {layer.text}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {/* Trusted HTML from the docs pipeline; the code-block island adds the Copy button. */}
      <div
        data-part="code"
        data-island="code-block"
        dangerouslySetInnerHTML={{ __html: props.code }}
      />
    </div>
  );
}
