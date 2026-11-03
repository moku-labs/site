/**
 * @file The `demo-filter` island: the demos page package filter.
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
 * The card the URL's fragment names.
 *
 * @param root - The demos block.
 * @returns The card; `undefined` with no fragment or when no card has that id.
 */
function fragmentCard(root: Element): HTMLElement | undefined {
  const { hash } = location;
  if (hash === "") return undefined;
  const cards = [...root.querySelectorAll<HTMLElement>("[data-demo]")];
  return cards.find(candidate => `#${candidate.id}` === hash);
}

/**
 * When the URL's fragment names a card the filter hides, reset the filter and go to the card. The
 * browser found nothing to scroll to while the card was hidden.
 *
 * @param root - The demos block.
 */
function revealFragmentDemo(root: Element): void {
  const card = fragmentCard(root);
  if (card === undefined || !card.hidden) return;
  applyFilter(root, ALL_DEMOS);
  card.scrollIntoView();
}

/**
 * Apply the filter the visitor chose. A filter that hides the fragment's card drops the fragment: a
 * later `hashchange` back to this entry must not take that card for one to show.
 *
 * @param root - The demos block.
 * @param filter - A package id, or `all`.
 */
function chooseFilter(root: Element, filter: string): void {
  applyFilter(root, filter);
  if (fragmentCard(root)?.hidden) {
    history.replaceState(history.state, "", location.pathname + location.search);
  }
}

/**
 * Demos: a chip filters the cards by package; "Show all six demos" in an empty state resets. A
 * fragment that names a hidden card resets too. A fragment navigation on this page fires
 * `hashchange`; one from another page does not, because `landOnFragment` replaces the URL with the
 * fragment it already has, so that path goes through the mount.
 */
export const demoFilterIsland = createIsland("demo-filter", {
  events: {
    "click [data-filter]": (ctx, _event, button) =>
      chooseFilter(ctx.el, readData(button, "filter") ?? ALL_DEMOS)
  },
  onMount: ctx => {
    const onHashChange = (): void => revealFragmentDemo(ctx.el);
    revealFragmentDemo(ctx.el);
    addEventListener("hashchange", onHashChange);
    ctx.cleanup(() => removeEventListener("hashchange", onHashChange));
  }
});
