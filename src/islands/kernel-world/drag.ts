/**
 * @file Dragging a tray card in the `kernel-world` island: a press becomes a drag past the
 * threshold, the ghost follows the pointer, the kernel and the piece's socket light while it is
 * over the kernel, and a drop there adds the piece; anywhere else the ghost flies home.
 */
import { pieceGlyph, shownGoal } from "../../lib/hero-state";
import type { ScreenPoint } from "../../lib/kernel-flight";
import {
  EASE_RETURN,
  isWithinReach,
  movedPastThreshold,
  RETURN_DURATION,
  straightFlight
} from "../../lib/kernel-flight";
import { addFrom } from "./actions";
import { centreOf, fly, launchFlyer, moveTo, reducedMotion } from "./flight";
import { closeInfo } from "./info";
import { part } from "./render";
import type { Drag, WorldContext, WorldState } from "./types";

/**
 * Whether a screen point is on or near the kernel.
 *
 * @param root - The hero section.
 * @param point - The pointer.
 * @returns `true` inside the kernel's box plus its reach.
 */
function overKernel(root: Element, point: ScreenPoint): boolean {
  const kernel = root.querySelector('[data-item="core"]');
  return kernel !== null && isWithinReach(point, kernel.getBoundingClientRect());
}

/**
 * Light the kernel and the socket of the dragged piece while it is over the kernel.
 *
 * @param root - The hero section.
 * @param id - The dragged piece over the kernel, or `undefined` when it is not.
 */
function setHot(root: Element, id: string | undefined): void {
  part(root, "stage")?.toggleAttribute("data-hot", id !== undefined);
  for (const socket of root.querySelectorAll<SVGElement>("[data-socket]")) {
    socket.toggleAttribute("data-hot", id !== undefined && socket.dataset.socket === id);
  }
}

/**
 * Whether a tray card cannot be picked up: its piece is in or waiting, or a flight or the finish
 * is playing.
 *
 * @param state - The island state.
 * @param button - The tray card.
 * @returns `true` when a press on it starts nothing.
 */
function isLocked(state: WorldState, button: HTMLButtonElement): boolean {
  const waiting = button.getAttribute("aria-disabled") === "true";
  return button.disabled || waiting || state.busy || state.finishing;
}

/**
 * Whether a pointer event comes from the pointer that started the drag.
 *
 * @param event - A pointer event.
 * @param drag - The drag in progress.
 * @returns `true` for that pointer's events.
 */
function isOwnPointer(event: Event, drag: Drag): event is PointerEvent {
  return event instanceof PointerEvent && event.pointerId === drag.pointerId;
}

/**
 * Start tracking a press on a tray card; it becomes a drag once the pointer moves.
 *
 * @param state - The island state.
 * @param event - The pointerdown event.
 * @param button - The tray card.
 */
export function pressCard(state: WorldState, event: Event, button: Element): void {
  if (!(event instanceof PointerEvent) || !(button instanceof HTMLButtonElement)) return;
  if (isLocked(state, button) || event.button > 0) return;
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
 * Move the drag ghost with the pointer, starting it once the pointer moved far enough, and light
 * the kernel and the piece's socket while the pointer is over the kernel.
 *
 * @param ctx - The island context.
 * @param event - The pointermove event.
 */
export function dragCard(ctx: WorldContext, event: Event): void {
  const { drag } = ctx.state;
  if (drag === undefined || !isOwnPointer(event, drag)) return;
  const point = { x: event.clientX, y: event.clientY };
  if (drag.ghost === undefined) {
    if (!movedPastThreshold(drag.start, point)) return;
    const glyph = pieceGlyph(shownGoal(ctx.state)?.goal, drag.id);
    drag.ghost = launchFlyer(ctx.el, drag.id, glyph, point);
    drag.button.dataset.dragging = "";
    closeInfo(ctx, false);
  }
  if (drag.ghost !== undefined) moveTo(drag.ghost, point);
  setHot(ctx.el, overKernel(ctx.el, point) ? drag.id : undefined);
}

/**
 * End a drag: a drop on the kernel adds the piece from there; anywhere else the ghost flies back
 * to its card. A press that never moved is left to the click handler.
 *
 * @param ctx - The island context.
 * @param event - The pointerup or pointercancel event.
 * @param cancelled - The browser cancelled the pointer.
 */
export function dropCard(ctx: WorldContext, event: Event, cancelled: boolean): void {
  const { state } = ctx;
  const { drag } = state;
  if (drag === undefined || !isOwnPointer(event, drag)) return;
  state.drag = undefined;
  const { ghost } = drag;
  if (ghost === undefined) return;

  // Swallow the click that follows the drag, and clear the drag's marks.
  state.suppressClick = true;
  setTimeout(() => {
    state.suppressClick = false;
  }, 0);
  delete drag.button.dataset.dragging;
  setHot(ctx.el, undefined);

  // Dropped on the kernel: add it from there. Anywhere else: the ghost flies home.
  const point = { x: event.clientX, y: event.clientY };
  if (!cancelled && overKernel(ctx.el, point)) {
    ghost.remove();
    void addFrom(ctx, drag.id, point);
    return;
  }
  const home = reducedMotion()
    ? Promise.resolve()
    : fly(ghost, straightFlight(point, centreOf(drag.button)), RETURN_DURATION, EASE_RETURN);
  void home.finally(() => ghost.remove());
}
