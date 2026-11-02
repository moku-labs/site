/**
 * @file Isometric SVG pieces: a shaded box and a glyph lying on its lid. The colours come from
 * the `iso` sheet through `data-tone`, so one drawing serves both themes.
 */
import type { ComponentChildren, VNode } from "preact";
import type { IsoBoxSpec, IsoProjection } from "../lib/iso";
import { glyphPath } from "./glyphs";

/** Face colours of a box. */
export type IsoTone = "ground" | "terrace-1" | "terrace-2" | "block" | "kernel" | "plugin";

/** Props of {@link IsoBox}. */
type IsoBoxProperties = {
  /** The projection the box is drawn with. */
  projection: IsoProjection;
  /** The box. */
  box: IsoBoxSpec;
  /** Face colours. */
  tone: IsoTone;
  /** Drawn after the faces, inside the same group (a glyph, a label). */
  children?: ComponentChildren;
};

/**
 * A box: left, right and top faces in a `<g data-tone>`.
 *
 * @param props - Component props.
 * @returns The `<g>`.
 * @example
 * ```tsx
 * <IsoBox projection={world} box={KERNEL_BOX} tone="kernel" />
 * ```
 */
export function IsoBox(props: IsoBoxProperties): VNode {
  const faces = props.projection.box(props.box);
  return (
    <g data-tone={props.tone}>
      <polygon data-face="left" points={faces.left} />
      <polygon data-face="right" points={faces.right} />
      <polygon data-face="top" points={faces.top} />
      {props.children}
    </g>
  );
}

/** Props of {@link IsoGlyph}. */
type IsoGlyphProperties = {
  /** The projection the lid is drawn with. */
  projection: IsoProjection;
  /** The box whose lid carries the glyph. */
  box: IsoBoxSpec;
  /** Glyph name; an unknown name draws an empty path the island can fill. */
  glyph: string;
  /** Stroke width in the glyph's 100-unit box. */
  weight: number;
  /** Draw the glyph in the kernel pink instead of the tone's glyph colour. */
  accent?: boolean;
};

/**
 * A glyph lying flat on the lid of a box.
 *
 * @param props - Component props.
 * @returns The `<g>` with the glyph path.
 * @example
 * ```tsx
 * <IsoGlyph projection={world} box={KERNEL_BOX} glyph="kernel" weight={6} />
 * ```
 */
export function IsoGlyph(props: IsoGlyphProperties): VNode {
  const { x, y, z, width, depth, height } = props.box;
  return (
    <g transform={props.projection.topFaceTransform(x, y, z + height, width, depth)}>
      <path
        data-part="glyph"
        data-accent={props.accent ? "" : undefined}
        d={glyphPath(props.glyph)}
        transform="translate(15 15) scale(.7)"
        stroke-width={props.weight}
      />
    </g>
  );
}
