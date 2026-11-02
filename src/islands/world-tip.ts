/**
 * @file Fill and place the world tooltip (D1), shared by the hero and pyramid islands. Not an
 * island.
 */

/** Keep the tooltip this far from the viewport's side edges (half its max width). */
const EDGE = 150;

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
 * `version`, `text`, `action`, and `art`, an image URL).
 *
 * @param tip - The `[data-component="world-tip"]` element.
 * @param target - The hovered or focused element.
 * @example
 * ```ts
 * showTip(tip, block); // block has data-tip-title="@moku-labs/web" …
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
  const centre = Math.max(EDGE, Math.min(innerWidth - EDGE, box.left + box.width / 2));
  tip.style.setProperty("--tip-x", `${centre}px`);
  tip.style.setProperty("--tip-y", `${box.top - 8}px`);
  tip.hidden = false;
}

/**
 * Hide the tooltip.
 *
 * @param tip - The tooltip, if the section has one.
 * @example
 * ```ts
 * hideTip(root.querySelector('[data-component="world-tip"]'));
 * ```
 */
export function hideTip(tip: HTMLElement | null): void {
  if (tip !== null) tip.hidden = true;
}
