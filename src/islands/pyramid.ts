/**
 * @file The `pyramid` island: relation highlight, tooltip and links of the bricks.
 */
import type { Spa } from "@moku-labs/web/browser";
import { createIsland } from "@moku-labs/web/browser";
import type { BrickKind, PyramidDemo, PyramidPackage } from "../lib/pyramid";
import { relatedBricks } from "../lib/pyramid";
import { readData } from "./dataset";
import { openHref } from "./fragment";
import { hideTip, showTip } from "./world-tip";

/** What the island reads from the bricks once, at mount. */
type PyramidState = {
  /** The demos with their stacks. */
  demos: PyramidDemo[];
  /** The packages of the middle row. */
  packages: PyramidPackage[];
  /** The brick a finger lit with its last tap; a second tap on it opens its page. */
  armed: Element | undefined;
  /**
   * The last press came from a finger or a pen. Read from `pointerdown`, because Safari on iOS
   * reports the click that follows a tap as a mouse click.
   */
  finger: boolean;
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
  const state: PyramidState = { demos: [], packages: [], armed: undefined, finger: false };
  // Both drawings hold the same bricks; the first one is enough.
  const drawing = root.querySelector("svg");
  for (const brick of drawing?.querySelectorAll<SVGElement>("[data-brick]") ?? []) {
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
  for (const svg of root.querySelectorAll("svg")) delete svg.dataset.focus;
  for (const brick of root.querySelectorAll<SVGElement>("[data-brick]")) {
    delete brick.dataset.current;
    delete brick.dataset.related;
  }
  hideTip(root.querySelector('[data-component="world-tip"]'));
}

/**
 * Whether an event came from a finger.
 *
 * @param event - A pointer or click event.
 * @returns `true` for touch and pen input, which have no hover.
 */
function isFinger(event: Event): boolean {
  return event instanceof PointerEvent && event.pointerType !== "mouse";
}

/**
 * A click on a brick. A mouse opens the page. A finger has no hover, so its first tap lights the
 * brick and shows the tip, and the second tap on the same brick opens the page.
 *
 * @param ctx - The island context.
 * @param brick - The brick.
 */
function tap(ctx: Spa.IslandContext<PyramidState>, brick: Element): void {
  if (!ctx.state.finger || ctx.state.armed === brick) {
    ctx.state.armed = undefined;
    open(ctx, brick);
    return;
  }
  ctx.state.armed = brick;
  light(ctx, brick);
}

/**
 * Open a brick's page: the docs for core and packages, the demo card for a demo.
 *
 * @param ctx - The island context.
 * @param brick - The brick.
 */
function open(ctx: Spa.IslandContext<PyramidState>, brick: Element): void {
  const href = readData(brick, "href");
  if (href !== undefined) openHref(ctx, href);
}

/**
 * Pyramid: hover or focus a demo to light the packages it is built from and the core;
 * hover a package to light the demos built with it. Click or Enter opens the page.
 */
export const pyramidIsland = createIsland("pyramid", {
  state: (ctx): PyramidState => readBricks(ctx.el),
  // The tip is fixed to the screen, so a finger's tip goes when the page scrolls.
  onMount: ctx => {
    const away = (): void => {
      ctx.state.armed = undefined;
      clear(ctx.el);
    };
    addEventListener("scroll", away, { passive: true });
    ctx.cleanup(() => removeEventListener("scroll", away));
  },
  events: {
    "pointerover [data-brick]": (ctx, _event, brick) => light(ctx, brick),
    "focusin [data-brick]": (ctx, _event, brick) => light(ctx, brick),
    // Remember what pressed: the click after it does not always say (iOS Safari: "mouse").
    pointerdown: (ctx, event) => {
      ctx.state.finger = isFinger(event);
    },
    // A finger leaves the brick the moment it lifts; the tip stays until the next tap.
    pointerleave: (ctx, event) => {
      if (!isFinger(event)) clear(ctx.el);
    },
    // A tap beside the bricks puts the tip away.
    click: (ctx, event) => {
      if (event.target instanceof Element && event.target.closest("[data-brick]")) return;
      ctx.state.armed = undefined;
      clear(ctx.el);
    },
    focusout: (ctx, event) => {
      const next = event instanceof FocusEvent ? event.relatedTarget : undefined;
      if (!(next instanceof Element && next.closest("[data-brick]"))) clear(ctx.el);
    },
    "click [data-brick]": (ctx, _event, brick) => tap(ctx, brick),
    "keydown [data-brick]": (ctx, event, brick) => {
      if (!(event instanceof KeyboardEvent) || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      open(ctx, brick);
    }
  }
});
