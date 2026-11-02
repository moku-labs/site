/**
 * @file The `pyramid` island: relation highlight, tooltip and links of the bricks.
 */
import type { Spa } from "@moku-labs/web/browser";
import { createIsland } from "@moku-labs/web/browser";
import type { BrickKind, PyramidDemo, PyramidPackage } from "../lib/pyramid";
import { relatedBricks } from "../lib/pyramid";
import { readData } from "./dataset";
import { hideTip, showTip } from "./world-tip";

/** What the island reads from the bricks once, at mount. */
type PyramidState = {
  /** The demos with their stacks. */
  demos: PyramidDemo[];
  /** The packages of the middle row. */
  packages: PyramidPackage[];
};

/** Brick kinds, to narrow `data-kind`. */
const KINDS = new Set<string>(["core", "package", "demo"]);

/**
 * Whether a string is a brick kind.
 *
 * @param value - A `data-kind` value.
 * @returns `true` for `core`, `package` or `demo`.
 */
function isBrickKind(value: string | undefined): value is BrickKind {
  return value !== undefined && KINDS.has(value);
}

/**
 * Read the demos and packages from the drawn bricks.
 *
 * @param root - The pyramid block.
 * @returns The island state.
 */
function readBricks(root: Element): PyramidState {
  const state: PyramidState = { demos: [], packages: [] };
  for (const brick of root.querySelectorAll<SVGElement>("[data-brick]")) {
    const id = brick.dataset.id ?? "";
    if (brick.dataset.kind === "demo") {
      state.demos.push({ id, name: id, stack: (brick.dataset.stack ?? "").split(" ") });
    } else if (brick.dataset.kind === "package") {
      state.packages.push({ id, label: id });
    }
  }
  return state;
}

/**
 * Light a brick and everything related to it; dim the rest; show its tooltip.
 *
 * @param ctx - The island context.
 * @param brick - The hovered or focused brick.
 */
function light(ctx: Spa.IslandContext<PyramidState>, brick: Element): void {
  if (!(brick instanceof SVGElement)) return;
  const kind = brick.dataset.kind;
  if (!isBrickKind(kind)) return;
  const related = relatedBricks(kind, brick.dataset.id ?? "", ctx.state.demos, ctx.state.packages);
  const svg = brick.ownerSVGElement;
  if (svg !== null) svg.dataset.focus = "";
  for (const other of ctx.el.querySelectorAll<SVGElement>("[data-brick]")) {
    if (other === brick) other.dataset.current = "";
    else delete other.dataset.current;
    if (related.has(`${other.dataset.kind}:${other.dataset.id}`)) other.dataset.related = "";
    else delete other.dataset.related;
  }
  const tip = ctx.el.querySelector<HTMLElement>('[data-component="world-tip"]');
  if (tip !== null) showTip(tip, brick);
}

/**
 * Clear every highlight and hide the tooltip.
 *
 * @param root - The pyramid block.
 */
function clear(root: Element): void {
  const svg = root.querySelector("svg");
  if (svg !== null) delete svg.dataset.focus;
  for (const brick of root.querySelectorAll<SVGElement>("[data-brick]")) {
    delete brick.dataset.current;
    delete brick.dataset.related;
  }
  hideTip(root.querySelector('[data-component="world-tip"]'));
}

/**
 * Open a brick's page: the docs for core and packages, the demo card for a demo.
 *
 * @param ctx - The island context.
 * @param brick - The brick.
 */
function open(ctx: Spa.IslandContext<PyramidState>, brick: Element): void {
  const href = readData(brick, "href");
  if (href !== undefined) ctx.navigate(href);
}

/**
 * Pyramid: hover or focus a demo to light the packages it is built from and the core;
 * hover a package to light the demos built with it. Click or Enter opens the page.
 */
export const pyramidIsland = createIsland("pyramid", {
  state: (ctx): PyramidState => readBricks(ctx.el),
  events: {
    "pointerover [data-brick]": (ctx, _event, brick) => light(ctx, brick),
    "focusin [data-brick]": (ctx, _event, brick) => light(ctx, brick),
    pointerleave: ctx => clear(ctx.el),
    focusout: (ctx, event) => {
      const next = event instanceof FocusEvent ? event.relatedTarget : undefined;
      if (!(next instanceof Element && next.closest("[data-brick]"))) clear(ctx.el);
    },
    "click [data-brick]": (ctx, _event, brick) => open(ctx, brick),
    "keydown [data-brick]": (ctx, event, brick) => {
      if (!(event instanceof KeyboardEvent) || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      open(ctx, brick);
    }
  }
});
