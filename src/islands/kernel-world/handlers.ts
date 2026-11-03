/**
 * @file The wiring of the `kernel-world` island: its starting state, what it sets up on mount,
 * and its delegated events, each a one-line hand-off to the module that does the work.
 */
import type { Spa } from "@moku-labs/web/browser";
import type { AssemblyState } from "../../lib/assembly";
import { initialAssembly } from "../../lib/assembly";
import { parseHeroData } from "../../lib/hero-props";
import { readData } from "../dataset";
import { addFrom, startOver, stepGoal, switchGoal } from "./actions";
import { dragCard, dropCard, pressCard } from "./drag";
import { centreOf } from "./flight";
import { clickAway, closeInfo, openInfo } from "./info";
import { frameWorld } from "./render";
import type { WorldContext, WorldState } from "./types";

/** Below this width the world shows the phone window: the platform's width only. */
const PHONE_WORLD_QUERY = "(max-width: 520px)";

/**
 * Whether a key press activates a cube, as on a button: Enter or Space.
 *
 * @param event - A keydown event.
 * @returns `true` for Enter and Space.
 */
function isActivationKey(event: Event): event is KeyboardEvent {
  return event instanceof KeyboardEvent && (event.key === "Enter" || event.key === " ");
}

/**
 * A tap, click or Enter on a tray card: add the piece, flying from the card's cube; a waiting
 * card opens its info card instead.
 *
 * @param ctx - The island context.
 * @param button - The tray card.
 */
function pressedCard(ctx: WorldContext, button: Element): void {
  if (ctx.state.suppressClick) {
    ctx.state.suppressClick = false;
    return;
  }
  if (!(button instanceof HTMLButtonElement) || button.disabled) return;
  const id = button.dataset.plug ?? "";
  if (button.getAttribute("aria-disabled") === "true") {
    openInfo(ctx, id, `[data-plug="${id}"]`, true);
    return;
  }
  const cube = button.querySelector('[data-component="cube-icon"]') ?? button;
  void addFrom(ctx, id, centreOf(cube));
}

/**
 * The info card's Add button: the card closes with the focus back on its opener, then the piece
 * flies from the button, the same path as a tray card.
 *
 * @param ctx - The island context.
 * @param button - The Add button.
 */
function addFromInfo(ctx: WorldContext, button: Element): void {
  const id = readData(button, "add");
  if (id === undefined) return;
  const from = centreOf(button);
  closeInfo(ctx, true);
  void addFrom(ctx, id, from);
}

/**
 * The island's state at mount: the props, every goal at its start, the first goal on show.
 *
 * @param ctx - The island context.
 * @returns The state.
 */
export function createWorldState(ctx: WorldContext): WorldState {
  const data = ctx.el instanceof HTMLElement ? parseHeroData(ctx.el.dataset.props) : undefined;
  const progress = new Map<string, AssemblyState>(
    data === undefined
      ? []
      : data.goals.map(goal => [goal.id, initialAssembly(goal, data.versions)] as const)
  );
  const goalId = data?.goals[0]?.id ?? "";
  return {
    data,
    goalId,
    progress,
    logShown: progress.get(goalId)?.log.length ?? 0,
    selected: undefined,
    opener: undefined,
    busy: false,
    finishing: false,
    epoch: 0,
    timers: new Set(),
    drag: undefined,
    suppressClick: false
  };
}

/**
 * Frame the world for the screen, close the info card on a click anywhere outside it, and clear
 * the finish steps on destroy.
 *
 * @param ctx - The island context.
 */
export function mountWorld(ctx: WorldContext): void {
  const phone = matchMedia(PHONE_WORLD_QUERY);
  frameWorld(ctx.el, phone.matches);
  const onScreen = (): void => {
    frameWorld(ctx.el, phone.matches);
    closeInfo(ctx, false);
  };
  phone.addEventListener("change", onScreen);
  ctx.cleanup(() => phone.removeEventListener("change", onScreen));
  const onClick = (event: Event): void => clickAway(ctx, event);
  document.addEventListener("click", onClick);
  ctx.cleanup(() => document.removeEventListener("click", onClick));
  ctx.cleanup(() => {
    for (const timer of ctx.state.timers) clearTimeout(timer);
    ctx.state.timers.clear();
  });
}

/** The island's delegated events; the framework removes them on destroy. */
export const worldEvents: Spa.IslandEvents<WorldState> = {
  "pointerdown [data-plug]": (ctx, event, button) => pressCard(ctx.state, event, button),
  "pointermove [data-plug]": (ctx, event) => dragCard(ctx, event),
  "pointerup [data-plug]": (ctx, event) => dropCard(ctx, event, false),
  "pointercancel [data-plug]": (ctx, event) => dropCard(ctx, event, true),
  "click [data-plug]": (ctx, _event, button) => pressedCard(ctx, button),
  "click [data-goal]": (ctx, _event, button) =>
    switchGoal(ctx, readData(button, "goal") ?? "", false),
  "keydown [data-goal]": (ctx, event) => stepGoal(ctx, event),
  "click [data-part='reset']": ctx => startOver(ctx),
  "click [data-item]": (ctx, _event, cube) => {
    const id = readData(cube, "item") ?? "";
    openInfo(ctx, id, `[data-item="${id}"]`, true);
  },
  "keydown [data-item]": (ctx, event, cube) => {
    if (!isActivationKey(event)) return;
    event.preventDefault();
    const id = readData(cube, "item") ?? "";
    openInfo(ctx, id, `[data-item="${id}"]`, false);
  },
  "click [data-socket]": (ctx, _event, socket) => {
    const id = readData(socket, "socket") ?? "";
    openInfo(ctx, id, `[data-plug="${id}"]`, true);
  },
  "click [data-chip]": (ctx, _event, chip) => {
    const id = readData(chip, "chip") ?? "";
    openInfo(ctx, id, `[data-chip="${id}"]`, true);
  },
  "click [data-part='info-close']": ctx => closeInfo(ctx, true),
  "click [data-part='info-add']": (ctx, _event, button) => addFromInfo(ctx, button),
  keydown: (ctx, event) => {
    if (event instanceof KeyboardEvent && event.key === "Escape") closeInfo(ctx, true);
  }
};
