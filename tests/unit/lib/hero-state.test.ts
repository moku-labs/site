import { describe, expect, it } from "vitest";
import type { Goal } from "../../../src/data/assembly";
import { appGoal, goals, siteGoal } from "../../../src/data/assembly";
import type { AssemblyState, AssemblyVersions } from "../../../src/lib/assembly";
import { addPiece, initialAssembly } from "../../../src/lib/assembly";
import type { HeroProgress } from "../../../src/lib/hero-state";
import { beforeStart, dropShow, pieceGlyph, shownGoal } from "../../../src/lib/hero-state";

const versions: AssemblyVersions = {
  core: "1.0.1",
  common: "2.0.2",
  web: "3.0.3",
  worker: "4.0.4",
  game: "5.0.5"
};

/**
 * A goal's progress after the given drops, in order.
 *
 * @param goal - The goal.
 * @param ids - The pieces dropped.
 * @returns The state after the last drop.
 */
function progressAfter(goal: Goal, ...ids: string[]): AssemblyState {
  let state = initialAssembly(goal, versions);
  for (const id of ids) state = addPiece(goal, state, id).state;
  return state;
}

const appDone = progressAfter(appGoal, "d1", "kv", "tasks");

/** The island on the App goal, which is complete; the Site goal at its start. */
const hero: HeroProgress = {
  data: { goals, versions },
  goalId: "app",
  progress: new Map([
    ["site", initialAssembly(siteGoal, versions)],
    ["app", appDone]
  ]),
  finishing: false
};

describe("beforeStart", () => {
  // Bug: the app shows as running, with its strip and its "running" line, before its cube rises.
  it("holds back the running app and its last line while the finish plays", () => {
    const shown = beforeStart(appDone);

    expect(shown.complete).toBe(false);
    expect(shown.log).toEqual(appDone.log.slice(0, -1));
    expect(shown.log.at(-1)?.text).toBe(
      "kernel checks every plugin: names unique, every need met."
    );
  });

  // Bug: a progress mid-way loses its newest log line.
  it("leaves a progress that is not complete as it is", () => {
    const waiting = progressAfter(siteGoal, "comments");

    expect(beforeStart(waiting)).toBe(waiting);
  });
});

describe("shownGoal", () => {
  // Bug: a switch shows another goal's progress, or the finish shows the app before it rises.
  it("shows the goal on show with its own progress, held back while the finish plays", () => {
    expect(shownGoal(hero)?.goal.id).toBe("app");
    expect(shownGoal(hero)?.state).toBe(appDone);
    expect(shownGoal(hero)?.versions).toBe(versions);
    expect(shownGoal({ ...hero, finishing: true })?.state.complete).toBe(false);
    expect(shownGoal({ ...hero, goalId: "site" })?.state.placed).toEqual([]);
  });

  // Bug: the island paints from missing props or an unknown goal and throws.
  it("shows nothing without props or for a goal it does not know", () => {
    expect(shownGoal({ ...hero, data: undefined })).toBeUndefined();
    expect(shownGoal({ ...hero, goalId: "nope" })).toBeUndefined();
  });
});

describe("pieceGlyph", () => {
  // Bug: the flyer carries another piece's glyph, or an empty cube for an unknown id.
  it("gives the piece's own glyph, and the page glyph for an unknown piece", () => {
    expect(pieceGlyph(siteGoal, "newsletter")).toBe("mail");
    expect(pieceGlyph(siteGoal, "nope")).toBe("page");
    expect(pieceGlyph(undefined, "content")).toBe("page");
  });
});

describe("dropShow", () => {
  // Bug: a piece whose need just came in snaps like a new drop, or the kernel does not flash.
  it("snaps the dropped piece, slides down what waited for it and flashes the kernel", () => {
    const result = addPiece(siteGoal, progressAfter(siteGoal, "comments"), "content");

    expect(dropShow("content", result, false)).toEqual({
      finishing: false,
      motion: { landed: ["content"], settled: ["comments"], flash: true }
    });
  });

  // Bug: the last piece does not start the finish, so the app never rises.
  it("starts the finish on the last piece", () => {
    const result = addPiece(siteGoal, progressAfter(siteGoal, "content", "comments"), "newsletter");

    expect(dropShow("newsletter", result, false).finishing).toBe(true);
  });

  // Bug: reduced motion still plays the finish or a snap.
  it("shows every drop at once under reduced motion", () => {
    const result = addPiece(siteGoal, progressAfter(siteGoal, "content", "comments"), "newsletter");

    expect(dropShow("newsletter", result, true)).toEqual({ finishing: false, motion: {} });
  });
});
