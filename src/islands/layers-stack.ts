/**
 * @file The `layers-stack` island: slab, step and code line stay in step (U8).
 */
import { createIsland } from "@moku-labs/web/browser";
import { readData } from "./dataset";

/**
 * Light one layer everywhere: its slab and step get `data-active`, its code line the highlight
 * band. Code line N is layer N.
 *
 * @param root - The layers block.
 * @param layer - Layer number, `"1"` to `"3"`.
 */
function activate(root: Element, layer: string): void {
  for (const element of root.querySelectorAll<HTMLElement | SVGElement>("[data-layer]")) {
    if (element.dataset.layer === layer) element.dataset.active = "";
    else delete element.dataset.active;
  }
  for (const line of root.querySelectorAll<HTMLElement>('[data-part="gutter"] > [data-line]')) {
    if (line.dataset.line === layer) line.dataset.highlight = "";
    else delete line.dataset.highlight;
  }
}

/**
 * The layer of a code line: its position in the code block, counted from 1.
 *
 * @param line - A rendered code line.
 * @returns The layer number as text.
 */
function layerOfLine(line: Element): string {
  return String([...(line.parentElement?.children ?? [])].indexOf(line) + 1);
}

/**
 * Three layers (A1): hovering, focusing or tapping a slab, a step or a code line lights the same
 * layer in all three. The app layer is lit at first paint and on mount.
 */
export const layersStackIsland = createIsland("layers-stack", {
  events: {
    "pointerover [data-layer]": (ctx, _event, target) =>
      activate(ctx.el, readData(target, "layer") ?? ""),
    "focusin [data-layer]": (ctx, _event, target) =>
      activate(ctx.el, readData(target, "layer") ?? ""),
    "click [data-layer]": (ctx, _event, target) =>
      activate(ctx.el, readData(target, "layer") ?? ""),
    "pointerover pre code > span": (ctx, _event, line) => activate(ctx.el, layerOfLine(line))
  },
  onMount: ctx =>
    activate(ctx.el, readData(ctx.el.querySelector("[data-layer][data-active]"), "layer") ?? "3")
});
