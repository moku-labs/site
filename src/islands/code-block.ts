/**
 * @file The `code-block` island: copy buttons, file tabs and note markers for the code figures
 * of a docs page. Mounted once on the page's `[data-content]` root, and on the landing's
 * "Start with Claude" parts, where it also swaps the example prompts.
 */
import { createIsland } from "@moku-labs/web/browser";
import { swapPrompts } from "../lib/landing-prompts";
import { copyText, flashButton } from "./clipboard";

/** Figures that get their own Copy button; a figure inside a tab group shares the group's. */
const COPYABLE =
  'figure[data-component="code"], figure[data-component="terminal"], figure[data-component="prompt"]';

/** A tab group of code figures. */
const GROUP = '[data-component="code-group"]';

/** The landing's example prompts: the island swaps in others from the pool on each visit. */
const LANDING_PROMPTS = '[data-component="claude-prompts"]';

/**
 * A Copy button.
 *
 * @returns The button.
 */
function createCopyButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.part = "copy";
  button.textContent = "Copy";
  return button;
}

/**
 * Put a numbered marker at the end of every line that carries a note. The build leaves the note
 * numbers on the line's gutter span (`data-note="1 2"`); Shiki renders one span per line.
 *
 * @param figure - A code figure.
 */
function addNoteMarkers(figure: Element): void {
  const lines = figure.querySelectorAll("pre code > span");
  for (const gutterLine of figure.querySelectorAll<HTMLElement>("[data-line][data-note]")) {
    const line = lines[Number(gutterLine.dataset.line) - 1];
    for (const note of (gutterLine.dataset.note ?? "").split(" ")) {
      const marker = document.createElement("span");
      marker.dataset.part = "note-marker";
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = note;
      line?.append(marker);
    }
  }
}

/**
 * Add the Copy buttons and note markers once per page.
 *
 * @param root - The page's content root.
 */
function enhance(root: Element): void {
  for (const group of root.querySelectorAll(GROUP)) group.append(createCopyButton());
  for (const figure of root.querySelectorAll(COPYABLE)) {
    if (figure.closest(GROUP) === null) figure.append(createCopyButton());
    if (figure.matches('[data-component="code"]')) addNoteMarkers(figure);
  }
}

/**
 * The text a Copy button copies: the build's clean `data-copy` of its figure (no notes, no
 * deleted diff rows, only the `$` commands of a terminal). In a tab group, the selected tab's.
 *
 * @param button - The Copy button.
 * @returns The text, or `""` when there is none.
 */
function copySource(button: Element): string {
  const group = button.closest(GROUP);
  if (group === null) {
    const figure = button.closest("figure");
    return figure instanceof HTMLElement ? (figure.dataset.copy ?? "") : "";
  }
  const tabs = [...group.querySelectorAll('[role="tab"]')];
  const selected = tabs.findIndex(tab => tab.getAttribute("aria-selected") === "true");
  const figure = group.querySelectorAll<HTMLElement>(":scope > figure")[Math.max(selected, 0)];
  return figure?.dataset.copy ?? "";
}

/**
 * Select a file tab. The sheet shows the figure whose position matches the selected tab.
 *
 * @param tab - The clicked tab.
 */
function selectTab(tab: Element): void {
  for (const sibling of tab.parentElement?.querySelectorAll('[role="tab"]') ?? []) {
    sibling.setAttribute("aria-selected", String(sibling === tab));
  }
}

/**
 * Highlight the code lines of one note while its list item is hovered.
 *
 * @param item - The note's `<li data-note>`.
 * @param active - Whether to highlight or clear.
 */
function highlightNote(item: Element, active: boolean): void {
  const note = item instanceof HTMLElement ? item.dataset.note : undefined;
  const figure = item.closest("figure");
  if (note === undefined || figure === null) return;
  for (const gutterLine of figure.querySelectorAll<HTMLElement>("[data-line][data-note]")) {
    const hit = active && (gutterLine.dataset.note ?? "").split(" ").includes(note);
    if (hit) gutterLine.dataset.active = "";
    else delete gutterLine.dataset.active;
  }
}

/**
 * Code blocks: Copy flips to "Copied" for 1.6 s, file tabs switch the shown file, and
 * hovering a note lights its line. On the landing's prompts it first swaps in other prompts, so
 * each Copy button attaches next to the text it copies.
 */
export const codeBlockIsland = createIsland("code-block", {
  events: {
    "click [data-part='copy']": (_ctx, _event, button) => {
      if (!(button instanceof HTMLElement)) return;
      void copyText(copySource(button)).then(copied => flashButton(button, copied));
    },
    "click [role='tab']": (_ctx, _event, tab) => selectTab(tab),
    "pointerover [data-component='code-notes'] li": (_ctx, _event, item) =>
      highlightNote(item, true),
    "pointerout [data-component='code-notes'] li": (_ctx, event, item) => {
      const next = event instanceof PointerEvent ? event.relatedTarget : undefined;
      if (!(next instanceof Node && item.contains(next))) highlightNote(item, false);
    }
  },
  onMount: ctx => {
    if (ctx.el.matches(LANDING_PROMPTS)) swapPrompts(ctx.el);
    enhance(ctx.el);
  }
});
