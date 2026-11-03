/**
 * @file What the visitor does in the `kernel-world` island, beyond a drag: add a piece (fly it,
 * then let the rules decide), the finish one motion at a time, switch the goal, start over.
 */
import type { Goal } from "../../data/assembly";
import type { AssemblyResult } from "../../lib/assembly";
import { addPiece, initialAssembly } from "../../lib/assembly";
import { dropShow, pieceGlyph, shownGoal } from "../../lib/hero-state";
import { cubeAnchor } from "../../lib/hero-world";
import type { ScreenPoint } from "../../lib/kernel-flight";
import { arcToTarget, EASE_FLIGHT, FLIGHT_DURATION } from "../../lib/kernel-flight";
import { fly, launchFlyer, reducedMotion, toScreen } from "./flight";
import { closeInfo, hideInfo, returnFocus } from "./info";
import { focusOn, paintWorld, part, render } from "./render";
import type { WorldContext } from "./types";

/** The finish, one motion at a time: light runs up the arcs at this point, in ms after the drop. */
const FINISH_PULSE_AT = 650;

/** The finish: the lit arcs fade. */
const FINISH_FADE_AT = 2050;

/** The finish: the app cube rises with the completion strip. */
const FINISH_RISE_AT = 2400;

/** Step through the goals per arrow key. */
const GOAL_KEYS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1
};

/**
 * Fly a piece from a screen point to its socket.
 *
 * @param ctx - The island context.
 * @param id - The piece.
 * @param from - Where the flight starts: the drop point, the tray card or the Add button.
 */
async function flyToSocket(ctx: WorldContext, id: string, from: ScreenPoint): Promise<void> {
  const view = shownGoal(ctx.state);
  const svg = ctx.el.querySelector<SVGSVGElement>('svg[data-part="world"]');
  const anchor = view === undefined ? undefined : cubeAnchor(view.goal, id);
  if (svg === null || anchor === undefined) return;
  const flyer = launchFlyer(ctx.el, id, pieceGlyph(view?.goal, id), from);
  if (flyer === undefined) return;
  try {
    await fly(flyer, arcToTarget(from, toScreen(svg, anchor)), FLIGHT_DURATION, EASE_FLIGHT);
  } finally {
    flyer.remove();
  }
}

/**
 * Run a step of the finish after a delay, unless a switch or Start over came first.
 *
 * @param ctx - The island context.
 * @param delay - Delay in ms.
 * @param step - The step.
 */
function later(ctx: WorldContext, delay: number, step: () => void): void {
  const { epoch, timers } = ctx.state;
  const timer = setTimeout(() => {
    timers.delete(timer);
    if (ctx.state.epoch === epoch) step();
  }, delay);
  timers.add(timer);
}

/**
 * The finish, one motion at a time: light runs up the needs arcs bottom to top, the arcs fade,
 * then the app cube rises alone with the completion strip and the "running" line.
 *
 * @param ctx - The island context.
 */
function finish(ctx: WorldContext): void {
  later(ctx, FINISH_PULSE_AT, () => {
    const closed = hideInfo(ctx);
    paintWorld(ctx, { pulse: true });
    returnFocus(ctx, closed, false);
  });
  later(ctx, FINISH_FADE_AT, () => {
    ctx.el.querySelector('[data-part="arcs"]')?.toggleAttribute("data-fading", true);
  });
  later(ctx, FINISH_RISE_AT, () => {
    ctx.state.finishing = false;
    render(ctx, { rise: true });
  });
}

/**
 * Show what a drop caused: the piece snaps in (or hovers, waiting), the pieces that waited for it
 * slide down, the kernel flashes; the last piece starts the finish.
 *
 * @param ctx - The island context.
 * @param goal - The goal the drop was for.
 * @param id - The dropped piece.
 * @param result - What the rules made of it.
 */
function commit(ctx: WorldContext, goal: Goal, id: string, result: AssemblyResult): void {
  const { state } = ctx;
  state.progress.set(goal.id, result.state);
  const show = dropShow(id, result, reducedMotion());
  state.finishing = show.finishing;
  render(ctx, show.motion);
  if (show.finishing) finish(ctx);
}

/**
 * Add a piece of the goal on show: the one path for a tap, Enter, a drop and the info card's Add
 * button. The piece flies from where it was picked to its socket, then the rules decide.
 *
 * @param ctx - The island context.
 * @param id - The piece.
 * @param from - Where the flight starts; no flight without one or under reduced motion.
 */
export async function addFrom(
  ctx: WorldContext,
  id: string,
  from: ScreenPoint | undefined
): Promise<void> {
  const { state } = ctx;
  const view = shownGoal(state);
  if (view === undefined || state.busy || state.finishing) return;
  const result = addPiece(view.goal, view.state, id);
  if (result.steps.length === 0) return;
  closeInfo(ctx, false);
  const { epoch } = state;
  if (from !== undefined && !reducedMotion()) {
    // The tray dims while the piece flies: it takes no other until this one lands.
    const tray = part(ctx.el, "tray");
    state.busy = true;
    tray?.toggleAttribute("data-busy", true);
    try {
      await flyToSocket(ctx, id, from);
    } finally {
      state.busy = false;
      tray?.toggleAttribute("data-busy", false);
    }
    if (state.epoch !== epoch) return;
  }
  commit(ctx, view.goal, id, result);
}

/**
 * Show another goal, with the progress it had; its kernel.log shows without a word.
 *
 * @param ctx - The island context.
 * @param goalId - The goal.
 * @param focus - Move the focus to its radio (arrow keys).
 */
export function switchGoal(ctx: WorldContext, goalId: string, focus: boolean): void {
  const { state } = ctx;
  if (goalId === state.goalId || !state.progress.has(goalId)) return;
  state.epoch += 1;
  state.finishing = false;
  const closed = hideInfo(ctx);
  state.goalId = goalId;
  render(ctx, {}, true);
  if (focus) focusOn(ctx.el, `[data-goal="${goalId}"]`);
  else returnFocus(ctx, closed, false);
}

/**
 * Move through the goals with the arrow keys, as a radio group does.
 *
 * @param ctx - The island context.
 * @param event - The keydown event.
 */
export function stepGoal(ctx: WorldContext, event: Event): void {
  if (!(event instanceof KeyboardEvent)) return;
  const step = GOAL_KEYS[event.key];
  const ids: readonly string[] = ctx.state.data?.goals.map(goal => goal.id) ?? [];
  if (step === undefined || ids.length === 0) return;
  event.preventDefault();
  const index = ids.indexOf(ctx.state.goalId);
  const next = ids[(index + step + ids.length) % ids.length];
  if (next !== undefined) switchGoal(ctx, next, true);
}

/**
 * Start the goal on show over; the other goals keep their progress.
 *
 * @param ctx - The island context.
 */
export function startOver(ctx: WorldContext): void {
  const { state } = ctx;
  const view = shownGoal(state);
  if (view === undefined) return;
  state.epoch += 1;
  state.finishing = false;
  const closed = hideInfo(ctx);
  state.progress.set(view.goal.id, initialAssembly(view.goal, view.versions));
  render(ctx, {}, true);
  returnFocus(ctx, closed, false);
}
