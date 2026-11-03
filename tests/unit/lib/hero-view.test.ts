import { describe, expect, it } from "vitest";
import type { Goal } from "../../../src/data/assembly";
import { appGoal, gameGoal, goals, siteGoal } from "../../../src/data/assembly";
import type { AssemblyState, AssemblyVersions } from "../../../src/lib/assembly";
import { addPiece, finishEdges, initialAssembly } from "../../../src/lib/assembly";
import type { SvgChild, SvgNode, WorldView } from "../../../src/lib/hero-view";
import {
  heroPanel,
  highlightCode,
  infoCard,
  itemLabel,
  platformNodes,
  worldScene
} from "../../../src/lib/hero-view";

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

/**
 * The motion a cube starts with: the `data-motion` of its wrapper.
 *
 * @param scene - The drawing.
 * @param id - The cube's item id.
 * @returns The motion, if any.
 */
function motionOf(scene: readonly SvgChild[], id: string): unknown {
  const [wrapper] = having(scene, "data-item", id).flatMap(cube => allNodes(cube.children));
  return wrapper?.attributes["data-motion"];
}

/**
 * Every element node of a drawing, depth first.
 *
 * @param children - The top nodes.
 * @returns The nodes.
 */
function allNodes(children: readonly SvgChild[]): SvgNode[] {
  return children.flatMap(child =>
    typeof child === "string" ? [] : [child, ...allNodes(child.children)]
  );
}

/**
 * The nodes that carry an attribute, optionally with a value.
 *
 * @param scene - The drawing.
 * @param name - Attribute name.
 * @param value - Its value; any value when left out.
 * @returns The matching nodes.
 */
function having(scene: readonly SvgChild[], name: string, value?: string): SvgNode[] {
  return allNodes(scene).filter(node =>
    value === undefined ? node.attributes[name] !== undefined : node.attributes[name] === value
  );
}

/**
 * The text inside a node.
 *
 * @param node - The node.
 * @returns Its text runs joined.
 */
function textOf(node: SvgChild): string {
  return typeof node === "string" ? node : node.children.map(child => textOf(child)).join("");
}

/**
 * The values of an attribute over the nodes that carry it.
 *
 * @param scene - The drawing.
 * @param name - Attribute name.
 * @returns The values, in drawing order.
 */
function values(scene: readonly SvgChild[], name: string): string[] {
  return having(scene, name).map(node => String(node.attributes[name]));
}

/**
 * A drawing of a goal.
 *
 * @param goal - The goal.
 * @param state - Its progress.
 * @param extra - Selection and motion.
 * @returns The scene.
 */
function draw(goal: Goal, state: AssemblyState, extra: Partial<WorldView> = {}): SvgNode[] {
  return worldScene({ goal, state, versions, ...extra });
}

/**
 * The versions a goal's world shows: the kernel's sign, then the bracket versions.
 *
 * @param goal - The goal.
 * @returns The texts.
 */
function signs(goal: Goal): string[] {
  const scene = draw(goal, initialAssembly(goal, versions));
  const texts = [
    ...having(scene, "data-part", "sign"),
    ...having(scene, "data-part", "bracket-version")
  ];
  return texts.map(node => textOf(node));
}

describe("worldScene", () => {
  // Bug: the first paint misses a socket, draws a piece before it is added, or shows arcs at rest,
  // so the page without JS does not explain the idea.
  it("first paints the kernel, the framework, its standing plugins and every empty socket", () => {
    const scene = draw(siteGoal, initialAssembly(siteGoal, versions), { motion: { intro: true } });

    expect(values(scene, "data-item").toSorted()).toEqual(
      ["core", "web", "site", "router", "head", "spa", "log", "env"].toSorted()
    );
    expect(values(scene, "data-socket")).toEqual(["content", "comments", "newsletter", "app"]);
    expect(having(scene, "data-arc")).toEqual([]);
    expect(having(scene, "data-motion", "intro")).toHaveLength(8);
  });

  // Bug: a waiting piece is drawn in its socket or without the arc to what it needs, so a wait
  // reads like a failure.
  it("lifts a waiting piece, points an amber arc at its need and shows the callout", () => {
    const scene = draw(siteGoal, progressAfter(siteGoal, "comments"));
    const [comments] = having(scene, "data-item", "comments");
    const hover = allNodes(comments?.children ?? []).find(
      node => node.attributes["data-part"] === "hover"
    );
    const callouts = having(scene, "data-callout", "waiting").map(node => textOf(node));

    expect(comments?.attributes["data-waiting"]).toBe("");
    expect(hover?.attributes.transform).toBe("translate(0 -20)");
    expect(values(scene, "data-arc")).toEqual(["wait"]);
    expect(having(scene, "data-wanted").map(node => node.attributes["data-socket"])).toEqual([
      "content"
    ]);
    expect(callouts).toEqual(["comments needs content", "comments needs content"]);
  });

  // Bug: the selected cube draws no arcs, or draws an arc to a piece that is not in yet.
  it("draws the selected cube's arcs to the needs that are in, none for a piece not in", () => {
    const state = progressAfter(siteGoal, "content", "comments");

    expect(values(draw(siteGoal, state, { selected: "comments" }), "data-arc")).toEqual(["need"]);
    expect(values(draw(siteGoal, state, { selected: "app" }), "data-arc")).toEqual([
      "need",
      "need"
    ]);
    expect(having(draw(siteGoal, state, { selected: "newsletter" }), "data-arc")).toEqual([]);
    expect(having(draw(siteGoal, state), "data-arc")).toEqual([]);
  });

  // Bug: the finish lights the arcs all at once or top down, not bottom to top.
  it("lights one arc per needs edge in the finish, in the order of the check", () => {
    const scene = draw(siteGoal, progressAfter(siteGoal, "content", "comments"), {
      motion: { pulse: true }
    });
    const orders = values(scene, "style")
      .filter(style => style.startsWith("--t:"))
      .map(style => Number(/--t:(\d+)/.exec(style)?.[1]));

    expect(orders).toEqual(finishEdges(siteGoal).map(edge => edge.order));
    expect(having(scene, "data-part", "spark")).toHaveLength(orders.length);
  });

  // Bug: the app cube never rises, or rises while its socket and ghost name stay behind.
  it("stands the risen app cube in its socket with the completion strip once all is in", () => {
    const state = progressAfter(siteGoal, "content", "comments", "newsletter");
    const scene = draw(siteGoal, state, { motion: { rise: true } });
    const strips = having(scene, "data-callout", "running");

    expect(motionOf(scene, "app")).toBe("rise");
    expect(values(scene, "data-socket")).toEqual([]);
    expect(strips.map(node => textOf(node))).toContain(
      "Field Notes is running. Every need is met."
    );
    expect(strips[0]?.attributes["data-motion"]).toBe("late");
  });

  // Bug: a piece whose need just came in snaps like a new drop instead of sliding down.
  it("slides a settled piece down and snaps the piece just dropped", () => {
    const scene = draw(siteGoal, progressAfter(siteGoal, "comments", "content"), {
      motion: { landed: ["content"], settled: ["comments"], flash: true }
    });
    expect(motionOf(scene, "content")).toBe("snap");
    expect(motionOf(scene, "comments")).toBe("settle");
    expect(having(scene, "data-item", "core")[0]?.attributes["data-flash"]).toBe("");
  });

  // Bug: a version on the world is typed instead of the installed one (D1).
  it("shows the installed kernel and framework versions", () => {
    expect(signs(siteGoal)).toEqual(["core 1.0.1", "web 3.0.3", "core 1.0.1"]);
    expect(signs(appGoal)).toContain("worker 4.0.4");
    expect(signs(gameGoal)).toContain("game 5.0.5");
  });
});

describe("platformNodes", () => {
  // Bug: a raised cell takes the other ring's colour, so the layers stop reading at a glance.
  it("draws the framework's middle ring and your app's outer ring in their own shades", () => {
    const scene = platformNodes();

    expect(having(scene, "data-shade", "framework-ring")).toHaveLength(28);
    expect(having(scene, "data-shade", "app-ring")).toHaveLength(36);
  });
});

describe("heroPanel", () => {
  // Bug: the start tray asks for the wrong app, or the chips miss the framework.
  it("shows the start of a goal: its pieces, its standing chips and the intro log", () => {
    const panel = heroPanel(siteGoal, initialAssembly(siteGoal, versions), versions);

    expect(panel.heading).toBe("Pieces for Field Notes");
    expect(panel.hint).toBe("tap a card, or drag it onto the kernel");
    expect(panel.cards.map(card => card.note)).toEqual([
      "Sits on web",
      "Needs content",
      "Needs site"
    ]);
    expect(panel.chips.map(chip => chip.id)).toEqual([
      "web",
      "site",
      "router",
      "head",
      "spa",
      "log",
      "env"
    ]);
    expect(panel.standingLead).toBe("Already standing, from web and @moku-labs/common:");
    expect(panel.log.map(line => line.kind)).toEqual(["system", "system", "system"]);
    expect(panel.verdict?.text).toBe("Field Notes needs content, comments and newsletter.");
  });

  // Bug: the needed card does not ask to be added next, or a waiting card still says "Add".
  it("asks for the needed piece next and names the waiting card for its details", () => {
    const panel = heroPanel(siteGoal, progressAfter(siteGoal, "comments"), versions);
    const [content, comments] = panel.cards;

    expect(content?.state).toBe("next");
    expect(content?.label).toBe("content. Add this next. Add to the app");
    expect(comments?.state).toBe("waiting");
    expect(comments?.label).toBe("comments. Waiting for content. Show details");
    expect(panel.verdict).toEqual({
      kind: "wait",
      text: "comments needs content. Add content first."
    });
  });

  // Bug: the finished hero still asks for pieces, or its code is not the frozen final code.
  it("shows a finished goal: try another app, every card in place, the final code", () => {
    for (const goal of goals) {
      const state = progressAfter(goal, ...goal.pieces.map(piece => piece.id));
      const panel = heroPanel(goal, state, versions);
      const code = panel.code.map(row => row.tokens.map(token => token.text).join(""));

      expect(panel.heading).toBe("Now try another app");
      expect(panel.hint).toBe(`${goal.app.name} is running.`);
      expect(panel.cards.map(card => card.state)).toEqual(["placed", "placed", "placed"]);
      expect(code).toEqual(goal.finalCode);
      expect(panel.log).toHaveLength(3);
      expect(panel.verdict?.kind).toBe("win");
    }
  });
});

describe("highlightCode", () => {
  // Bug: a run is dropped or repeated, so the code card shows other code than the rules made.
  it("gives every line back when its runs are joined", () => {
    for (const line of goals.flatMap(goal => goal.finalCode)) {
      expect(
        highlightCode(line)
          .map(token => token.text)
          .join("")
      ).toBe(line);
    }
  });

  // Bug: a string, a keyword, the factory or a plugin name gets the wrong colour.
  it("colours strings, keywords, createApp and plugin names", () => {
    const tokens = highlightCode('import { createApp, contentPlugin } from "@moku-labs/web";');

    expect(tokens.filter(token => token.kind !== undefined)).toEqual([
      { text: "import", kind: "keyword" },
      { text: "createApp", kind: "function" },
      { text: "contentPlugin", kind: "plugin" },
      { text: "from", kind: "keyword" },
      { text: '"@moku-labs/web"', kind: "string" }
    ]);
  });
});

describe("infoCard", () => {
  // Bug: the card offers Add for a piece that is in or waiting, or none for one that is out.
  it("offers Add only for a piece not in yet, and says where each item stands", () => {
    const waiting = progressAfter(siteGoal, "comments");

    expect(infoCard(siteGoal, waiting, "newsletter", versions)).toMatchObject({
      status: "Not in yet. Drop it on the kernel.",
      add: "Add newsletter"
    });
    expect(infoCard(siteGoal, waiting, "comments", versions)).toMatchObject({
      status: "Waiting for content."
    });
    expect(infoCard(siteGoal, waiting, "comments", versions)?.add).toBeUndefined();
    expect(
      infoCard(siteGoal, progressAfter(siteGoal, "content"), "content", versions)?.status
    ).toBe(undefined);
    expect(infoCard(siteGoal, waiting, "app", versions)?.status).toBe(
      "Not running yet. Add every piece first."
    );
    expect(infoCard(siteGoal, waiting, "core", versions)).toMatchObject({ tone: "kernel" });
    expect(infoCard(siteGoal, waiting, "nope", versions)).toBeUndefined();
  });
});

describe("itemLabel", () => {
  // Bug: a screen reader hears no version for the kernel, or no word that a piece waits.
  it("names the kernel as the drop target and a waiting piece as waiting", () => {
    const waiting = progressAfter(siteGoal, "comments");

    expect(itemLabel(siteGoal, waiting, "core", versions)).toBe(
      "kernel, @moku-labs/core 1.0.1. Drop pieces here. Show details"
    );
    expect(itemLabel(siteGoal, waiting, "comments", versions)).toBe(
      "comments, waiting. your plugin, in ./plugins. Show details"
    );
    expect(itemLabel(siteGoal, waiting, "nope", versions)).toBe("nope");
  });
});
