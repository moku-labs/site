/**
 * @file The isometric cube icon: three shaded faces with an optional glyph on the top face.
 */
import type { VNode } from "preact";

/** Glyphs drawn on the top face, in a 100×100 box. */
const GLYPHS = {
  none: "",
  layers: "M50 14L86 32L50 50L14 32Z M14 50L50 68L86 50 M14 68L50 86L86 68",
  plug: "M36 14V34M64 14V34M24 34H76V52A26 26 0 0 1 24 52Z M50 78V92",
  lifecycle: "M82 50A32 32 0 1 1 70 26 M57 16L71 26L61 39",
  events:
    "M31 31A27 27 0 0 0 31 69M69 31A27 27 0 0 1 69 69M18 18A45 45 0 0 0 18 82M82 18A45 45 0 0 1 82 82 M50 46V54",
  checks: "M50 10L84 22V50C84 70 68 84 50 90C32 84 16 70 16 50V22Z M34 50L46 62L68 38",
  page: "M24 12H76V88H24Z M36 32H64M36 46H64M36 60H54"
} as const;

/** A glyph name. */
export type CubeGlyph = keyof typeof GLYPHS;

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

/** Face colours: the pink kernel, or the calm docs cube. */
export type CubeTone = "kernel" | "docs";

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
  const glyph = GLYPHS[props.glyph ?? "none"];
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
