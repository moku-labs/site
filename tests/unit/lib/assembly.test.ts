import { describe, expect, it } from "vitest";
import type { Goal } from "../../../src/data/assembly";
import { appGoal, gameGoal, goals, siteGoal } from "../../../src/data/assembly";
import type { AssemblyState, AssemblyVersions } from "../../../src/lib/assembly";
import {
  addPiece,
  cardNote,
  codeLines,
  fillText,
  finishEdges,
  infoFor,
  initialAssembly,
  joinWords,
  missingNeed,
  trayCardState
} from "../../../src/lib/assembly";

/** Stand-in versions; each differs so a mix-up shows. */
const versions: AssemblyVersions = {
  core: "1.0.1",
  common: "2.0.2",
  web: "3.0.3",
  worker: "4.0.4",
  game: "5.0.5"
};

/**
 * Add pieces one after the other from the start of a goal.
 *
 * @param goal - The goal.
 * @param ids - Piece ids in add order.
 * @returns The state after the last add.
 */
function addAll(goal: Goal, ids: readonly string[]): AssemblyState {
  let state = initialAssembly(goal, versions);
  for (const id of ids) state = addPiece(goal, state, id).state;
  return state;
}

describe("initialAssembly", () => {
  // Bug: a version placeholder leaks into the log, or the standing list loses its "and".
  it("starts with nothing added and the intro lines filled with the installed versions", () => {
    const state = initialAssembly(siteGoal, versions);

    expect(state.placed).toEqual([]);
    expect(state.waiting).toEqual([]);
    expect(state.complete).toBe(false);
    expect(state.log.map(line => line.text)).toEqual([
      "kernel @moku-labs/core 1.0.1 is up.",
      "web 3.0.3 stands on it with site, router, head, spa, log and env.",
      "Field Notes needs content, comments and newsletter."
    ]);
  });
});

describe("addPiece", () => {
  // Bug: a piece whose need is missing is placed anyway, or the wrong card asks to be added next.
  it.each([
    { goal: siteGoal, early: "comments", need: "content", other: "newsletter" },
    { goal: appGoal, early: "tasks", need: "d1", other: "kv" }
  ])("$early before $need waits for $need", ({ goal, early, need, other }) => {
    const { state, steps } = addPiece(goal, initialAssembly(goal, versions), early);

    expect(steps).toEqual([{ kind: "waiting", piece: early, need }]);
    expect(state.waiting).toEqual([early]);
    expect(state.placed).toEqual([]);
    expect(state.log.at(-1)).toEqual({
      kind: "wait",
      text: `${early} needs ${need}. Add ${need} first.`
    });
    expect(trayCardState(goal, state, early)).toBe("waiting");
    expect(trayCardState(goal, state, need)).toBe("next");
    expect(trayCardState(goal, state, other)).toBe("idle");
    expect(cardNote(goal, state, early)).toBe(`Waiting for ${need}`);
    expect(cardNote(goal, state, need)).toBe("Add this next");
    expect(missingNeed(goal, state, early)).toBe(need);
  });

  // Bug: a waiting piece never settles when its need arrives, or settles before the need is in.
  it("settles a waiting piece as soon as its need comes in", () => {
    const waiting = addAll(siteGoal, ["comments"]);
    const { state, steps } = addPiece(siteGoal, waiting, "content");

    expect(steps).toEqual([
      { kind: "placed", piece: "content" },
      { kind: "settled", piece: "comments" }
    ]);
    expect(state.placed).toEqual(["content", "comments"]);
    expect(state.waiting).toEqual([]);
    expect(state.log.slice(-2).map(line => line.text)).toEqual([
      "content is in, on web: Markdown posts in content/posts.",
      "comments settles in, on content: comments under each post."
    ]);
    expect(trayCardState(siteGoal, state, "comments")).toBe("placed");
  });

  // Bug: a second drop of the same piece logs twice or puts it in the code twice; an unknown id
  // throws instead of doing nothing.
  it("does nothing for a piece already in, a waiting piece or an unknown id", () => {
    const state = addAll(siteGoal, ["newsletter", "comments"]);

    for (const id of ["newsletter", "comments", "nope"]) {
      const result = addPiece(siteGoal, state, id);
      expect(result.steps, id).toEqual([]);
      expect(result.state, id).toBe(state);
    }
  });

  // Bug: the app is declared running with a piece missing, or never once all three are in.
  it("completes only when all three pieces are in, and then takes nothing more", () => {
    const two = addAll(appGoal, ["d1", "kv"]);
    expect(two.complete).toBe(false);

    const { state, steps } = addPiece(appGoal, two, "tasks");
    expect(steps).toEqual([{ kind: "placed", piece: "tasks" }, { kind: "complete" }]);
    expect(state.complete).toBe(true);
    expect(state.log.slice(-2)).toEqual([
      { kind: "system", text: "kernel checks every plugin: names unique, every need met." },
      { kind: "win", text: "app.start() → Tracker API is running." }
    ]);
    expect(addPiece(appGoal, state, "kv").state).toBe(state);
  });

  // Bug: a piece whose need stands from the start (board needs flow) is made to wait.
  it("never makes a piece wait for a standing plugin", () => {
    const steps = ["board", "audio", "screen"].flatMap(
      (id, index, ids) => addPiece(gameGoal, addAll(gameGoal, ids.slice(0, index)), id).steps
    );

    expect(steps.filter(step => step.kind === "waiting")).toEqual([]);
    expect(steps.at(-1)).toEqual({ kind: "complete" });
  });
});

describe("codeLines", () => {
  // Bug: the code card ends on other code than the snippet the compile test checks (a lost
  // comma, a piece out of order, a line left out), whatever order the pieces came in.
  it.each(
    goals.map(goal => ({ goal, id: goal.id }))
  )("ends on the final code of $id in any add order", ({ goal }) => {
    const inOrder = goal.pieces.map(piece => piece.id);
    for (const order of [inOrder, inOrder.toReversed()]) {
      const lines = codeLines(goal, addAll(goal, order));
      expect(lines.map(line => line.text)).toEqual(goal.finalCode);
    }
  });

  // Bug: the empty start shows a dangling import of your plugins, or no createApp at all.
  it("starts with createApp and an empty plugin list", () => {
    expect(codeLines(appGoal, initialAssembly(appGoal, versions)).map(line => line.text)).toEqual([
      'import { createApp } from "@moku-labs/worker";',
      "",
      "export const app = createApp({ plugins: [] });"
    ]);
  });

  // Bug: the new-line mark sticks to old lines, misses a changed one, or marks the blank line.
  it("marks the lines the last step changed, settled pieces included", () => {
    const lines = codeLines(siteGoal, addAll(siteGoal, ["comments", "content"]));
    const marked = lines.filter(line => line.isNew).map(line => line.text);

    expect(marked).toEqual([
      'import { createApp, contentPlugin } from "@moku-labs/web";',
      'import { commentsPlugin } from "./plugins";',
      "  plugins: [contentPlugin, commentsPlugin],"
    ]);
  });

  // Bug: the marks of the step before stick when the next piece only starts to wait.
  it("marks nothing after a piece starts to wait", () => {
    const placedOne = addAll(siteGoal, ["newsletter"]);
    const thenWaiting = addPiece(siteGoal, placedOne, "comments").state;

    expect(codeLines(siteGoal, placedOne).some(line => line.isNew)).toBe(true);
    expect(codeLines(siteGoal, thenWaiting).some(line => line.isNew)).toBe(false);
  });
});

describe("cardNote", () => {
  // Bug: an idle card shows the wrong relation (needs vs sits on), or a placed card keeps its need.
  it("tells an idle card what it sits on or needs, and a placed one that it is in", () => {
    const state = addAll(siteGoal, ["newsletter"]);

    expect(cardNote(siteGoal, state, "content")).toBe("Sits on web");
    expect(cardNote(siteGoal, state, "comments")).toBe("Needs content");
    expect(cardNote(siteGoal, state, "newsletter")).toBe("In place");
  });
});

describe("infoFor", () => {
  // Bug: "needed by" is stored and goes stale, or misses the app a tray piece belongs to.
  it("computes who needs a piece from the data, the app included", () => {
    expect(infoFor(siteGoal, "content", versions)?.neededBy).toBe("comments, Field Notes, the app");
    expect(infoFor(siteGoal, "web", versions)?.neededBy).toBe("site, router, head, spa, content");
    expect(infoFor(siteGoal, "newsletter", versions)?.neededBy).toBe("Field Notes, the app");
    expect(infoFor(siteGoal, "head", versions)?.neededBy).toBe("nothing yet");
  });

  // Bug: the kernel and the app card show the generic lists instead of what they are.
  it("describes the kernel as needed by the framework and the app as the top", () => {
    const kernel = infoFor(gameGoal, "core", versions);
    const app = infoFor(gameGoal, "app", versions);

    expect(kernel).toMatchObject({
      name: "kernel",
      source: "@moku-labs/core 1.0.1",
      layer: "kernel",
      needs: "nothing",
      neededBy: "game, every plugin it checks"
    });
    expect(app).toMatchObject({
      name: "TickToe",
      layer: "app",
      needs: "screen, audio, board, and every piece under them",
      neededBy: "nothing, it is the top"
    });
  });

  // Bug: a version placeholder leaks onto the card, or log and env lose their re-export note.
  it("fills the installed versions into where a plugin comes from", () => {
    expect(infoFor(appGoal, "worker", versions)).toMatchObject({
      source: "@moku-labs/worker 4.0.4",
      layer: "framework",
      layerPlace: "Framework, the middle platform",
      needs: "kernel"
    });
    expect(infoFor(appGoal, "log", versions)?.source).toBe(
      "from @moku-labs/common 2.0.2, re-exported by worker"
    );
    expect(infoFor(appGoal, "tasks", versions)?.needs).toBe("d1");
  });

  it("knows nothing of an id outside the goal", () => {
    expect(infoFor(siteGoal, "tasks", versions)).toBeUndefined();
  });
});

describe("finishEdges", () => {
  // Bug: the finish lights the arcs top down, or leaves out the app's arcs to your pieces.
  it("runs from the kernel up to the app, one layer after the other", () => {
    expect(finishEdges(siteGoal)).toEqual([
      { from: "web", to: "core", order: 0 },
      { from: "content", to: "web", order: 1 },
      { from: "comments", to: "content", order: 2 },
      { from: "newsletter", to: "site", order: 2 },
      { from: "app", to: "comments", order: 3 },
      { from: "app", to: "newsletter", order: 3 }
    ]);
  });
});

describe("fillText and joinWords", () => {
  // Bug: a placeholder with no value is blanked out, so a missing value goes unseen.
  it("fills known placeholders and leaves unknown ones visible", () => {
    expect(fillText("{a} and {b}", { a: "x" })).toBe("x and {b}");
  });

  // Bug: two words get a comma, or one word gets a dangling "and".
  it("joins words the way a sentence lists them", () => {
    expect(joinWords(["a"])).toBe("a");
    expect(joinWords(["a", "b"])).toBe("a and b");
    expect(joinWords(["a", "b", "c"])).toBe("a, b and c");
  });
});
