/**
 * @file Painting of the `kernel-world` island: the world's scene from the same nodes the build
 * drew, the tray cards, the chips, the code card, kernel.log, the verdict and the goal switch.
 * Only `data-*` states, text and rebuilt lists; every look is in `src/components/hero.css`.
 */
import { assemblyText } from "../../data/assembly";
import type { LogLine } from "../../lib/assembly";
import { glyphPath } from "../../lib/glyphs";
import { shownGoal } from "../../lib/hero-state";
import type {
  CodeRow,
  HeroPanel,
  StandingChip,
  SvgChild,
  TrayCard,
  WorldMotion
} from "../../lib/hero-view";
import { heroPanel, LOG_LINES, worldScene } from "../../lib/hero-view";
import { PHONE_VIEW_BOX, PILL_PADDING, WORLD_VIEW_BOX } from "../../lib/hero-world";
import { readData } from "../dataset";
import type { WorldContext } from "./types";

/** Namespace of the world's SVG elements. */
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/**
 * An element of the hero by its `data-part`.
 *
 * @param root - The hero section.
 * @param name - The part name.
 * @returns The element, or `null`.
 */
export function part(root: Element, name: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-part="${name}"]`);
}

/**
 * Set the text of a part.
 *
 * @param root - Where to look.
 * @param name - The part name.
 * @param text - The text.
 */
export function setText(root: Element, name: string, text: string): void {
  const element = part(root, name);
  if (element !== null) element.textContent = text;
}

/**
 * Focus an element found by a selector, if it can take focus.
 *
 * @param root - Where to look.
 * @param selector - The selector.
 */
export function focusOn(root: Element, selector: string): void {
  const target = root.querySelector(selector);
  if (target instanceof HTMLElement || target instanceof SVGElement) target.focus();
}

/**
 * The value of a `data-*` key on the focused element, when the focus is inside a container.
 *
 * @param container - The container a rebuild is about to replace.
 * @param key - The camel-case dataset key.
 * @returns The value, if the focus is inside and the element carries the key.
 */
function focusedData(container: Element, key: string): string | undefined {
  const active = document.activeElement;
  return active !== null && container.contains(active) ? readData(active, key) : undefined;
}

/**
 * One node of the drawing as a DOM node.
 *
 * @param child - An element node or a run of text.
 * @returns The SVG element, or the text node.
 */
function svgElement(child: SvgChild): Node {
  if (typeof child === "string") return document.createTextNode(child);
  const element = document.createElementNS(SVG_NAMESPACE, child.tag);
  for (const [name, value] of Object.entries(child.attributes)) {
    if (value !== undefined) element.setAttribute(name, String(value));
  }
  element.append(...child.children.map(node => svgElement(node)));
  return element;
}

/**
 * Fit each shown callout pill to its text as the font drew it. The layout placed the pills by a
 * wider estimate, so a fitted pill never reaches another text; a hidden layer keeps the estimate.
 *
 * @param scene - The world's scene group.
 */
function fitPills(scene: Element): void {
  for (const pill of scene.querySelectorAll('[data-callout="waiting"], [data-callout="running"]')) {
    const text = pill.querySelector("text");
    const rect = pill.querySelector("rect");
    if (!(text instanceof SVGTextElement) || rect === null) continue;
    const box = text.getBBox();
    if (box.width === 0) continue;
    const across = box.height * PILL_PADDING.across;
    const along = box.height * PILL_PADDING.along;
    const height = box.height + 2 * along;
    rect.setAttribute("x", String(box.x - across));
    rect.setAttribute("y", String(box.y - along));
    rect.setAttribute("width", String(box.width + 2 * across));
    rect.setAttribute("height", String(height));
    rect.setAttribute("rx", String(height / 2));
  }
}

/**
 * Redraw the world's scene for the goal on show, keeping the focus on the same cube.
 *
 * @param ctx - The island context.
 * @param motion - The motion the drawing starts with.
 */
export function paintWorld(ctx: WorldContext, motion: WorldMotion = {}): void {
  const view = shownGoal(ctx.state);
  const scene = ctx.el.querySelector('[data-part="scene"]');
  if (view === undefined || scene === null) return;
  const focused = focusedData(scene, "item");
  const nodes = worldScene({ ...view, selected: ctx.state.selected, motion });
  scene.replaceChildren(...nodes.map(node => svgElement(node)));
  fitPills(scene);
  if (focused !== undefined) focusOn(scene, `[data-item="${focused}"]`);
}

/**
 * Show a tray card.
 *
 * @param button - The card's button.
 * @param card - What it shows.
 */
function paintCard(button: HTMLButtonElement, card: TrayCard): void {
  button.dataset.plug = card.id;
  button.dataset.state = card.state;
  button.disabled = card.state === "placed";
  if (card.state === "waiting") button.setAttribute("aria-disabled", "true");
  else button.removeAttribute("aria-disabled");
  button.setAttribute("aria-label", card.label);
  const name = button.querySelector("b");
  const note = button.querySelector("small");
  if (name !== null) name.textContent = card.id;
  if (note !== null) note.textContent = card.note;
  button.querySelector('[data-part="glyph"]')?.setAttribute("d", glyphPath(card.glyph));
}

/**
 * One standing chip.
 *
 * @param chip - The chip.
 * @returns Its list item.
 */
function chipItem(chip: StandingChip): HTMLLIElement {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.chip = chip.id;
  button.setAttribute("aria-label", chip.label);
  button.textContent = chip.id;
  item.append(button);
  return item;
}

/**
 * One line of the code card: its number, its coloured runs and, when new, the mark.
 *
 * @param row - The line.
 * @returns Its list item.
 */
function codeItem(row: CodeRow): HTMLLIElement {
  const item = document.createElement("li");
  const number = document.createElement("span");
  number.dataset.part = "line-number";
  number.textContent = String(row.number);
  const code = document.createElement("code");
  if (row.tokens.length === 0) code.textContent = " ";
  for (const token of row.tokens) {
    if (token.kind === undefined) {
      code.append(token.text);
      continue;
    }
    const run = document.createElement("span");
    run.dataset.token = token.kind;
    run.textContent = token.text;
    code.append(run);
  }
  item.append(number, code);
  if (row.isNew) {
    item.dataset.new = "";
    const mark = document.createElement("span");
    mark.toggleAttribute("data-visually-hidden", true);
    mark.textContent = ` ${assemblyText.newLine}`;
    item.append(mark);
  }
  return item;
}

/**
 * One kernel.log line.
 *
 * @param line - The line.
 * @returns Its list item.
 */
function logItem(line: LogLine): HTMLLIElement {
  const item = document.createElement("li");
  item.dataset.kind = line.kind;
  item.textContent = line.text;
  return item;
}

/**
 * Show kernel.log. A step adds only its new lines, so the live region announces only them, and
 * the oldest lines go; a switch or Start over shows another goal's lines without a word.
 *
 * @param log - The log list, a polite live region.
 * @param tail - The newest lines the log shows.
 * @param fresh - The lines the step added, or `undefined` to replace the log quietly.
 */
function paintLog(
  log: HTMLElement,
  tail: readonly LogLine[],
  fresh: readonly LogLine[] | undefined
): void {
  if (fresh === undefined) {
    log.setAttribute("aria-live", "off");
    log.replaceChildren(...tail.map(line => logItem(line)));
    requestAnimationFrame(() => log.setAttribute("aria-live", "polite"));
    return;
  }
  log.append(...fresh.map(line => logItem(line)));
  while (log.children.length > LOG_LINES) log.firstElementChild?.remove();
}

/**
 * Show everything around the world: the tray, the chips, the code card, the log and the verdict.
 * A focused chip keeps the focus through the rebuild.
 *
 * @param root - The hero section.
 * @param panel - What to show.
 * @param fresh - The log lines the step added, or `undefined` to replace the log quietly.
 */
function paintPanel(root: Element, panel: HeroPanel, fresh: readonly LogLine[] | undefined): void {
  setText(root, "tray-heading", panel.heading);
  setText(root, "hint", panel.hint);
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-part="cards"] [data-plug]');
  for (const [index, button] of buttons.entries()) {
    const card = panel.cards[index];
    if (card !== undefined) paintCard(button, card);
  }

  // The standing chips are rebuilt; the focus stays on the same chip.
  const lead = root.querySelector('[data-part="standing"] p');
  if (lead !== null) lead.textContent = panel.standingLead;
  const chips = part(root, "chips");
  if (chips !== null) {
    const focused = focusedData(chips, "chip");
    chips.replaceChildren(...panel.chips.map(chipItem));
    if (focused !== undefined) focusOn(chips, `[data-chip="${focused}"]`);
  }

  // The code card, kernel.log and the phone's verdict line.
  part(root, "code")?.replaceChildren(...panel.code.map(codeItem));
  const log = part(root, "log");
  if (log !== null) paintLog(log, panel.log, fresh);
  const verdict = part(root, "verdict");
  if (verdict === null) return;
  verdict.textContent = panel.verdict?.text ?? "";
  if (panel.verdict === undefined) delete verdict.dataset.kind;
  else verdict.dataset.kind = panel.verdict.kind;
}

/**
 * Mark the goal on show in the switch; only it takes the Tab stop.
 *
 * @param root - The hero section.
 * @param goalId - The goal on show.
 */
function paintSwitch(root: Element, goalId: string): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-goal]")) {
    const isCurrent = button.dataset.goal === goalId;
    button.setAttribute("aria-checked", isCurrent ? "true" : "false");
    button.tabIndex = isCurrent ? 0 : -1;
  }
}

/**
 * Show the goal on show everywhere: the world, the panel and the switch.
 *
 * @param ctx - The island context.
 * @param motion - The motion the world starts with.
 * @param quiet - Another goal or a fresh start shows: kernel.log is replaced without a word.
 */
export function render(ctx: WorldContext, motion: WorldMotion = {}, quiet = false): void {
  const view = shownGoal(ctx.state);
  if (view === undefined) return;
  const { log } = view.state;
  const isStep = !quiet && ctx.state.logShown <= log.length;
  const fresh = isStep ? log.slice(ctx.state.logShown) : undefined;
  ctx.state.logShown = log.length;
  paintWorld(ctx, motion);
  paintPanel(ctx.el, heroPanel(view.goal, view.state, view.versions), fresh);
  paintSwitch(ctx.el, view.goal.id);
}

/**
 * Frame the world for the screen: the phone window on a phone, the whole world otherwise. The
 * CSS widens the whole-world drawing on a phone only while this mark is missing (no JS).
 *
 * @param root - The hero section.
 * @param isPhone - The phone window applies.
 */
export function frameWorld(root: Element, isPhone: boolean): void {
  const svg = root.querySelector<SVGSVGElement>('svg[data-part="world"]');
  if (svg === null) return;
  svg.setAttribute("viewBox", isPhone ? PHONE_VIEW_BOX : WORLD_VIEW_BOX);
  if (isPhone) svg.dataset.window = "phone";
  else delete svg.dataset.window;
}
