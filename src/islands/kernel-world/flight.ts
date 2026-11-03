/**
 * @file The flyer of the `kernel-world` island: the cube that flies a piece to its socket, and the
 * ghost that follows a drag. The keyframes come from `src/lib/kernel-flight.ts`.
 */
import type { GlyphName } from "../../lib/glyphs";
import { glyphPath } from "../../lib/glyphs";
import type { Point } from "../../lib/iso";
import type { FlightFrame, ScreenPoint } from "../../lib/kernel-flight";

/**
 * Whether the visitor asked for less motion.
 *
 * @returns `true` under `prefers-reduced-motion: reduce`.
 */
export function reducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Project a point of the world SVG onto the screen.
 *
 * @param svg - The world SVG.
 * @param point - A point in SVG units.
 * @returns The screen point.
 */
export function toScreen(svg: SVGSVGElement, point: Point): ScreenPoint {
  const matrix = svg.getScreenCTM();
  if (matrix === null) return { x: 0, y: 0 };
  const projected = new DOMPoint(point[0], point[1]).matrixTransform(matrix);
  return { x: projected.x, y: projected.y };
}

/**
 * The centre of an element on the screen.
 *
 * @param element - Any element.
 * @returns Its centre.
 */
export function centreOf(element: Element): ScreenPoint {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * Move the flyer (or the drag ghost) without an animation.
 *
 * @param flyer - The flyer.
 * @param at - The new point.
 */
export function moveTo(flyer: HTMLElement, at: ScreenPoint): void {
  flyer.style.setProperty("--x", `${at.x}px`);
  flyer.style.setProperty("--y", `${at.y}px`);
}

/**
 * Put a copy of the flyer on screen at a point, showing a piece.
 *
 * @param root - The hero section.
 * @param id - The piece.
 * @param glyph - Its glyph.
 * @param at - Where it starts.
 * @returns The flyer, or `undefined` when the template is missing.
 */
export function launchFlyer(
  root: Element,
  id: string,
  glyph: GlyphName,
  at: ScreenPoint
): HTMLElement | undefined {
  const template = root.querySelector('[data-part="flyer"]:not([data-clone])');
  const flyer = template?.cloneNode(true);
  if (!(flyer instanceof HTMLElement)) return undefined;
  flyer.dataset.clone = "";
  flyer.hidden = false;
  flyer.querySelector('[data-part="glyph"]')?.setAttribute("d", glyphPath(glyph));
  const label = flyer.querySelector("span");
  if (label !== null) label.textContent = id;
  moveTo(flyer, at);
  root.append(flyer);
  return flyer;
}

/**
 * Play keyframes on the flyer and wait for them; a cancelled animation counts as done.
 *
 * @param flyer - The flyer.
 * @param frames - Keyframes.
 * @param duration - Length in ms.
 * @param easing - CSS easing.
 * @returns Resolves when the motion ends.
 */
export async function fly(
  flyer: HTMLElement,
  frames: FlightFrame[],
  duration: number,
  easing: string
): Promise<void> {
  const animation = flyer.animate(frames, { duration, easing, fill: "forwards" });
  await animation.finished.catch(() => animation);
}
