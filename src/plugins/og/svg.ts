/**
 * @file The parts of a card drawn from code as SVG: the floor and glow, the cube cluster and the logo.
 * Plain markup with the numbers of the design. No text: words are drawn by Satori.
 */

/** The floor's isometric tile and the card ground. */
const GROUND = "#0f0c1e";

/** The three shades of a cube, each a pair of gradient stops. */
type CubeTint = {
  /** Top face, a vertical gradient. */
  top: readonly [string, string];
  /** Left face, a diagonal gradient. */
  left: readonly [string, string];
  /** Right face, a diagonal gradient. */
  right: readonly [string, string];
};

/** The shades of the violet cubes and the one pink kernel cube. */
const CUBE_TINTS = {
  violet: {
    top: ["#5a44a8", "#3f2e80"],
    left: ["#37296f", "#231a52"],
    right: ["#1f1849", "#130f30"]
  },
  pink: {
    top: ["#ff86a8", "#ff5c8a"],
    left: ["#f03a68", "#d92a56"],
    right: ["#b0204a", "#8f1b3c"]
  }
} as const satisfies Record<string, CubeTint>;

/** Name of a cube tint. */
type TintName = keyof typeof CUBE_TINTS;

/**
 * One linear gradient of a cube face.
 *
 * @param id - Gradient id.
 * @param stops - First and last colour.
 * @param vertical - A straight top to bottom gradient instead of a diagonal one.
 * @returns The markup.
 */
function faceGradient(id: string, stops: readonly [string, string], vertical: boolean): string {
  const [first, last] = stops;
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="1"><stop offset="0" stop-color="${first}"/><stop offset="1" stop-color="${last}"/></linearGradient>`;
}

/**
 * The three gradients of one tint.
 *
 * @param name - Tint name, the prefix of the gradient ids.
 * @returns The markup.
 */
function tintGradients(name: TintName): string {
  const tint = CUBE_TINTS[name];
  return [
    faceGradient(`${name}-top`, tint.top, true),
    faceGradient(`${name}-left`, tint.left, false),
    faceGradient(`${name}-right`, tint.right, false)
  ].join("");
}

/**
 * One isometric cube.
 *
 * @param x - Horizontal position of its top corner.
 * @param y - Vertical position of its top corner.
 * @param tint - Tint name.
 * @returns The markup.
 */
function cube(x: number, y: number, tint: TintName): string {
  return `<g transform="translate(${x} ${y})"><polygon points="-42,22 0,44 0,88 -42,66" fill="url(#${tint}-left)"/><polygon points="0,44 42,22 42,66 0,88" fill="url(#${tint}-right)"/><polygon points="0,0 42,22 0,44 -42,22" fill="url(#${tint}-top)"/></g>`;
}

/**
 * The background of every card: ground, isometric floor fading out to the left, violet glow.
 *
 * @returns SVG markup of 1200x630.
 * @example
 * ```ts
 * floorSvg().startsWith("<svg"); // true
 * ```
 */
export function floorSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><pattern id="floor" width="126" height="66" patternUnits="userSpaceOnUse"><path d="M0 33 L63 0 L126 33 L63 66 Z" fill="none" stroke="#2b2452" stroke-width="1.5"/></pattern><radialGradient id="fade" gradientUnits="userSpaceOnUse" cx="920" cy="315" r="400"><stop offset=".35" stop-color="${GROUND}" stop-opacity="0"/><stop offset="1" stop-color="${GROUND}"/></radialGradient><radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="900" cy="315" r="480"><stop offset="0" stop-color="#8060ff" stop-opacity=".52"/><stop offset=".48" stop-color="#785af8" stop-opacity=".42"/><stop offset=".72" stop-color="#684ce2" stop-opacity=".16"/><stop offset="1" stop-color="#6046d6" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="${GROUND}"/><rect width="1200" height="630" fill="url(#floor)"/><rect width="1200" height="630" fill="url(#fade)"/><rect width="1200" height="630" fill="url(#glow)"/></svg>`;
}

/**
 * The kernel's cube cluster: six violet cubes around one lit pink cube.
 *
 * @returns SVG markup of 432x502.
 * @example
 * ```ts
 * clusterSvg().includes("pink-top"); // true
 * ```
 */
export function clusterSvg(): string {
  const behind = [cube(0, -92, "violet"), cube(-76, -42, "violet"), cube(76, -42, "violet")];
  const inFront = [cube(-76, 44, "violet"), cube(76, 44, "violet"), cube(0, 94, "violet")];
  const halo = `<radialGradient id="halo"><stop offset="0" stop-color="#ff2e63" stop-opacity=".72"/><stop offset=".55" stop-color="#ff2e63" stop-opacity=".22"/><stop offset="1" stop-color="#ff2e63" stop-opacity="0"/></radialGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="432" height="502" viewBox="-118 -92 236 274"><defs>${tintGradients("violet")}${tintGradients("pink")}${halo}</defs>${behind.join("")}<circle cx="0" cy="44" r="116" fill="url(#halo)"/>${cube(0, 0, "pink")}${inFront.join("")}</svg>`;
}

/**
 * The logo cube of the card's foot.
 *
 * @returns SVG markup with a viewBox of 100x104.
 * @example
 * ```ts
 * logoSvg().includes("polygon"); // true
 * ```
 */
export function logoSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 104"><polygon points="8,30 50,52 50,96 8,74" fill="#d92a56"/><polygon points="50,52 92,30 92,74 50,96" fill="#8f1b3c"/><polygon points="50,8 92,30 50,52 8,30" fill="#ff5c8a"/></svg>`;
}
