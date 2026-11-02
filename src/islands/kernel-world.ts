/**
 * @file The `kernel-world` island: the hero's playable kernel (U6, design §7, F1–F3).
 *
 * The world, the tray and kernel.log are rendered at build in their first-paint state. This
 * island replays the kernel with the pure reducer of `src/lib/kernel-tray.ts` and the real
 * kernel messages from the hero's `data-props` (D9). It only sets `data-*` states, text and the
 * flyer's position; every look is in `src/components/hero.css`.
 */
import type { Spa } from "@moku-labs/web/browser";
import { createIsland } from "@moku-labs/web/browser";
import type { TrayPlugin } from "../data/tray";
import { fallPoint, kernelTop, socketCentre } from "../lib/hero-world";
import type { Point } from "../lib/iso";
import type { TrayMessages } from "../lib/kernel-errors";
import type { HeroState } from "../lib/kernel-tray";
import {
  appLine,
  initialHeroState,
  plugIn,
  seedHeroState,
  trayNote,
  visibleLog
} from "../lib/kernel-tray";
import { readData } from "./dataset";
import { hideTip, showTip } from "./world-tip";

/** What the hero hands the island through `data-props`. */
type HeroData = {
  /** The tray in display order. */
  tray: readonly TrayPlugin[];
  /** The real kernel's messages for the tray. */
  messages: TrayMessages;
  /** Tray items plugged in before first paint. */
  seed: readonly string[];
};

/** A point on the screen, in CSS px. */
type ScreenPoint = {
  /** Distance from the viewport's left edge. */
  x: number;
  /** Distance from the viewport's top edge. */
  y: number;
};

/** A tray plugin being dragged. */
type Drag = {
  /** Tray item id. */
  id: string;
  /** The captured pointer. */
  pointerId: number;
  /** The tray button. */
  button: HTMLElement;
  /** Where the drag started. */
  start: ScreenPoint;
  /** The ghost following the pointer, once the pointer moved far enough. */
  ghost: HTMLElement | undefined;
};

/** Per-instance state of the island. */
type WorldState = {
  /** The hero's props; `undefined` when they are missing, and the island stays static. */
  props: HeroData | undefined;
  /** What the hero shows. */
  hero: HeroState;
  /** A plugin is in flight; new plugs wait. */
  busy: boolean;
  /** The drag in progress. */
  drag: Drag | undefined;
  /** Swallow the click that follows a drag. */
  suppressClick: boolean;
};

/** The island context with its state. */
type WorldContext = Spa.IslandContext<WorldState>;

/** Pointer travel before a press becomes a drag. */
const DRAG_THRESHOLD = 6;

/** How far around the kernel a drop still counts. */
const KERNEL_REACH = 28;

/** Easing of the throw arc, the drop into a socket and the tumble. */
const EASE_THROW = "cubic-bezier(.45,.1,.3,1)";
const EASE_DROP = "cubic-bezier(.6,0,.9,.4)";
const EASE_TUMBLE = "cubic-bezier(.3,.2,.6,1)";
const EASE_RETURN = "cubic-bezier(.3,.7,.3,1)";

/**
 * Whether a parsed value has the shape of the hero's props.
 *
 * @param value - The parsed `data-props`.
 * @returns `true` when it can drive the island.
 */
function isHeroData(value: unknown): value is HeroData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Record<keyof HeroData, unknown>>;
  return (
    Array.isArray(candidate.tray) &&
    Array.isArray(candidate.seed) &&
    typeof candidate.messages === "object" &&
    candidate.messages !== null
  );
}

/**
 * Read the hero's props.
 *
 * @param root - The hero section.
 * @returns The props, or `undefined` when they are missing or malformed.
 */
function readHeroData(root: Element): HeroData | undefined {
  if (!(root instanceof HTMLElement) || root.dataset.props === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(root.dataset.props);
    return isHeroData(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the visitor asked for less motion.
 *
 * @returns `true` under `prefers-reduced-motion: reduce`.
 */
function reducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Project a point of the world SVG onto the screen.
 *
 * @param svg - The world SVG.
 * @param point - A point in SVG units.
 * @returns The screen point.
 */
function toScreen(svg: SVGSVGElement, point: Point): ScreenPoint {
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
function centreOf(element: Element): ScreenPoint {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/**
 * A CSS translate (and optional rotation) for a keyframe.
 *
 * @param point - Where the flyer is.
 * @param turn - Rotation in degrees.
 * @returns The transform value.
 */
function placeAt(point: ScreenPoint, turn = 0): string {
  return `translate(${point.x}px, ${point.y}px) rotate(${turn}deg)`;
}

/**
 * Whether a screen point is on or near the kernel.
 *
 * @param root - The hero section.
 * @param point - The pointer.
 * @returns `true` inside the kernel's box plus its reach.
 */
function overKernel(root: Element, point: ScreenPoint): boolean {
  const kernel = root.querySelector('[data-part="kernel"]');
  if (kernel === null) return false;
  const box = kernel.getBoundingClientRect();
  return (
    point.x > box.left - KERNEL_REACH &&
    point.x < box.right + KERNEL_REACH &&
    point.y > box.top - KERNEL_REACH - 20 &&
    point.y < box.bottom + KERNEL_REACH
  );
}

/**
 * The glyph path drawn on a tray item's cube.
 *
 * @param root - The hero section.
 * @param id - Tray item id.
 * @returns The path data, `""` when the item has none.
 */
function trayGlyph(root: Element, id: string): string {
  return root.querySelector(`[data-plug="${id}"] [data-part="glyph"]`)?.getAttribute("d") ?? "";
}

/**
 * Put a copy of the flyer on screen at a point, showing a tray plugin.
 *
 * @param root - The hero section.
 * @param item - The tray plugin.
 * @param at - Where it starts.
 * @returns The flyer, or `undefined` when the template is missing.
 */
function launchFlyer(root: Element, item: TrayPlugin, at: ScreenPoint): HTMLElement | undefined {
  const template = root.querySelector('[data-part="flyer"]:not([data-clone])');
  const flyer = template?.cloneNode(true);
  if (!(flyer instanceof HTMLElement)) return undefined;
  flyer.dataset.clone = "";
  flyer.hidden = false;
  flyer.querySelector('[data-part="glyph"]')?.setAttribute("d", trayGlyph(root, item.id));
  const label = flyer.querySelector("span");
  if (label !== null) label.textContent = item.plugin;
  moveTo(flyer, at);
  root.append(flyer);
  return flyer;
}

/**
 * Move the flyer (or the drag ghost) without an animation.
 *
 * @param flyer - The flyer.
 * @param at - The new point.
 */
function moveTo(flyer: HTMLElement, at: ScreenPoint): void {
  flyer.style.setProperty("--x", `${at.x}px`);
  flyer.style.setProperty("--y", `${at.y}px`);
}

/**
 * Animate the flyer through points.
 *
 * @param flyer - The flyer.
 * @param frames - Keyframes.
 * @param duration - Length in ms.
 * @param easing - CSS easing.
 * @returns Resolves when the animation ends.
 */
async function fly(
  flyer: HTMLElement,
  frames: Keyframe[],
  duration: number,
  easing: string
): Promise<void> {
  await flyer.animate(frames, { duration, easing, fill: "forwards" }).finished;
}

/**
 * Restart a one-shot animation state on an element (the kernel's shake and pulse).
 *
 * @param element - The element.
 * @param state - The `data-*` key.
 */
function replay(element: Element | null, state: "shake" | "pulse"): void {
  if (!(element instanceof SVGElement)) return;
  delete element.dataset[state];
  void element.getBoundingClientRect();
  element.dataset[state] = "";
}

/**
 * Show the state on the tray: verdict, note and whether an item is still pluggable.
 *
 * @param root - The hero section.
 * @param state - The island state.
 */
function paintTray(root: Element, state: WorldState): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-plug]")) {
    const id = button.dataset.plug ?? "";
    const item = state.props?.tray.find(entry => entry.id === id);
    const verdict = state.hero.verdicts[id];
    if (verdict === undefined) delete button.dataset.state;
    else button.dataset.state = verdict.state;
    button.disabled = verdict?.state === "locked";
    const note = button.querySelector("small");
    if (note !== null && item !== undefined) note.textContent = trayNote(item, verdict);
  }
}

/**
 * Show the state in kernel.log: the live `createApp` line and the last six lines.
 *
 * @param root - The hero section.
 * @param state - The island state.
 */
function paintLog(root: Element, state: WorldState): void {
  const tray = state.props?.tray ?? [];
  const call = root.querySelector('[data-part="app-arguments"]');
  if (call !== null)
    call.textContent = appLine(state.hero.accepted, tray).slice("createApp".length);
  const log = root.querySelector('[data-part="log"]');
  log?.replaceChildren(
    ...visibleLog(state.hero.log).map(line => {
      const item = document.createElement("li");
      item.dataset.kind = line.kind;
      item.textContent = line.text;
      return item;
    })
  );
}

/**
 * Show the state in the sockets: each accepted plugin's glyph and name, empty sockets dashed.
 *
 * @param root - The hero section.
 * @param state - The island state.
 */
function paintSockets(root: Element, state: WorldState): void {
  for (const socket of root.querySelectorAll<SVGGElement>('[data-part="socket"]')) {
    const id = state.hero.accepted[Number(socket.dataset.index)];
    const item = state.props?.tray.find(entry => entry.id === id);
    delete socket.dataset.snap;
    if (item === undefined) {
      delete socket.dataset.filled;
      continue;
    }
    socket.dataset.filled = "";
    socket.querySelector('[data-part="glyph"]')?.setAttribute("d", trayGlyph(root, item.id));
    const label = socket.querySelector('[data-part="plugin-label"]');
    if (label !== null) label.textContent = item.plugin;
  }
}

/**
 * Commit a new hero state and show it everywhere.
 *
 * @param root - The hero section.
 * @param state - The island state.
 * @param hero - The new hero state.
 */
function commit(root: Element, state: WorldState, hero: HeroState): void {
  state.hero = hero;
  paintTray(root, state);
  paintLog(root, state);
  paintSockets(root, state);
}

/** One throw in progress: the world it is aimed at and what is flying. */
type Flight = {
  /** The world SVG, for projecting world points. */
  svg: SVGSVGElement;
  /** The flying plugin. */
  flyer: HTMLElement;
};

/**
 * Arc the flyer from its start to a point above the kernel.
 *
 * @param flight - The throw.
 * @param from - Where it starts.
 * @returns The point above the kernel where the verdict falls.
 */
async function arcToKernel(flight: Flight, from: ScreenPoint): Promise<ScreenPoint> {
  const top = toScreen(flight.svg, kernelTop());
  const above = { x: top.x, y: top.y - 64 };
  const peak = { x: (from.x + above.x) / 2, y: Math.min(from.y, above.y) - 70 };
  await fly(
    flight.flyer,
    [{ transform: placeAt(from) }, { transform: placeAt(peak) }, { transform: placeAt(above) }],
    560,
    EASE_THROW
  );
  return above;
}

/**
 * Drop the flyer from above the kernel into a socket.
 *
 * @param flight - The throw.
 * @param above - Where it hangs.
 * @param socket - Socket fill order.
 */
async function dropIntoSocket(flight: Flight, above: ScreenPoint, socket: number): Promise<void> {
  const target = toScreen(flight.svg, socketCentre(socket));
  await fly(
    flight.flyer,
    [{ transform: placeAt(above) }, { transform: placeAt(target) }],
    230,
    EASE_DROP
  );
}

/**
 * Shove the flyer off the platform edge, spinning, alternating edges per refusal.
 *
 * @param flight - The throw.
 * @param above - Where it hangs.
 * @param rejections - Refusals so far, this one included.
 */
async function tumbleOff(flight: Flight, above: ScreenPoint, rejections: number): Promise<void> {
  const direction = rejections % 2 === 1 ? 1 : -1;
  const edge = toScreen(flight.svg, fallPoint(direction === 1));
  const lift = { x: (above.x + edge.x) / 2, y: above.y - 34 };
  const gone = { x: edge.x + direction * 50, y: edge.y + 300 };
  await fly(
    flight.flyer,
    [
      { transform: placeAt(above), opacity: 1 },
      { transform: placeAt(lift, direction * 25), opacity: 1, offset: 0.3 },
      { transform: placeAt(edge, direction * 70), opacity: 1, offset: 0.6 },
      { transform: placeAt(gone, direction * 200), opacity: 0 }
    ],
    1050,
    EASE_TUMBLE
  );
}

/**
 * Show a verdict: an accepted plugin snaps into its socket and the kernel pulses; a refused one
 * makes the kernel shake. The tray and kernel.log update either way.
 *
 * @param root - The hero section.
 * @param state - The island state.
 * @param next - The state after the verdict.
 * @param accepted - Whether the kernel accepted the plugin.
 */
function showVerdict(root: Element, state: WorldState, next: HeroState, accepted: boolean): void {
  const kernel = root.querySelector('[data-part="kernel"]');
  commit(root, state, next);
  if (!accepted) {
    replay(kernel, "shake");
    return;
  }
  const socket = next.accepted.length - 1;
  const filled = root.querySelector(`[data-part="socket"][data-index="${socket}"]`);
  if (filled instanceof SVGElement) filled.dataset.snap = "";
  replay(kernel, "pulse");
}

/**
 * Throw a tray plugin at the kernel from a screen point: it arcs to the kernel, then snaps into
 * the next socket, or tumbles off the edge while the kernel shakes. Under reduced motion the
 * verdict shows at once.
 *
 * @param ctx - The island context.
 * @param id - Tray item id.
 * @param from - Where the throw starts.
 */
async function plug(ctx: WorldContext, id: string, from: ScreenPoint): Promise<void> {
  const { state, el: root } = ctx;
  if (state.busy || state.props === undefined) return;
  const { tray, messages } = state.props;
  const { state: next, judgement } = plugIn(state.hero, id, tray, messages);
  const item = tray.find(entry => entry.id === id);
  if (judgement === undefined || item === undefined) return;
  const svg = root.querySelector<SVGSVGElement>('svg[data-part="world"]');
  const flyer = svg === null || reducedMotion() ? undefined : launchFlyer(root, item, from);
  if (svg === null || flyer === undefined) {
    showVerdict(root, state, next, judgement.accepted);
    return;
  }
  const flight: Flight = { svg, flyer };
  state.busy = true;
  try {
    const above = await arcToKernel(flight, from);
    if (judgement.accepted) await dropIntoSocket(flight, above, next.accepted.length - 1);
    showVerdict(root, state, next, judgement.accepted);
    if (!judgement.accepted) await tumbleOff(flight, above, next.rejections);
  } finally {
    flyer.remove();
    state.busy = false;
  }
}

/**
 * Start tracking a press on a tray button; it becomes a drag once the pointer moves.
 *
 * @param state - The island state.
 * @param event - The pointerdown event.
 * @param button - The tray button.
 */
function pressPlug(state: WorldState, event: Event, button: Element): void {
  if (!(event instanceof PointerEvent) || !(button instanceof HTMLButtonElement)) return;
  if (button.disabled || state.busy || event.button > 0) return;
  button.setPointerCapture(event.pointerId);
  state.drag = {
    id: button.dataset.plug ?? "",
    pointerId: event.pointerId,
    button,
    start: { x: event.clientX, y: event.clientY },
    ghost: undefined
  };
}

/**
 * Move the drag ghost with the pointer and light the kernel when the pointer is over it.
 *
 * @param root - The hero section.
 * @param state - The island state.
 * @param event - The pointermove event.
 */
function dragPlug(root: Element, state: WorldState, event: Event): void {
  const drag = state.drag;
  if (!(event instanceof PointerEvent) || drag === undefined || event.pointerId !== drag.pointerId)
    return;
  const point = { x: event.clientX, y: event.clientY };
  if (drag.ghost === undefined) {
    if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < DRAG_THRESHOLD) return;
    const item = state.props?.tray.find(entry => entry.id === drag.id);
    if (item === undefined) return;
    drag.ghost = launchFlyer(root, item, point);
    if (drag.ghost !== undefined) drag.ghost.dataset.ghost = "";
    drag.button.dataset.dragging = "";
    hideTip(root.querySelector('[data-component="world-tip"]'));
  }
  if (drag.ghost !== undefined) moveTo(drag.ghost, point);
  const stage = root.querySelector<HTMLElement>('[data-part="stage"]');
  if (stage === null) return;
  if (overKernel(root, point)) stage.dataset.hot = "";
  else delete stage.dataset.hot;
}

/**
 * End a drag: a drop on the kernel throws the plugin from there; anywhere else the ghost flies
 * back to the tray. A press that never moved is left to the click handler.
 *
 * @param ctx - The island context.
 * @param event - The pointerup or pointercancel event.
 * @param cancelled - The browser cancelled the pointer.
 */
function dropPlug(ctx: WorldContext, event: Event, cancelled: boolean): void {
  const state = ctx.state;
  const drag = state.drag;
  if (!(event instanceof PointerEvent) || drag === undefined || event.pointerId !== drag.pointerId)
    return;
  state.drag = undefined;
  if (drag.ghost === undefined) return;
  state.suppressClick = true;
  setTimeout(() => {
    state.suppressClick = false;
  }, 0);
  delete drag.button.dataset.dragging;
  const stage = ctx.el.querySelector<HTMLElement>('[data-part="stage"]');
  if (stage !== null) delete stage.dataset.hot;
  const point = { x: event.clientX, y: event.clientY };
  const ghost = drag.ghost;
  if (!cancelled && overKernel(ctx.el, point)) {
    ghost.remove();
    void plug(ctx, drag.id, point);
    return;
  }
  const home = centreOf(drag.button);
  const back = reducedMotion()
    ? Promise.resolve()
    : fly(ghost, [{ transform: placeAt(point) }, { transform: placeAt(home) }], 260, EASE_RETURN);
  void back.finally(() => ghost.remove());
}

/**
 * Show the world tooltip for the hovered or focused block, unless a plugin is being dragged.
 *
 * @param root - The hero section.
 * @param state - The island state.
 * @param target - The element with `data-tip-*`.
 */
function tipFor(root: Element, state: WorldState, target: Element): void {
  const tip = root.querySelector<HTMLElement>('[data-component="world-tip"]');
  if (tip === null || state.drag?.ghost !== undefined) return;
  if (target instanceof HTMLElement || target instanceof SVGElement) showTip(tip, target);
}

/**
 * Hide the tooltip when the pointer leaves the block it belongs to.
 *
 * @param root - The hero section.
 * @param event - The pointerout event.
 * @param target - The element with `data-tip-*`.
 */
function untip(root: Element, event: Event, target: Element): void {
  const next = event instanceof PointerEvent ? event.relatedTarget : undefined;
  if (next instanceof Node && target.contains(next)) return;
  hideTip(root.querySelector('[data-component="world-tip"]'));
}

/**
 * Open the docs page of a block.
 *
 * @param ctx - The island context.
 * @param block - The block with `data-href`.
 */
function openBlock(ctx: WorldContext, block: Element): void {
  const href = readData(block, "href");
  if (href !== undefined) ctx.navigate(href);
}

/**
 * Hero (U6): drag a tray plugin onto the kernel, or click it; accepted plugins snap into a
 * socket, refused ones tumble off the edge with the kernel's exact message in kernel.log.
 */
export const kernelWorldIsland = createIsland("kernel-world", {
  state: (ctx): WorldState => {
    const props = readHeroData(ctx.el);
    return {
      props,
      hero:
        props === undefined
          ? initialHeroState()
          : seedHeroState(props.tray, props.messages, props.seed),
      busy: false,
      drag: undefined,
      suppressClick: false
    };
  },
  events: {
    "pointerdown [data-plug]": (ctx, event, button) => pressPlug(ctx.state, event, button),
    "pointermove [data-plug]": (ctx, event) => dragPlug(ctx.el, ctx.state, event),
    "pointerup [data-plug]": (ctx, event) => dropPlug(ctx, event, false),
    "pointercancel [data-plug]": (ctx, event) => dropPlug(ctx, event, true),
    "click [data-plug]": (ctx, _event, button) => {
      if (ctx.state.suppressClick) {
        ctx.state.suppressClick = false;
        return;
      }
      if (button instanceof HTMLElement)
        void plug(ctx, button.dataset.plug ?? "", centreOf(button));
    },
    "click [data-part='reset']": ctx => {
      if (!ctx.state.busy) commit(ctx.el, ctx.state, initialHeroState());
    },
    "click [data-href]": (ctx, _event, block) => openBlock(ctx, block),
    "keydown [data-href]": (ctx, event, block) => {
      if (event instanceof KeyboardEvent && event.key === "Enter") openBlock(ctx, block);
    },
    "pointerover [data-tip-title]": (ctx, _event, target) => tipFor(ctx.el, ctx.state, target),
    "pointerout [data-tip-title]": (ctx, event, target) => untip(ctx.el, event, target),
    "focusin [data-tip-title]": (ctx, _event, target) => tipFor(ctx.el, ctx.state, target),
    "focusout [data-tip-title]": ctx =>
      hideTip(ctx.el.querySelector('[data-component="world-tip"]'))
  }
});
