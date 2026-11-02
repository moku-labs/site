/**
 * @file Fill and place the world tooltip, shared by the hero and pyramid islands. Not an
 * island.
 */

/** Gap kept between the tooltip and the viewport's side edges, in px. */
const EDGE = 12;

/** Distance a hero block rises on hover (`translateY(-8px)` in `hero.css`), in px. */
const HOVER_LIFT = 8;

/**
 * Measure how much of the hover lift a hero block has not travelled yet. Pyramid bricks do not
 * lift, so they have none.
 *
 * @param target - The hovered or focused element.
 * @returns The pending lift in px: 8 before the lift, 0 once it is done.
 * @example
 * ```ts
 * pendingLift(heroBlock); // 8 at the first pointerover, 0 after the transition
 * ```
 */
function pendingLift(target: HTMLElement | SVGElement): number {
  const block = target.closest<HTMLElement | SVGElement>(
    '[data-component="hero"] [data-part="block"]'
  );
  if (block === null) return 0;
  const current = new DOMMatrix(getComputedStyle(block).transform).f;
  return HOVER_LIFT + current;
}

/**
 * Set the text of one tooltip part, or hide the part when there is no text.
 *
 * @param tip - The tooltip.
 * @param part - The part's `data-part`.
 * @param text - Its text.
 */
function setPart(tip: Element, part: string, text: string | undefined): void {
  const target = tip.querySelector<HTMLElement>(`[data-part="${part}"]`);
  if (target === null) return;
  target.textContent = text ?? "";
  target.hidden = !text;
}

/**
 * Show the tooltip above an element, filled from its `data-tip-*` attributes (`title`,
 * `version`, `text`, `action`, and `art`, an image URL). The island places it through
 * `--tip-x` / `--tip-y`, kept clear of the viewport's side edges.
 *
 * @param tip - The `[data-component="world-tip"]` element.
 * @param target - The hovered or focused element.
 * @example
 * ```ts
 * // The visitor hovers the web block: <g data-tip-title="@moku-labs/web" data-tip-version="v2.4.11">
 * showTip(tip, webBlock);
 * // tip is visible above the block; its title reads "@moku-labs/web", its version "v2.4.11"
 * ```
 */
export function showTip(tip: HTMLElement, target: HTMLElement | SVGElement): void {
  const { tipTitle, tipVersion, tipText, tipAction, tipArt } = target.dataset;
  setPart(tip, "title", tipTitle);
  setPart(tip, "version", tipVersion);
  setPart(tip, "text", tipText);
  setPart(tip, "action", tipAction);
  const art = tip.querySelector<HTMLImageElement>('[data-part="art"]');
  if (art !== null) {
    if (tipArt) art.src = tipArt;
    art.hidden = !tipArt;
  }
  const box = target.getBoundingClientRect();
  tip.style.setProperty("--tip-y", `${box.top - 8 - pendingLift(target)}px`);
  tip.hidden = false;
  // Centre the tip over the target, kept a margin inside the screen by its own measured width.
  const half = tip.offsetWidth / 2 + EDGE;
  const centre = Math.max(half, Math.min(innerWidth - half, box.left + box.width / 2));
  tip.style.setProperty("--tip-x", `${centre}px`);
}

/**
 * Hide the tooltip.
 *
 * @param tip - The tooltip, if the section has one.
 * @example
 * ```ts
 * // The pointer leaves the pyramid while a brick's tooltip shows.
 * hideTip(root.querySelector('[data-component="world-tip"]')); // the tooltip is hidden
 * ```
 */
export function hideTip(tip: HTMLElement | null): void {
  if (tip !== null) tip.hidden = true;
}
