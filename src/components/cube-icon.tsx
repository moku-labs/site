/**
 * @file The isometric cube icon: three shaded faces with an optional glyph on the top face.
 */
import type { VNode } from "preact";
import type { CubeTone, GlyphName } from "../lib/glyphs";
import { glyphPath } from "../lib/glyphs";

/** A glyph name. */
export type CubeGlyph = GlyphName;

/** Glyph of each concepts page, by file name. */
const CONCEPT_GLYPHS: Readonly<Record<string, CubeGlyph>> = {
  "three-layers": "layers",
  plugins: "plug",
  lifecycle: "lifecycle",
  events: "events",
  "kernel-checks": "checks"
};

/**
 * The glyph of a concepts page; a page without its own glyph gets the page glyph.
 *
 * @param slug - File name of the concepts page.
 * @returns The glyph name.
 * @example
 * ```ts
 * conceptGlyph("kernel-checks"); // "checks"
 * ```
 */
export function conceptGlyph(slug: string): CubeGlyph {
  return CONCEPT_GLYPHS[slug] ?? "page";
}

/** Props of {@link CubeIcon}. */
type CubeIconProperties = {
  /** Face colours. */
  tone: CubeTone;
  /** Width in CSS px; the height follows the 100×104 drawing. */
  size: number;
  /** Glyph on the top face. */
  glyph?: CubeGlyph;
};

/**
 * An isometric cube, decorative (`aria-hidden`). Colours come from the `cube-icon` sheet.
 *
 * @param props - Component props.
 * @returns The `<svg>`.
 * @example
 * ```tsx
 * <CubeIcon tone="docs" glyph="layers" size={34} />
 * ```
 */
export function CubeIcon(props: CubeIconProperties): VNode {
  const glyph = glyphPath(props.glyph ?? "none");
  return (
    <svg
      data-component="cube-icon"
      data-tone={props.tone}
      viewBox="0 0 100 104"
      width={props.size}
      height={Math.round(props.size * 1.04)}
      aria-hidden="true"
    >
      <polygon data-face="left" points="8,30 50,52 50,96 8,74" />
      <polygon data-face="right" points="50,52 92,30 92,74 50,96" />
      <polygon data-face="top" points="50,8 92,30 50,52 8,30" />
      {glyph === "" ? undefined : (
        <g transform="matrix(.42 .22 -.42 .22 50 8)">
          <path data-part="glyph" d={glyph} transform="translate(15 15) scale(.7)" />
        </g>
      )}
    </svg>
  );
}
