import { describe, expect, it } from "vitest";
import type { Goal } from "../../../src/data/assembly";
import { appGoal, gameGoal, goals, siteGoal } from "../../../src/data/assembly";
import type { AssemblyState, AssemblyVersions } from "../../../src/lib/assembly";
import { addPiece, initialAssembly, needsOf } from "../../../src/lib/assembly";
import type { LabelViewport, TextBox } from "../../../src/lib/hero-world";
import {
  APP_LEVEL,
  cubeAnchor,
  cubeBox,
  DESKTOP_LABELS,
  FRAMEWORK_BOX,
  FRAMEWORK_LEVEL,
  HOVER_LIFT,
  KERNEL_BOX,
  kernelTop,
  labelPlacement,
  labelScene,
  labelUnits,
  layerAt,
  needArc,
  PHONE_LABEL_UNITS,
  PHONE_LABELS,
  PHONE_MIN_DRAWING,
  PHONE_MIN_LABEL,
  PHONE_WINDOW,
  platformCells,
  platformLevel,
  sceneryCubes,
  WORLD_FRAME,
  WORLD_SIZE,
  windowFraming,
  world,
  worldCubes,
  worldSockets
} from "../../../src/lib/hero-world";
import type { Point } from "../../../src/lib/iso";

const versions: AssemblyVersions = {
  core: "1.0.1",
  common: "2.0.2",
  web: "3.0.3",
  worker: "4.0.4",
  game: "5.0.5"
};

/**
 * Every state a goal can reach, one per set of placed and waiting pieces.
 *
 * @param goal - The goal.
 * @returns The states with a short name each.
 */
function reachableStates(goal: Goal): { name: string; state: AssemblyState }[] {
  const seen = new Map<string, AssemblyState>();
  const queue = [initialAssembly(goal, versions)];
  while (queue.length > 0) {
    const state = queue.shift();
    if (state === undefined) break;
    const name = `placed [${state.placed.toSorted().join(" ")}] waiting [${state.waiting.toSorted().join(" ")}]`;
    if (seen.has(name)) continue;
    seen.set(name, state);
    for (const piece of goal.pieces) queue.push(addPiece(goal, state, piece.id).state);
  }
  return [...seen].map(([name, state]) => ({ name, state }));
}

/** The corners of a text box. */
function boxCorners(box: TextBox): Point[] {
  return [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x + box.width, box.y + box.height],
    [box.x, box.y + box.height]
  ];
}

/** Whether a point lies strictly inside a polygon (ray casting). */
function inside(point: Point, polygon: readonly Point[]): boolean {
  const [x, y] = point;
  let crossings = 0;
  for (const [index, [ax, ay]] of polygon.entries()) {
    const [bx, by] = polygon[(index + 1) % polygon.length] ?? [ax, ay];
    if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay)) crossings += 1;
  }
  return crossings % 2 === 1;
}

/** Which side of the line through p and q the point r lies on. */
function side(p: Point, q: Point, r: Point): number {
  return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
}

/** Whether two segments cross. */
function cross(a: Point, b: Point, c: Point, d: Point): boolean {
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/** The edges of a polygon. */
function edges(polygon: readonly Point[]): [Point, Point][] {
  return polygon.map((point, index) => [point, polygon[(index + 1) % polygon.length] ?? point]);
}

/** Whether two polygons touch: an edge crosses an edge, or one holds a corner of the other. */
function touches(first: readonly Point[], second: readonly Point[]): boolean {
  const crossing = edges(first).some(([a, b]) => edges(second).some(([c, d]) => cross(a, b, c, d)));
  return (
    crossing ||
    first.some(point => inside(point, second)) ||
    second.some(point => inside(point, first))
  );
}

/** Whether two boxes overlap. */
function boxesOverlap(first: TextBox, second: TextBox): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

/** Whether a box lies inside a frame. */
function withinFrame(box: TextBox, viewport: LabelViewport): boolean {
  const { frame } = viewport;
  return (
    box.x >= frame.x &&
    box.y >= frame.y &&
    box.x + box.width <= frame.x + frame.width &&
    box.y + box.height <= frame.y + frame.height
  );
}

/** A placed text with its box, and whether it is a name that must keep off other cubes. */
type PlacedText = { text: string; owner: string; box: TextBox; isLabel: boolean };

/** The problems of one text: outside the frame, on a later text, on another cube. */
function textClashes(
  text: PlacedText,
  later: readonly PlacedText[],
  cubes: ReturnType<typeof labelScene>["cubes"],
  viewport: LabelViewport
): string[] {
  const found: string[] = [];
  if (!withinFrame(text.box, viewport)) found.push(`${text.text} outside the frame`);
  for (const other of later) {
    if (boxesOverlap(text.box, other.box)) found.push(`${text.text} on ${other.text}`);
  }
  const onCubes = text.isLabel
    ? cubes.filter(cube => cube.owner !== text.owner && touches(boxCorners(text.box), cube.outline))
    : [];
  return [...found, ...onCubes.map(cube => `${text.text} on cube ${cube.owner}`)];
}

/** Everything a state's layout gets wrong: texts on texts, labels on other cubes, texts outside. */
function clashes(goal: Goal, state: AssemblyState, viewport: LabelViewport): string[] {
  const scene = labelScene(goal, state);
  const layout = labelPlacement(scene, viewport);
  const texts: PlacedText[] = [
    ...layout.callouts.map(callout => ({ ...callout, isLabel: callout.kind === "app" })),
    ...layout.labels.map(label => ({ ...label, isLabel: true }))
  ];
  return texts.flatMap((text, index) =>
    textClashes(text, texts.slice(index + 1), scene.cubes, viewport)
  );
}

/** The cells of a square of fixed cells, from one corner to another. */
function squareCells(from: number, to: number): string[] {
  const cells: string[] = [];
  for (let x = from; x < to; x += 1) for (let y = from; y < to; y += 1) cells.push(`${x},${y}`);
  return cells;
}

/** The scenery packages of a goal. */
function packagesOf(goal: Goal): string[] {
  return sceneryCubes(goal).map(cube => cube.package);
}

/** The lid of an item's cube as a polygon. */
function lid(goal: Goal, id: string): Point[] {
  const box = cubeBox(goal, id);
  if (box === undefined) throw new Error(id);
  const top = box.z + box.height;
  return [
    world.point(box.x, box.y, top),
    world.point(box.x + box.width, box.y, top),
    world.point(box.x + box.width, box.y + box.depth, top),
    world.point(box.x, box.y + box.depth, top)
  ];
}

describe("platforms", () => {
  // Bug: a socket tile on the wrong ring, so a piece lands on another layer's platform.
  it("puts every socket and standing plugin on its layer's platform", () => {
    for (const goal of goals) {
      for (const piece of goal.pieces) {
        expect(layerAt(...piece.cell), `${goal.id} ${piece.id}`).toBe(piece.layer);
        expect(cubeBox(goal, piece.id)?.z, `${goal.id} ${piece.id}`).toBe(
          piece.layer === "app" ? APP_LEVEL : FRAMEWORK_LEVEL
        );
      }
      for (const plugin of goal.standing) {
        expect(layerAt(...plugin.cell), `${goal.id} ${plugin.id}`).toBe("framework");
      }
    }
  });

  // Bug: two cubes share a cell and are drawn into each other, or one stands on the kernel.
  it("gives every cube, socket and scenery block a cell of its own", () => {
    for (const goal of goals) {
      const cells = [
        ...squareCells(0, 2),
        ...squareCells(2, 4),
        ...squareCells(5, 7),
        ...[...goal.standing, ...goal.pieces].map(entry => entry.cell.join(",")),
        ...sceneryCubes(goal).map(cube => `${Math.floor(cube.box.x)},${Math.floor(cube.box.y)}`)
      ];
      expect(new Set(cells).size, goal.id).toBe(cells.length);
    }
  });

  // Bug: the rings swap, so the framework ring stands higher than your app's.
  it("steps up from the kernel's ground to the framework ring to your app's ring", () => {
    expect(platformLevel(6, 6)).toBe(0);
    expect(platformLevel(3, 8)).toBe(FRAMEWORK_LEVEL);
    expect(platformLevel(9, 1)).toBe(APP_LEVEL);
    expect(platformCells().some(cell => cell.layer === "framework" && cell.x + cell.y < 4)).toBe(
      false
    );
  });
});

describe("worldCubes", () => {
  // Bug: a waiting piece is drawn at rest in its socket, or the app cube shows before it runs.
  it("lifts a waiting piece over its socket and shows the app cube only once it runs", () => {
    const waiting = addPiece(siteGoal, initialAssembly(siteGoal, versions), "comments").state;
    const comments = worldCubes(siteGoal, waiting).find(cube => cube.id === "comments");

    expect(comments).toMatchObject({ waiting: true, lift: HOVER_LIFT, role: "piece" });
    expect(worldCubes(siteGoal, waiting).some(cube => cube.id === "app")).toBe(false);

    let done = waiting;
    for (const id of ["content", "newsletter"]) done = addPiece(siteGoal, done, id).state;
    const cubes = worldCubes(siteGoal, done);
    expect(cubes.find(cube => cube.id === "comments")).toMatchObject({ waiting: false, lift: 0 });
    expect(cubes.some(cube => cube.id === "app")).toBe(true);
  });

  // Bug: a wrong painter's order draws the framework block over the kernel in front of it, or the
  // app cube over the framework block.
  it("draws back to front", () => {
    let done = initialAssembly(gameGoal, versions);
    for (const piece of gameGoal.pieces) done = addPiece(gameGoal, done, piece.id).state;
    const cubes = worldCubes(gameGoal, done);
    const ids = cubes.map(cube => cube.id);
    const depths = cubes.map(
      cube => cube.box.x + cube.box.width / 2 + cube.box.y + cube.box.depth / 2
    );

    expect(ids.indexOf("app")).toBeLessThan(ids.indexOf("game"));
    expect(ids.indexOf("game")).toBeLessThan(ids.indexOf("core"));
    expect(depths).toEqual(depths.toSorted((first, second) => first - second));
  });
});

describe("worldSockets", () => {
  // Bug: a socket stays after its piece is in, or the needed socket is not marked for the wait.
  it("keeps a socket for each piece not in place, the needed one marked, and the app's", () => {
    const waiting = addPiece(appGoal, initialAssembly(appGoal, versions), "tasks").state;

    expect(worldSockets(appGoal, waiting)).toEqual([
      expect.objectContaining({ id: "d1", wanted: true }),
      expect.objectContaining({ id: "kv", wanted: false }),
      expect.objectContaining({ id: "tasks", wanted: false }),
      expect.objectContaining({ id: "app", wanted: false })
    ]);

    let done = waiting;
    for (const id of ["d1", "kv"]) done = addPiece(appGoal, done, id).state;
    expect(worldSockets(appGoal, done)).toEqual([]);
  });
});

describe("sceneryCubes", () => {
  // Bug: worker shows twice in App, once as the framework and once as scenery.
  it("swaps the worker scenery for web in App and keeps it elsewhere", () => {
    expect(packagesOf(appGoal)).toContain("web");
    expect(packagesOf(appGoal)).not.toContain("worker");
    expect(packagesOf(siteGoal)).toContain("worker");
    expect(packagesOf(gameGoal)).toContain("worker");
  });
});

describe("labelPlacement", () => {
  const viewports = [
    { name: "phone", viewport: PHONE_LABELS },
    { name: "desktop", viewport: DESKTOP_LABELS }
  ];
  const cases = goals.flatMap(goal =>
    reachableStates(goal).flatMap(({ name, state }) =>
      viewports.map(view => ({ label: `${goal.id} ${name} at ${view.name}`, goal, state, ...view }))
    )
  );

  // Bug: at 390 two names overprint, a name sits on another cube, or a name runs off the edge.
  it.each(cases)("$label: no text touches another text or another cube", ({
    goal,
    state,
    viewport
  }) => {
    expect(clashes(goal, state, viewport)).toEqual([]);
  });

  // Bug: a label moved off its cube gets no leader tick, or the tick runs through the text
  // instead of ending on the label's edge nearest its cube.
  it("draws a leader tick from over the anchor to the label's nearer edge", () => {
    const layouts = goals.flatMap(goal =>
      reachableStates(goal).map(({ state }) =>
        labelPlacement(labelScene(goal, state), PHONE_LABELS)
      )
    );
    const ticked = layouts.flatMap(layout => layout.labels).filter(label => label.tick);

    expect(ticked.length).toBeGreaterThan(0);
    for (const label of ticked) {
      const [from, to] = label.tick ?? [];
      const bottom = label.box.y + label.box.height;
      const edge = bottom <= (from?.[1] ?? 0) ? bottom : label.box.y;
      expect(from?.[0]).toBe(label.anchor[0]);
      expect(from?.[1]).toBeLessThan(label.anchor[1]);
      expect(to?.[1]).toBeCloseTo(edge);
      expect(to?.[0] ?? 0).toBeGreaterThanOrEqual(label.box.x);
      expect(to?.[0] ?? 0).toBeLessThanOrEqual(label.box.x + label.box.width);
    }
  });

  // Bug: the callout of a waiting piece names the wrong need, or the strip shows before the end.
  it("shows the waiting callout over the hovering piece and the strip only at the end", () => {
    const waiting = addPiece(siteGoal, initialAssembly(siteGoal, versions), "comments").state;
    const scene = labelScene(siteGoal, waiting);

    expect(scene.callouts.map(callout => callout.text)).toEqual(["comments needs content"]);
    let done = waiting;
    for (const id of ["content", "newsletter"]) done = addPiece(siteGoal, done, id).state;
    expect(labelScene(siteGoal, done).callouts.map(callout => callout.text)).toEqual([
      "field-notes.dev",
      "Field Notes is running. Every need is met."
    ]);
  });
});

describe("needArc", () => {
  // Bug: an arc ends at the wrong cube, or its arrowhead points back at the cube that needs.
  it("points every needs edge of every goal into the needed cube's lid", () => {
    for (const goal of goals) {
      const ids = ["app", goal.framework.id, ...goal.standing.map(entry => entry.id)];
      for (const from of [...ids, ...goal.pieces.map(piece => piece.id)]) {
        for (const to of needsOf(goal, from)) {
          const start = cubeAnchor(goal, from);
          const end = cubeAnchor(goal, to);
          if (start === undefined || end === undefined) throw new Error(`${from} ${to}`);
          const [tip] = needArc(start, end).head;
          expect(inside(tip, lid(goal, to)), `${goal.id} ${from} → ${to}`).toBe(true);
        }
      }
    }
  });

  // Bug: a wide arc dips through the cubes between its ends instead of going over the top.
  it("bends over the top of both ends when they stand apart", () => {
    const comments = cubeAnchor(siteGoal, "comments");
    const content = cubeAnchor(siteGoal, "content");
    if (comments === undefined || content === undefined) throw new Error("no anchor");
    const arc = needArc(comments, content);

    expect(arc.bend[1]).toBeLessThan(Math.min(arc.start[1], arc.end[1]));
    expect(arc.path.startsWith(`M${arc.start[0]},`)).toBe(true);
  });

  // Bug: the framework's arc to the kernel straight below is a flat line hidden by the cubes.
  it("bulges out sideways when one end stands right above the other", () => {
    const arc = needArc(lidCentreOf(FRAMEWORK_BOX), kernelTop());

    expect(arc.bend[0]).toBeGreaterThan(Math.max(arc.start[0], arc.end[0]));
  });
});

/** The middle of a box's lid, computed independently of the module. */
function lidCentreOf(box: typeof KERNEL_BOX): Point {
  return world.point(box.x + box.width / 2, box.y + box.depth / 2, box.z + box.height);
}

describe("kernelTop", () => {
  // Bug: a dragged piece is dropped beside the kernel instead of on its lid.
  it("is the centre of the kernel's lid", () => {
    const corners = world
      .box(KERNEL_BOX)
      .top.split(" ")
      .map(pair => pair.split(",").map(Number));
    const [x, y] = kernelTop();

    expect(x).toBeCloseTo(corners.reduce((sum, [cx = 0]) => sum + cx, 0) / 4);
    expect(y).toBeCloseTo(corners.reduce((sum, [, cy = 0]) => sum + cy, 0) / 4);
  });
});

describe("windowFraming", () => {
  // Bug: the phone crop is off-centre or the wrong size, so the platform runs off one edge.
  it("maps the window's edges onto the box's edges", () => {
    const framing = windowFraming(PHONE_WINDOW);
    const percentOf = (worldX: number): number =>
      framing.shift + ((worldX - WORLD_FRAME.x) / WORLD_FRAME.width) * framing.width;

    expect(percentOf(PHONE_WINDOW.x)).toBeCloseTo(0);
    expect(percentOf(PHONE_WINDOW.x + PHONE_WINDOW.width)).toBeCloseTo(100);
  });

  // Bug: the crop is so tight that the platform's corners or a scenery block are cut off.
  it("keeps the whole platform and every scenery block inside the phone window", () => {
    const left = PHONE_WINDOW.x;
    const right = PHONE_WINDOW.x + PHONE_WINDOW.width;
    const [leftCorner = 0] = world.point(0, WORLD_SIZE, 0);
    const [rightCorner = 0] = world.point(WORLD_SIZE, 0, 0);

    expect(leftCorner).toBeGreaterThanOrEqual(left);
    expect(rightCorner).toBeLessThanOrEqual(right);
    for (const goal of goals) {
      for (const cube of sceneryCubes(goal)) {
        const faces = world.box(cube.box);
        for (const pair of `${faces.top} ${faces.left} ${faces.right}`.split(" ")) {
          const [pointX = 0] = pair.split(",").map(Number);
          expect(pointX, cube.package).toBeGreaterThanOrEqual(left);
          expect(pointX, cube.package).toBeLessThanOrEqual(right);
        }
      }
    }
  });
});

describe("labelUnits", () => {
  // Bug: labels are sized for the desktop drawing and render at 6px on a phone.
  it("renders at least the minimum on the check phone's drawing", () => {
    const scale = PHONE_MIN_DRAWING / PHONE_WINDOW.width;

    expect(PHONE_LABEL_UNITS * scale).toBeGreaterThanOrEqual(PHONE_MIN_LABEL);
    expect((PHONE_LABEL_UNITS - 1) * scale).toBeLessThan(PHONE_MIN_LABEL);
  });

  // Bug: the size ignores the drawing width, so a narrower drawing is not given bigger units.
  it("asks for bigger units the narrower the drawing is", () => {
    expect(labelUnits(10, 250)).toBeGreaterThan(labelUnits(10, 400));
    expect(labelUnits(10, PHONE_WINDOW.width)).toBe(10);
  });
});
