/**
 * @file The glyphs drawn on cube lids: one stroke path each, in a 100×100 box.
 *
 * Plain data shared by the cube icon, the hero world, the layers stack and the pipeline diagram.
 * The hero's assembly draws its pieces, standing plugins and app cubes from the same table. It
 * lives in `lib` so pure modules (the hero's view, the assembly data) can read it.
 */

/** Glyph paths by name. */
const GLYPH_PATHS = {
  none: "",
  // Packages
  claude: "M50 10V90M10 50H90M22 22L78 78M78 22L22 78",
  core: "M20 20H80V80H20Z M38 38H62V62H38Z",
  common: "M20 30H80M20 50H80M20 70H56",
  web: "M50 16A34 34 0 1 1 50 84A34 34 0 1 1 50 16Z M16 50H84 M50 16C32 36 32 64 50 84 M50 16C68 36 68 64 50 84",
  worker: "M58 10L26 56H50L42 90L76 42H52Z",
  room: "M16 16H84V58H16Z M26 80H42M58 80H74",
  system:
    "M66 50A16 16 0 1 1 34 50A16 16 0 1 1 66 50Z M50 12V28M50 72V88M12 50H28M72 50H88M23 23L34 34M66 66L77 77M77 23L66 34M34 66L23 77",
  native: "M50 12V60M30 42L50 62L70 42M18 84H82",
  game: "M35 26A11 11 0 1 1 13 26A11 11 0 1 1 35 26Z M87 26A11 11 0 1 1 65 26A11 11 0 1 1 87 26Z M61 78A11 11 0 1 1 39 78A11 11 0 1 1 61 78Z M35 26H65M30 36L44 68M70 36L56 68",
  editor: "M36 18L14 50L36 82M64 18L86 50L64 82",
  ai: "M50 8Q55 45 92 50Q55 55 50 92Q45 55 8 50Q45 45 50 8Z",
  ci: "M18 54L40 76L84 26",
  // The kernel
  kernel: "M6 6H94V94H6Z M28 28H72V72H28Z",
  // Plugins and concepts
  route:
    "M33 76A9 9 0 1 1 15 76A9 9 0 1 1 33 76Z M85 24A9 9 0 1 1 67 24A9 9 0 1 1 85 24Z M32 70C60 70 40 30 68 30",
  env: "M18 40H82V84H18Z M32 40V30A18 18 0 0 1 68 30V40M50 56V68",
  deploy: "M50 84V30M30 48L50 28L70 48M22 18H78",
  layers: "M50 14L86 32L50 50L14 32Z M14 50L50 68L86 50 M14 68L50 86L86 68",
  plug: "M36 14V34M64 14V34M24 34H76V52A26 26 0 0 1 24 52Z M50 78V92",
  lifecycle: "M82 50A32 32 0 1 1 70 26 M57 16L71 26L61 39",
  events:
    "M31 31A27 27 0 0 0 31 69M69 31A27 27 0 0 1 69 69M18 18A45 45 0 0 0 18 82M82 18A45 45 0 0 1 82 82 M50 46V54",
  checks: "M50 10L84 22V50C84 70 68 84 50 90C32 84 16 70 16 50V22Z M34 50L46 62L68 38",
  page: "M24 12H76V88H24Z M36 32H64M36 46H64M36 60H54",
  // The hero's assembly: standing plugins, pieces and the three app cubes
  site: "M14 50L50 18L86 50 M24 42V84H76V42 M42 84V62H58V84",
  head: "M26 18V82M74 18V82M26 50H74",
  spa: "M58 10L26 56H50L42 90L76 42H52Z",
  log: "M18 28H38M48 28H82M18 50H30M40 50H82M18 72H50M60 72H82",
  comments: "M14 18H86V64H46L28 82V64H14Z",
  mail: "M12 24H88V76H12Z M12 24L50 54L88 24",
  bindings:
    "M50 12V40M50 40L22 70M50 40L78 70 M50 12A6 6 0 1 1 49.9 12Z M22 76A6 6 0 1 1 21.9 76Z M78 76A6 6 0 1 1 77.9 76Z",
  server: "M14 22H86V46H14Z M14 54H86V78H14Z M26 34H34M26 66H34",
  d1: "M20 24C20 12 80 12 80 24V76C80 88 20 88 20 76Z M20 24C20 36 80 36 80 24 M20 50C20 62 80 62 80 50",
  kv: "M34 50A16 16 0 1 1 33.9 50Z M50 50H88M74 50V64M86 50V60",
  tasks: "M18 22H30M40 22H84M18 50H30M40 50H84M18 78H30M40 78H84",
  flow: "M14 30H70M58 18L70 30L58 42 M86 70H30M42 58L30 70L42 82",
  time: "M26 14H74M26 86H74M30 14C30 40 70 60 70 86M70 14C70 40 30 60 30 86",
  clock: "M86 50A36 36 0 1 1 14 50A36 36 0 1 1 86 50Z M50 28V50L66 60",
  model: "M18 18H82V82H18Z M18 50H82 M50 18V82",
  screen: "M12 18H88V68H12Z M38 84H62M50 68V84",
  audio:
    "M40 74V20L80 12V66 M40 74A10 10 0 1 1 20 74A10 10 0 1 1 40 74Z M80 66A10 10 0 1 1 60 66A10 10 0 1 1 80 66Z",
  board: "M38 14V86M62 14V86M14 38H86M14 62H86",
  window: "M8 14H92V86H8Z M8 34H92 M20 24H26M34 24H40M48 24H54 M22 50H62M22 66H50",
  rack: "M14 10H86V34H14Z M14 40H86V64H14Z M14 70H86V92H14Z M24 22H32M24 52H32M24 81H32",
  grid: "M10 10H90V90H10Z M36.7 10V90M63.3 10V90M10 36.7H90M10 63.3H90"
} as const;

/** A glyph name. */
export type GlyphName = keyof typeof GLYPH_PATHS;

/**
 * Face colours of a cube icon: the pink kernel, the calm docs cube, a violet block of the landing
 * world, or a cube of the hero's assembly (a piece, a standing plugin, the app).
 */
export type CubeTone = "kernel" | "docs" | "block" | "piece" | "standing" | "app";

/**
 * The stroke path of a glyph; an unknown name draws nothing.
 *
 * @param name - Glyph name, or any string such as a package id.
 * @returns The SVG path data, `""` for none.
 * @example
 * ```ts
 * glyphPath("ci"); // "M18 54L40 76L84 26"
 * ```
 */
export function glyphPath(name: string): string {
  return Object.hasOwn(GLYPH_PATHS, name) ? GLYPH_PATHS[name as GlyphName] : "";
}
