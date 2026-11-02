/**
 * @file The `demo-filter` island: the demos page package filter (U11, F7).
 */
import { createIsland } from "@moku-labs/web/browser";
import { ALL_DEMOS, usesPackage } from "../lib/demos";
import { readData } from "./dataset";

/**
 * Show the demos built on a package; with none, show that package's empty state.
 *
 * @param root - The demos block.
 * @param filter - A package id, or `all`.
 */
function applyFilter(root: Element, filter: string): void {
  for (const chip of root.querySelectorAll<HTMLElement>('[data-part="filters"] [data-filter]')) {
    chip.setAttribute("aria-pressed", String(chip.dataset.filter === filter));
  }
  let shown = 0;
  for (const card of root.querySelectorAll<HTMLElement>("[data-demo]")) {
    const visible = usesPackage((card.dataset.stack ?? "").split(" "), filter);
    card.hidden = !visible;
    if (visible) shown += 1;
  }
  for (const empty of root.querySelectorAll<HTMLElement>("[data-empty-for]")) {
    empty.hidden = shown > 0 || empty.dataset.emptyFor !== filter;
  }
}

/**
 * Demos (A11): a chip filters the cards by package; "Show all six demos" in an empty state resets.
 */
export const demoFilterIsland = createIsland("demo-filter", {
  events: {
    "click [data-filter]": (ctx, _event, button) =>
      applyFilter(ctx.el, readData(button, "filter") ?? ALL_DEMOS)
  }
});
