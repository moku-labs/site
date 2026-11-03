/**
 * @file The info card of the `kernel-world` island: fill it for a cube, socket or chip, place it
 * by its cube (a desktop) or at the bottom of the world (a phone), and close it with the focus
 * back where the visitor was.
 */
import { glyphPath } from "../../lib/glyphs";
import { shownGoal } from "../../lib/hero-state";
import type { InfoCard } from "../../lib/hero-view";
import { infoCard } from "../../lib/hero-view";
import { focusOn, paintWorld, part, setText } from "./render";
import type { WorldContext } from "./types";

/** Below this width the info card sits at the bottom of the world, not at its cube. */
const PHONE_QUERY = "(max-width: 760px)";

/** Room the info card keeps from the world's sides, in px. */
const INFO_EDGE = 8;

/** Gap between the info card and its cube, in px. */
const INFO_GAP = 10;

/** How far the info card may hang below the world before it moves above its cube, in px. */
const INFO_OVERHANG = 40;

/** Smallest distance of the info card from the world's top, in px. */
const INFO_TOP = 4;

/** What a click may land on and keep the info card open. */
const KEEPS_INFO = '[data-part="info"], [data-chip], [data-plug], [data-item], [data-socket]';

/** What closing the info card leaves: who opened it, and whether the focus has to go back to it. */
type ClosedInfo = {
  /** Selector of the element that opened the card, if any. */
  opener: string | undefined;
  /** The focus was in the card, on the page itself, or on a removed element. */
  stranded: boolean;
};

/**
 * Fill the info card for an item.
 *
 * @param info - The card element.
 * @param card - What it shows.
 */
function fillInfo(info: HTMLElement, card: InfoCard): void {
  setText(info, "info-name", card.name);
  setText(info, "info-source", card.source);
  setText(info, "info-does", card.does);
  setText(info, "info-layer", card.layerPlace);
  setText(info, "info-needs", card.needs);
  setText(info, "info-needed-by", card.neededBy);
  const icon = info.querySelector<SVGElement>('[data-component="cube-icon"]');
  if (icon !== null) icon.dataset.tone = card.tone;
  icon?.querySelector('[data-part="glyph"]')?.setAttribute("d", glyphPath(card.glyph));
  const status = part(info, "info-status");
  if (status !== null) {
    status.hidden = card.status === undefined;
    status.textContent = card.status ?? "";
  }
  const add = part(info, "info-add");
  if (add !== null) {
    add.hidden = card.add === undefined;
    add.textContent = card.add ?? "";
    add.dataset.add = card.id;
  }
}

/**
 * Place the info card: under its cube (above when there is no room) on a desktop, at the bottom
 * of the world on a phone.
 *
 * @param root - The hero section.
 * @param info - The card element, shown.
 * @param id - The item.
 */
function placeInfo(root: Element, info: HTMLElement, id: string): void {
  const frame = part(root, "world-frame");
  if (frame === null) return;
  const box = frame.getBoundingClientRect();
  const width = info.offsetWidth;
  const height = info.offsetHeight;
  const anchor =
    frame.querySelector(`[data-item="${id}"]`) ?? frame.querySelector(`[data-socket="${id}"]`);
  let left = (box.width - width) / 2;
  let top = box.height - height - INFO_TOP;
  if (anchor !== null && !matchMedia(PHONE_QUERY).matches) {
    const target = anchor.getBoundingClientRect();
    const centred = target.left + target.width / 2 - box.left - width / 2;
    left = Math.max(INFO_EDGE, Math.min(box.width - width - INFO_EDGE, centred));
    top = target.bottom - box.top + INFO_GAP;
    if (top + height > box.height + INFO_OVERHANG) top = target.top - box.top - height - INFO_GAP;
  }
  info.style.setProperty("--info-x", `${left}px`);
  info.style.setProperty("--info-y", `${Math.max(INFO_TOP, top)}px`);
}

/**
 * Whether closing the card would leave the focus nowhere: on the page itself, inside the card
 * that hides, or on an element a redraw removed.
 *
 * @param info - The card element.
 * @returns `true` when the focus has to go back to the opener.
 */
function isFocusStranded(info: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (active === null || active === document.body || !active.isConnected) return true;
  return info?.contains(active) ?? false;
}

/**
 * Forget the open info card and hide it, without redrawing.
 *
 * @param ctx - The island context.
 * @returns The selector of the element that opened it, and whether the focus has to go back to it.
 */
export function hideInfo(ctx: WorldContext): ClosedInfo {
  const { opener } = ctx.state;
  const info = part(ctx.el, "info");
  const stranded = info !== null && !info.hidden && isFocusStranded(info);
  ctx.state.selected = undefined;
  ctx.state.opener = undefined;
  if (info !== null) info.hidden = true;
  return { opener, stranded };
}

/**
 * Give the focus back to what opened the info card.
 *
 * @param ctx - The island context.
 * @param closed - What {@link hideInfo} returned.
 * @param force - Move the focus even when the visitor has it elsewhere (Esc and ×).
 */
export function returnFocus(ctx: WorldContext, closed: ClosedInfo, force: boolean): void {
  if (closed.opener !== undefined && (force || closed.stranded)) focusOn(ctx.el, closed.opener);
}

/**
 * Close the info card: its needs arcs go, and the focus goes back to what opened it on Esc or ×,
 * and on every other close that would leave the focus nowhere.
 *
 * @param ctx - The island context.
 * @param force - Always move the focus back (Esc and ×).
 */
export function closeInfo(ctx: WorldContext, force: boolean): void {
  const info = part(ctx.el, "info");
  if (ctx.state.selected === undefined && (info === null || info.hidden)) return;
  const closed = hideInfo(ctx);
  paintWorld(ctx);
  returnFocus(ctx, closed, force);
}

/**
 * Open the info card of a cube, socket or chip, and show the item's needs arcs. A second click on
 * the same item closes it.
 *
 * @param ctx - The island context.
 * @param id - The item.
 * @param opener - Selector of the element that opened it, for the focus on close.
 * @param toggle - A second open of the same item closes the card.
 */
export function openInfo(
  ctx: WorldContext,
  id: string,
  opener: string | undefined,
  toggle: boolean
): void {
  const view = shownGoal(ctx.state);
  const info = part(ctx.el, "info");
  if (view === undefined || info === null) return;
  if (toggle && ctx.state.selected === id && !info.hidden) {
    closeInfo(ctx, false);
    return;
  }
  const card = infoCard(view.goal, view.state, id, view.versions);
  if (card === undefined) return;
  ctx.state.selected = id;
  ctx.state.opener = opener;
  paintWorld(ctx);
  fillInfo(info, card);
  info.hidden = false;
  placeInfo(ctx.el, info, id);
}

/**
 * Close the info card when a click lands outside it and outside what opens one.
 *
 * @param ctx - The island context.
 * @param event - A click anywhere on the page.
 */
export function clickAway(ctx: WorldContext, event: Event): void {
  if (event.target instanceof Element && event.target.closest(KEEPS_INFO) === null) {
    closeInfo(ctx, false);
  }
}
