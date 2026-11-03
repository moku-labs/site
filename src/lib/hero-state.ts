/**
 * @file The state of the hero's island as plain data: which goal shows and how, which glyph a
 * flying piece carries, and what a drop shows. Pure and browser-safe: the `kernel-world` island
 * keeps the state and maps it to the DOM.
 */
import type { Goal } from "../data/assembly";
import type { AssemblyResult, AssemblyState, AssemblyVersions } from "./assembly";
import type { GlyphName } from "./glyphs";
import type { HeroData } from "./hero-props";
import type { WorldMotion } from "./hero-view";

/** The part of the island's state that decides what the hero shows. */
export type HeroProgress = {
  /** The hero's props; `undefined` when they are missing. */
  data: HeroData | undefined;
  /** The goal on show. */
  goalId: string;
  /** The progress of every goal, by goal id. */
  progress: ReadonlyMap<string, AssemblyState>;
  /** The finish of the goal on show is playing: the app is checked, not yet running. */
  finishing: boolean;
};

/** The goal on show, its progress as the hero shows it, and the versions. */
export type ShownGoal = {
  /** The goal. */
  goal: Goal;
  /** Its progress; during the finish, the app is not running yet. */
  state: AssemblyState;
  /** The installed versions. */
  versions: AssemblyVersions;
};

/** What a drop shows. */
export type DropShow = {
  /** The finish plays: the arcs light up, then the app rises. */
  finishing: boolean;
  /** The motion the world starts with. */
  motion: WorldMotion;
};

/** The glyph a flying piece carries when its id is not in the goal. */
const FALLBACK_GLYPH: GlyphName = "page";

/**
 * A complete progress as the hero shows it while the finish plays: checked, but not running yet.
 *
 * @param state - The progress.
 * @returns The progress without its closing "running" line and with the app not up; any other
 *   progress as it is.
 * @example
 * ```ts
 * // The last drop completes the app, but the cube rises only at the end of the finish:
 * beforeStart(done).complete; // false
 * ```
 */
export function beforeStart(state: AssemblyState): AssemblyState {
  if (state.log.at(-1)?.kind !== "win") return state;
  return { ...state, complete: false, log: state.log.slice(0, -1) };
}

/**
 * The goal on show and its progress as the hero shows it.
 *
 * @param hero - The island's state.
 * @returns What the hero shows, or `undefined` without props or for an unknown goal.
 * @example
 * ```ts
 * // In the island, before each paint:
 * const view = shownGoal(ctx.state);
 * view?.goal.id; // "site"
 * ```
 */
export function shownGoal(hero: HeroProgress): ShownGoal | undefined {
  const goal = hero.data?.goals.find(entry => entry.id === hero.goalId);
  const progress = hero.progress.get(hero.goalId);
  if (hero.data === undefined || goal === undefined || progress === undefined) return undefined;
  const state = hero.finishing ? beforeStart(progress) : progress;
  return { goal, state, versions: hero.data.versions };
}

/**
 * The glyph of a piece of a goal, for the flyer.
 *
 * @param goal - The goal on show, if any.
 * @param id - The piece.
 * @returns Its glyph; the page glyph for an unknown piece.
 * @example
 * ```ts
 * pieceGlyph(siteGoal, "comments"); // "comments"
 * ```
 */
export function pieceGlyph(goal: Goal | undefined, id: string): GlyphName {
  return goal?.pieces.find(piece => piece.id === id)?.glyph ?? FALLBACK_GLYPH;
}

/**
 * What a drop shows: the dropped piece snaps in, the pieces that waited for it slide down, the
 * kernel flashes, and the last piece starts the finish. Under reduced motion all of it is
 * instant: no motion and no finish to play.
 *
 * @param id - The dropped piece.
 * @param result - What the rules made of the drop.
 * @param instant - The visitor asked for less motion.
 * @returns Whether the finish plays, and the motion the world starts with.
 * @example
 * ```ts
 * // content arrives after comments waited for it:
 * dropShow("content", addPiece(siteGoal, waiting, "content"), false).motion;
 * // { landed: ["content"], settled: ["comments"], flash: true }
 * ```
 */
export function dropShow(id: string, result: AssemblyResult, instant: boolean): DropShow {
  const complete = result.steps.some(step => step.kind === "complete");
  if (instant) return { finishing: false, motion: {} };
  const settled = result.steps.flatMap(step => (step.kind === "settled" ? [step.piece] : []));
  return { finishing: complete, motion: { landed: [id], settled, flash: true } };
}
