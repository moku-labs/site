/**
 * @file The hero's assembly as a pure state machine: what a dropped piece does (lands, waits,
 * settles, completes the app), the code card of a state, the tray card of a piece and the info
 * card of any cube.
 *
 * DOM-free and browser-safe. The SSR first paint and the `kernel-world` island run the same
 * rules on the plain data of `src/data/assembly.ts`; the island only maps the steps to motion.
 */
import type { AssemblyGlyph, CodeLine, FrameworkId, Goal, LayerId } from "../data/assembly";
import { assemblyText, kernelItem, layers } from "../data/assembly";

/** The installed versions the hero shows: the kernel, common and the three frameworks. */
export type AssemblyVersions = Readonly<Record<"core" | "common" | FrameworkId, string>>;

/** Kind of a kernel.log line; drives its marker and colour. */
export type LogKind = "system" | "ok" | "wait" | "win";

/** One kernel.log line. */
export type LogLine = {
  /** Line kind. */
  kind: LogKind;
  /** The line, in plain words. */
  text: string;
};

/** The progress of one goal. */
export type AssemblyState = {
  /** Pieces in place, in the order they went in. */
  placed: readonly string[];
  /** Pieces hovering over their socket until their need is in. */
  waiting: readonly string[];
  /** Every piece is in and the app runs. */
  complete: boolean;
  /** Every log line so far. */
  log: readonly LogLine[];
  /** The pieces the last step put in place; their code lines carry the new-line mark. */
  justPlaced: readonly string[];
};

/** One thing a drop caused, in the order it happened. */
export type AssemblyStep =
  | {
      /** The piece landed in its socket. */
      kind: "placed";
      /** Piece id. */
      piece: string;
    }
  | {
      /** The piece hovers over its socket: its need is not in yet. */
      kind: "waiting";
      /** Piece id. */
      piece: string;
      /** The piece it waits for. */
      need: string;
    }
  | {
      /** A waiting piece whose need just came in settled into its socket. */
      kind: "settled";
      /** Piece id. */
      piece: string;
    }
  | {
      /** The last piece is in: the kernel checks the list and the app starts. */
      kind: "complete";
    };

/** What {@link addPiece} returns. */
export type AssemblyResult = {
  /** The next state; the same object when the drop did nothing. */
  state: AssemblyState;
  /** What the drop caused; empty when it did nothing. */
  steps: readonly AssemblyStep[];
};

/** One line of the code card. */
export type CodeCardLine = {
  /** The code text. */
  text: string;
  /** The last step changed this line: it carries the new-line mark. */
  isNew: boolean;
};

/** How a tray card looks. */
export type TrayCardState = "idle" | "next" | "waiting" | "placed";

/** What an item of the world is. */
export type ItemRole = "kernel" | "framework" | "standing" | "piece" | "app";

/** What the info card shows for an item. */
export type ItemInfo = {
  /** Item id. */
  id: string;
  /** What it is. */
  role: ItemRole;
  /** Its name. */
  name: string;
  /** Glyph on its cube. */
  glyph: AssemblyGlyph;
  /** Where it comes from, versions filled in. */
  source: string;
  /** What it does. */
  does: string;
  /** Its layer. */
  layer: LayerId;
  /** Where its layer is, e.g. `Framework, the middle platform`. */
  layerPlace: string;
  /** What it needs, as a list in words. */
  needs: string;
  /** Who needs it, as a list in words. */
  neededBy: string;
};

/** A needs edge the finish lights up, from the piece that needs to what it needs. */
export type NeedEdge = {
  /** The item that needs. */
  from: string;
  /** The item it needs. */
  to: string;
  /** When it lights: the kernel's edge first, the app's last. */
  order: number;
};

/** Id of the kernel in every goal. */
export const KERNEL_ID = "core";

/** Id of the app cube in every goal. */
export const APP_ID = "app";

/** An item of a goal, read the same way whatever kind it is. */
type GoalItem = {
  /** Item id. */
  id: string;
  /** What it is. */
  role: ItemRole;
  /** Its name. */
  name: string;
  /** Glyph on its cube. */
  glyph: AssemblyGlyph;
  /** What it does. */
  does: string;
  /** Where it comes from, with version placeholders. */
  source: string;
  /** Its layer. */
  layer: LayerId;
  /** The ids it needs. */
  needs: readonly string[];
};

/** Order of the finish edges, by the layer of the piece that needs. */
const FINISH_ORDER: Readonly<Record<LayerId, number>> = { kernel: 0, framework: 1, app: 2 };

/** Order of the app's own finish edges: after every layer. */
const APP_FINISH_ORDER = 3;

/**
 * Fill the `{name}` placeholders of a text. A placeholder with no value stays as it is, so a
 * missing value shows instead of vanishing.
 *
 * @param template - The text, e.g. `Pieces for {app}`.
 * @param values - Value per placeholder name.
 * @returns The filled text.
 * @example
 * ```ts
 * fillText(assemblyText.trayHeading, { app: "Field Notes" }); // "Pieces for Field Notes"
 * ```
 */
export function fillText(template: string, values: Readonly<Record<string, string>>): string {
  return template.replaceAll(/\{(\w+)\}/g, (placeholder, name: string) => {
    return values[name] ?? placeholder;
  });
}

/**
 * Join words the way a sentence lists them: `a`, `a and b`, `a, b and c`.
 *
 * @param words - The words in order.
 * @returns The list in words.
 * @example
 * ```ts
 * joinWords(["content", "comments", "newsletter"]); // "content, comments and newsletter"
 * ```
 */
export function joinWords(words: readonly string[]): string {
  const last = words.at(-1);
  if (words.length < 2 || last === undefined) return words.join("");
  return `${words.slice(0, -1).join(", ")} ${assemblyText.and} ${last}`;
}

/**
 * The item with an id: the kernel, the framework, a standing plugin, a piece or the app.
 *
 * @param goal - The goal.
 * @param id - Item id.
 * @returns The item, or `undefined` for an id outside the goal.
 */
function itemOf(goal: Goal, id: string): GoalItem | undefined {
  if (id === KERNEL_ID) {
    return {
      id,
      role: "kernel",
      glyph: "kernel",
      layer: "kernel",
      needs: [],
      ...kernelItem
    };
  }
  if (id === APP_ID) {
    const pieceIds = goal.pieces.map(piece => piece.id);
    return { id, role: "app", layer: "app", needs: pieceIds, ...goal.app };
  }
  if (id === goal.framework.id) {
    return {
      role: "framework",
      name: id,
      layer: "framework",
      needs: [KERNEL_ID],
      ...goal.framework
    };
  }
  const standing = goal.standing.find(entry => entry.id === id);
  if (standing !== undefined) {
    return { ...standing, role: "standing", name: id, layer: "framework", needs: [standing.needs] };
  }
  const piece = goal.pieces.find(entry => entry.id === id);
  if (piece === undefined) return undefined;
  return { ...piece, role: "piece", name: id, needs: [piece.needs ?? piece.sitsOn] };
}

/**
 * The name of an item: `kernel` for the core, the app's name for the app, its id otherwise.
 *
 * @param goal - The goal.
 * @param id - Item id.
 * @returns The name.
 * @example
 * ```ts
 * nameOf(siteGoal, "app"); // "Field Notes"
 * nameOf(siteGoal, "core"); // "kernel"
 * ```
 */
export function nameOf(goal: Goal, id: string): string {
  return itemOf(goal, id)?.name ?? id;
}

/**
 * What an item needs: the kernel for the framework, the framework (or the kernel) for a standing
 * plugin, a piece's need or what it sits on, every piece for the app.
 *
 * @param goal - The goal.
 * @param id - Item id.
 * @returns The ids it needs; none for the kernel or an unknown id.
 * @example
 * ```ts
 * // The selected cube shows an arc to each of these:
 * needsOf(siteGoal, "comments"); // ["content"]
 * ```
 */
export function needsOf(goal: Goal, id: string): readonly string[] {
  return itemOf(goal, id)?.needs ?? [];
}

/**
 * Whether an item is in the world: the kernel, the framework and the standing plugins always are,
 * a piece once placed, the app once complete.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @param id - Item id.
 * @returns `true` when it stands in the world.
 * @example
 * ```ts
 * // A needs arc is drawn only to what is in:
 * isIn(siteGoal, initialAssembly(siteGoal, versions), "site"); // true
 * ```
 */
export function isIn(goal: Goal, state: AssemblyState, id: string): boolean {
  if (id === APP_ID) return state.complete;
  if (goal.pieces.some(piece => piece.id === id)) return state.placed.includes(id);
  return itemOf(goal, id) !== undefined;
}

/**
 * The need a piece waits for: its `needs` while that is not in.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @param pieceId - Piece id.
 * @returns The missing need, or `undefined` when nothing is missing.
 * @example
 * ```ts
 * // The waiting callout: "comments needs content"
 * missingNeed(siteGoal, state, "comments"); // "content" until content is in
 * ```
 */
export function missingNeed(goal: Goal, state: AssemblyState, pieceId: string): string | undefined {
  const need = goal.pieces.find(piece => piece.id === pieceId)?.needs;
  return need === undefined || isIn(goal, state, need) ? undefined : need;
}

/**
 * The start of a goal: nothing added, the kernel, the framework and its standing plugins in place,
 * and the log's intro lines.
 *
 * @param goal - The goal.
 * @param versions - The installed versions.
 * @returns A fresh state.
 * @example
 * ```ts
 * // The first paint and Start over:
 * const state = initialAssembly(siteGoal, versions);
 * state.log[0]?.text; // "kernel @moku-labs/core 1.7.6 is up."
 * ```
 */
export function initialAssembly(goal: Goal, versions: AssemblyVersions): AssemblyState {
  const { log } = assemblyText;
  const intro = [
    fillText(log.kernelUp, { core: versions.core }),
    fillText(log.frameworkUp, {
      framework: goal.framework.id,
      version: versions[goal.framework.id],
      standing: joinWords(goal.standing.map(plugin => plugin.id))
    }),
    fillText(log.appNeeds, {
      app: goal.app.name,
      pieces: joinWords(goal.pieces.map(piece => piece.id))
    })
  ];
  return {
    placed: [],
    waiting: [],
    complete: false,
    log: intro.map(text => ({ kind: "system", text })),
    justPlaced: []
  };
}

/**
 * The log line of a piece that went in or settled.
 *
 * @param goal - The goal.
 * @param pieceId - Piece id.
 * @param template - `log.placed` or `log.settled`.
 * @returns The line.
 */
function inLine(goal: Goal, pieceId: string, template: string): LogLine {
  const piece = goal.pieces.find(entry => entry.id === pieceId);
  const on = nameOf(goal, piece?.needs ?? piece?.sitsOn ?? "");
  return {
    kind: "ok",
    text: fillText(template, { piece: pieceId, on, gives: piece?.gives ?? "" })
  };
}

/**
 * Move the waiting pieces whose need is in now into place, one after the other, so a chain of
 * waits settles in order.
 *
 * @param goal - The goal.
 * @param state - The state right after a piece went in.
 * @returns The state with the settled pieces placed, and their ids.
 */
function settleWaiting(
  goal: Goal,
  state: AssemblyState
): { state: AssemblyState; settled: string[] } {
  let current = state;
  const settled: string[] = [];
  let ready = current.waiting.find(id => missingNeed(goal, current, id) === undefined);
  while (ready !== undefined) {
    const id = ready;
    current = {
      ...current,
      placed: [...current.placed, id],
      waiting: current.waiting.filter(other => other !== id),
      log: [...current.log, inLine(goal, id, assemblyText.log.settled)]
    };
    settled.push(id);
    ready = current.waiting.find(other => missingNeed(goal, current, other) === undefined);
  }
  return { state: current, settled };
}

/**
 * Put a piece whose needs are met in place, settle what waited for it, and start the app when it
 * was the last.
 *
 * @param goal - The goal.
 * @param state - The current state.
 * @param pieceId - The piece.
 * @returns The next state and its steps.
 */
function placePiece(goal: Goal, state: AssemblyState, pieceId: string): AssemblyResult {
  // The piece goes in, and every piece that waited for it settles, in order.
  const landed: AssemblyState = {
    ...state,
    placed: [...state.placed, pieceId],
    log: [...state.log, inLine(goal, pieceId, assemblyText.log.placed)]
  };
  const { state: settledState, settled } = settleWaiting(goal, landed);
  const steps: AssemblyStep[] = [
    { kind: "placed", piece: pieceId },
    ...settled.map((id): AssemblyStep => ({ kind: "settled", piece: id }))
  ];
  const next: AssemblyState = { ...settledState, justPlaced: [pieceId, ...settled] };

  // Not the last piece: the app waits for the rest.
  const allIn = goal.pieces.every(piece => next.placed.includes(piece.id));
  if (!allIn) return { state: next, steps };

  // The last piece: the kernel checks every plugin, then the app starts.
  const { log } = assemblyText;
  const finished: LogLine[] = [
    { kind: "system", text: log.check },
    { kind: "win", text: fillText(log.running, { app: goal.app.name }) }
  ];
  return {
    state: { ...next, complete: true, log: [...next.log, ...finished] },
    steps: [...steps, { kind: "complete" }]
  };
}

/**
 * Drop a piece on the kernel. It lands when its need is in, and settles the pieces that waited
 * for it; otherwise it waits. A piece already in or waiting, an unknown id or a finished app
 * changes nothing: never an error.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @param pieceId - The dropped piece.
 * @returns The next state and the steps the drop caused.
 * @example
 * ```ts
 * // comments before content waits, then content settles it:
 * const first = addPiece(siteGoal, initialAssembly(siteGoal, versions), "comments");
 * first.steps; // [{ kind: "waiting", piece: "comments", need: "content" }]
 * addPiece(siteGoal, first.state, "content").steps;
 * // [{ kind: "placed", piece: "content" }, { kind: "settled", piece: "comments" }]
 * ```
 */
export function addPiece(goal: Goal, state: AssemblyState, pieceId: string): AssemblyResult {
  const known = goal.pieces.some(piece => piece.id === pieceId);
  const added = state.placed.includes(pieceId) || state.waiting.includes(pieceId);
  if (!known || added || state.complete) return { state, steps: [] };

  const need = missingNeed(goal, state, pieceId);
  if (need === undefined) return placePiece(goal, state, pieceId);
  const text = fillText(assemblyText.log.waiting, { piece: pieceId, need: nameOf(goal, need) });
  return {
    state: {
      ...state,
      waiting: [...state.waiting, pieceId],
      log: [...state.log, { kind: "wait", text }],
      justPlaced: []
    },
    steps: [{ kind: "waiting", piece: pieceId, need }]
  };
}

/**
 * One line of the code template with the pieces that are in.
 *
 * @param codeLine - The template line.
 * @param placed - Pieces in place.
 * @returns The line, or nothing when the line is not there yet.
 */
function renderLine(codeLine: CodeLine, placed: ReadonlySet<string>): string[] {
  if ("line" in codeLine) {
    return codeLine.piece === undefined || placed.has(codeLine.piece) ? [codeLine.line] : [];
  }
  const items = codeLine.items.filter(item => item.piece === undefined || placed.has(item.piece));
  if (codeLine.hideEmpty === true && items.length === 0) return [];
  return [`${codeLine.before}${items.map(item => item.text).join(", ")}${codeLine.after}`];
}

/**
 * The code of a goal with some pieces in.
 *
 * @param goal - The goal.
 * @param placed - Pieces in place.
 * @returns The lines.
 */
function renderCode(goal: Goal, placed: readonly string[]): string[] {
  const placedSet = new Set(placed);
  return goal.code.flatMap(codeLine => renderLine(codeLine, placedSet));
}

/**
 * The code card for a state: the real `createApp` call with the pieces in place. A line the last
 * step added or changed is marked new; once every piece is in, it equals the goal's final code.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @returns The lines, top to bottom.
 * @example
 * ```ts
 * // After content went in, the import and the plugin list carry the mark:
 * codeLines(siteGoal, state).filter(line => line.isNew).map(line => line.text);
 * // ['import { createApp, contentPlugin } from "@moku-labs/web";', "  plugins: [contentPlugin],"]
 * ```
 */
export function codeLines(goal: Goal, state: AssemblyState): CodeCardLine[] {
  const before = new Set(
    renderCode(
      goal,
      state.placed.filter(id => !state.justPlaced.includes(id))
    )
  );
  return renderCode(goal, state.placed).map(text => ({
    text,
    isNew: text !== "" && !before.has(text)
  }));
}

/**
 * How a tray card looks: placed, waiting, `next` when a waiting piece needs it, idle otherwise.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @param pieceId - The card's piece.
 * @returns The card state.
 * @example
 * ```ts
 * // comments waits for content, so the content card asks to be added next:
 * trayCardState(siteGoal, state, "content"); // "next"
 * ```
 */
export function trayCardState(goal: Goal, state: AssemblyState, pieceId: string): TrayCardState {
  if (state.placed.includes(pieceId)) return "placed";
  if (state.waiting.includes(pieceId)) return "waiting";
  const wanted = state.waiting.some(id => missingNeed(goal, state, id) === pieceId);
  return wanted ? "next" : "idle";
}

/**
 * The line under a tray card's name: what it sits on or needs, `Add this next`, what it waits for,
 * or that it is in.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @param pieceId - The card's piece.
 * @returns The line; empty for an unknown piece.
 * @example
 * ```ts
 * cardNote(siteGoal, initialAssembly(siteGoal, versions), "comments"); // "Needs content"
 * ```
 */
export function cardNote(goal: Goal, state: AssemblyState, pieceId: string): string {
  const piece = goal.pieces.find(entry => entry.id === pieceId);
  if (piece === undefined) return "";
  const { card } = assemblyText;
  const cardState = trayCardState(goal, state, pieceId);
  if (cardState === "placed") return card.placed;
  if (cardState === "next") return card.next;
  if (cardState === "waiting") {
    return fillText(card.waiting, { need: nameOf(goal, missingNeed(goal, state, pieceId) ?? "") });
  }
  return piece.needs === undefined
    ? fillText(card.sitsOn, { target: nameOf(goal, piece.sitsOn) })
    : fillText(card.needs, { need: nameOf(goal, piece.needs) });
}

/**
 * Who needs an item, in words: the framework and every plugin for the kernel, the top for the
 * app, otherwise every item that needs it and, for a tray piece, the app.
 *
 * @param goal - The goal.
 * @param item - The item.
 * @returns The list in words.
 */
function neededByText(goal: Goal, item: GoalItem): string {
  const { info } = assemblyText;
  if (item.role === "kernel") return [goal.framework.id, info.everyPlugin].join(", ");
  if (item.role === "app") return info.top;
  const items = [goal.framework, ...goal.standing, ...goal.pieces];
  const users = items
    .filter(other => needsOf(goal, other.id).includes(item.id))
    .map(other => other.id);
  if (item.role === "piece") users.push(fillText(info.theApp, { app: goal.app.name }));
  return users.length > 0 ? users.join(", ") : info.nothingYet;
}

/**
 * What the info card shows for any cube, socket or chip: name, where it comes from, what it does,
 * its layer, what it needs and who needs it. "Needed by" is computed from the data.
 *
 * @param goal - The goal.
 * @param id - Item id: `core`, `app`, the framework, a standing plugin or a piece.
 * @param versions - The installed versions.
 * @returns The card, or `undefined` for an id outside the goal.
 * @example
 * ```ts
 * infoFor(siteGoal, "content", versions)?.neededBy; // "comments, Field Notes, the app"
 * ```
 */
export function infoFor(goal: Goal, id: string, versions: AssemblyVersions): ItemInfo | undefined {
  const item = itemOf(goal, id);
  if (item === undefined) return undefined;
  const { info } = assemblyText;
  const needNames = item.needs.map(need => nameOf(goal, need));
  const needs =
    item.role === "app" ? [...needNames, info.everyPieceUnder].join(", ") : needNames.join(", ");
  return {
    id,
    role: item.role,
    name: item.name,
    glyph: item.glyph,
    source: fillText(item.source, {
      core: versions.core,
      common: versions.common,
      version: versions[goal.framework.id]
    }),
    does: item.does,
    layer: item.layer,
    layerPlace: layers.find(layer => layer.id === item.layer)?.place ?? "",
    needs: needs === "" ? info.nothing : needs,
    neededBy: neededByText(goal, item)
  };
}

/**
 * The needs edges the finish lights, bottom to top: the framework on the kernel, each piece on
 * what it needs, then the app on your own pieces.
 *
 * @param goal - The goal.
 * @returns The edges in lighting order.
 * @example
 * ```ts
 * finishEdges(siteGoal)[0]; // { from: "web", to: "core", order: 0 }
 * ```
 */
export function finishEdges(goal: Goal): NeedEdge[] {
  const pieceEdges = goal.pieces.flatMap(piece =>
    needsOf(goal, piece.id).map(need => ({
      from: piece.id,
      to: need,
      order: FINISH_ORDER[piece.layer]
    }))
  );
  const appEdges = goal.pieces
    .filter(piece => piece.layer === "app")
    .map(piece => ({ from: APP_ID, to: piece.id, order: APP_FINISH_ORDER }));
  return [
    { from: goal.framework.id, to: KERNEL_ID, order: FINISH_ORDER.kernel },
    ...pieceEdges,
    ...appEdges
  ];
}
