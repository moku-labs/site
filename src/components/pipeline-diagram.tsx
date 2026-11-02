/**
 * @file The "How it works" pipeline diagram (A5): four isometric stages, build → static HTML →
 * island hydration → SPA navigation, joined by arrows. Rendered to markup at build and placed in
 * the page's `::diagram{name="pipeline"}` figure.
 */
import type { VNode } from "preact";
import type { IsoBoxSpec } from "../lib/iso";
import { createProjection } from "../lib/iso";
import { IsoBox, IsoGlyph } from "./iso-shapes";

/** The diagram's projection. */
const pipeline = createProjection({ tileWidth: 44, tileHeight: 22, levelHeight: 26 });

/** Offset between two stages along x (and back along y), in cells. */
const STEP = 5.4;

/** The label under each stage, in order. */
const LABELS = ["app.build.run()", "dist/**/index.html", "spa: islands", "data.at(path)"] as const;

/** The arrowhead marker id. */
const ARROW = "pipeline-arrow";

/**
 * A box placed relative to a stage's origin.
 *
 * @param originX - Stage origin along x.
 * @param originY - Stage origin along y.
 * @param box - The box, relative to the origin.
 * @returns The box in diagram coordinates.
 */
function at(originX: number, originY: number, box: IsoBoxSpec): IsoBoxSpec {
  return { ...box, x: originX + box.x, y: originY + box.y };
}

/**
 * What stands on one stage's ground slab.
 *
 * @param props - Component props.
 * @param props.index - Stage number from 0.
 * @param props.x - Stage origin along x.
 * @param props.y - Stage origin along y.
 * @returns The stage's pieces.
 */
function StageContent(props: { index: number; x: number; y: number }): VNode {
  const { index, x, y } = props;
  const place = (box: IsoBoxSpec): IsoBoxSpec => at(x, y, box);
  if (index === 0) {
    const kernel = place({ x: 1.2, y: 1.2, z: 0.4, width: 1.6, depth: 1.6, height: 1.6 });
    return (
      <>
        <IsoBox
          projection={pipeline}
          box={place({ x: 0.3, y: 2.9, z: 0.4, width: 0.8, depth: 0.8, height: 0.8 })}
          tone="block"
        />
        <IsoBox projection={pipeline} box={kernel} tone="kernel">
          <IsoGlyph projection={pipeline} box={kernel} glyph="kernel" weight={7} />
        </IsoBox>
        <IsoBox
          projection={pipeline}
          box={place({ x: 2.9, y: 0.3, z: 0.4, width: 0.8, depth: 0.8, height: 0.8 })}
          tone="block"
        />
      </>
    );
  }
  if (index === 1) {
    const pages = [0, 1, 2].map(layer =>
      place({
        x: 0.7 + layer * 0.3,
        y: 0.7 + layer * 0.3,
        z: 0.4 + layer * 0.2,
        width: 2.3,
        depth: 2.3,
        height: 0.14
      })
    );
    const lid = place({ x: 1.3, y: 1.3, z: 1, width: 2.3, depth: 2.3, height: 0 });
    return (
      <>
        {pages.map(box => (
          <IsoBox key={box.z} projection={pipeline} box={box} tone="block" />
        ))}
        <g data-tone="block">
          <IsoGlyph projection={pipeline} box={lid} glyph="page" weight={9} />
        </g>
      </>
    );
  }
  if (index === 2) {
    return (
      <>
        <IsoBox
          projection={pipeline}
          box={place({ x: 0.8, y: 0.8, z: 0.4, width: 2.4, depth: 2.4, height: 0.14 })}
          tone="block"
        />
        <IsoBox
          projection={pipeline}
          box={place({ x: 1.1, y: 1.1, z: 0.54, width: 0.8, depth: 0.8, height: 0.62 })}
          tone="kernel"
        />
        <IsoBox
          projection={pipeline}
          box={place({ x: 2.1, y: 2, z: 0.54, width: 0.7, depth: 0.7, height: 0.45 })}
          tone="kernel"
        />
      </>
    );
  }
  const [fromX, fromY] = pipeline.point(x + 1.9, y + 1.15, 0.6);
  const [toX, toY] = pipeline.point(x + 2.3, y + 2.4, 0.6);
  return (
    <>
      <IsoBox
        projection={pipeline}
        box={place({ x: 0.4, y: 0.4, z: 0.4, width: 1.5, depth: 1.5, height: 0.14 })}
        tone="block"
      />
      <IsoBox
        projection={pipeline}
        box={place({ x: 2.1, y: 2.1, z: 0.4, width: 1.5, depth: 1.5, height: 0.14 })}
        tone="block"
      />
      <path
        data-part="hop"
        d={`M${fromX} ${fromY}Q${fromX + 26} ${fromY - 4} ${toX} ${toY - 4}`}
        marker-end={`url(#${ARROW})`}
      />
    </>
  );
}

/**
 * The pipeline diagram.
 *
 * @returns The `<svg>`.
 * @example
 * ```tsx
 * renderToString(<PipelineDiagram />);
 * ```
 */
export function PipelineDiagram(): VNode {
  return (
    <svg
      data-diagram-art="pipeline"
      viewBox="-100 -78 900 222"
      role="img"
      aria-label="Build, static HTML, island hydration, SPA navigation"
    >
      <defs>
        <marker
          id={ARROW}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path data-part="arrowhead" d="M0 0L10 5L0 10Z" />
        </marker>
      </defs>
      {LABELS.map((label, index) => {
        const x = index * STEP;
        const y = -index * STEP;
        const [labelX, labelY] = pipeline.point(x + 4, y + 4, 0);
        const [startX, startY] = pipeline.point(x + 4.2, y + 0.9, 0.2);
        const [endX, endY] = pipeline.point(x + STEP - 0.2, y - STEP + 3.1, 0.2);
        return (
          <g key={label} data-part="stage">
            <IsoBox
              projection={pipeline}
              box={{ x, y, z: 0, width: 4, depth: 4, height: 0.4 }}
              tone="ground"
            />
            <StageContent index={index} x={x} y={y} />
            {index < LABELS.length - 1 ? (
              <line
                data-part="link"
                x1={startX + 4}
                y1={startY}
                x2={endX - 6}
                y2={endY}
                marker-end={`url(#${ARROW})`}
              />
            ) : undefined}
            <text x={labelX} y={labelY + 26} text-anchor="middle">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
