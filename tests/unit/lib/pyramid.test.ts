import { describe, expect, it } from "vitest";
import {
  BRICK_HEIGHT,
  brickFaces,
  pyramidBricks,
  relatedBricks,
  STACKED_WIDTH
} from "../../../src/lib/pyramid";

const demos = [
  { id: "tracker", name: "Tracker", stack: ["web", "worker"] },
  { id: "timber-town", name: "Timber Town", stack: ["game", "editor"] }
];
const packages = [
  { id: "core", label: "@moku-labs/core" },
  { id: "web", label: "web" },
  { id: "worker", label: "worker" },
  { id: "game", label: "game" },
  { id: "ai", label: "ai" }
];

describe("pyramidBricks", () => {
  // Bug: core lands in the package row, or a row is not centred, so the pyramid leans.
  it("puts core alone on top, the packages under it and the demos at the base, each row centred", () => {
    const { bricks, height } = pyramidBricks(packages, demos);
    const rowOf = (kind: string) => bricks.filter(brick => brick.kind === kind);

    expect(rowOf("core").map(brick => brick.id)).toEqual(["core"]);
    expect(rowOf("package").map(brick => brick.id)).toEqual(["web", "worker", "game", "ai"]);
    expect(rowOf("demo").map(brick => brick.label)).toEqual(["Tracker", "Timber Town"]);
    const [core] = rowOf("core");
    const [tracker] = rowOf("demo");
    expect(core?.y).toBeLessThan(tracker?.y ?? 0);
    for (const row of [rowOf("core"), rowOf("package"), rowOf("demo")]) {
      const first = row[0];
      const last = row.at(-1);
      if (!first || !last) throw new Error("empty row");
      expect(first.x).toBeCloseTo(980 - (last.x + last.width));
    }
    expect(height).toBeGreaterThan((tracker?.y ?? 0) + 44);
  });
});

describe("brickFaces", () => {
  // Bug: the lid or the side is drawn on the wrong edge and the brick looks flat.
  it("draws the front, a lid going up and right, and the right side", () => {
    expect(
      brickFaces({ kind: "demo", id: "x", label: "X", x: 10, y: 20, width: 100, height: 44 })
    ).toEqual({
      front: "10,20 110,20 110,64 10,64",
      top: "10,20 26,10 126,10 110,20",
      side: "110,20 126,10 126,54 110,64"
    });
  });
});

describe("relatedBricks", () => {
  // Bug: hovering a demo lights the wrong packages, or forgets the kernel under them.
  it("lights a demo's packages and the core", () => {
    expect([...relatedBricks("demo", "tracker", demos, packages)].toSorted()).toEqual([
      "core:core",
      "package:web",
      "package:worker"
    ]);
  });

  // Bug: hovering a package does not show what was built with it.
  it("lights the demos built on a package, and none for a package no demo uses", () => {
    expect([...relatedBricks("package", "game", demos, packages)].toSorted()).toEqual([
      "core:core",
      "demo:timber-town"
    ]);
    expect([...relatedBricks("package", "ai", demos, packages)]).toEqual(["core:core"]);
  });

  // Bug: the kernel brick lights nothing, though everything stands on it.
  it("lights everything for the core", () => {
    expect(relatedBricks("core", "core", demos, packages).size).toBe(1 + 4 + 2);
  });
});

describe("pyramidBricks, stacked", () => {
  const family = [
    { id: "core", label: "@moku-labs/core" },
    ...[
      "claude",
      "common",
      "web",
      "worker",
      "room",
      "system",
      "native",
      "game",
      "editor",
      "ai",
      "ci"
    ].map(id => ({ id, label: id }))
  ];
  const six = ["tracker", "atlas", "timber-town", "a", "b", "c"].map(id => ({
    id,
    name: id,
    stack: ["web"]
  }));
  /** Lid of a brick reaches this far right of its front face. */
  const LID = 16;

  // Bug: a brick or its lid runs past the drawing, so the phone page scrolls sideways again.
  it("keeps every brick and its lid inside the phone width", () => {
    const { bricks, width } = pyramidBricks(family, six, "stacked");

    expect(width).toBe(STACKED_WIDTH);
    for (const brick of bricks) {
      expect(brick.x, brick.id).toBeGreaterThanOrEqual(0);
      expect(brick.x + brick.width + LID, brick.id).toBeLessThanOrEqual(width);
    }
  });

  // Bug: wrapped lines are lost or reordered, so a package or demo vanishes from the phone view.
  it("wraps packages four to a line and demos two, keeping every brick once, in order", () => {
    const { bricks } = pyramidBricks(family, six, "stacked");
    const lines = (kind: string): number[] => {
      const ys = bricks.filter(brick => brick.kind === kind).map(brick => brick.y);
      return [...new Set(ys)];
    };

    expect(bricks).toHaveLength(1 + 11 + 6);
    expect(bricks.filter(brick => brick.kind === "package").map(brick => brick.id)).toEqual(
      family.slice(1).map(entry => entry.id)
    );
    expect(lines("core")).toHaveLength(1);
    expect(lines("package")).toHaveLength(3);
    expect(lines("demo")).toHaveLength(3);
    for (const y of lines("package")) {
      expect(bricks.filter(brick => brick.y === y).length).toBeLessThanOrEqual(4);
    }
  });

  // Bug: a short last line sits at the left edge, so the pyramid leans.
  it("centres a short last line", () => {
    const { bricks, width } = pyramidBricks(family, six, "stacked");
    const lastY = Math.max(
      ...bricks.filter(brick => brick.kind === "package").map(brick => brick.y)
    );
    const last = bricks.filter(brick => brick.y === lastY);
    const first = last[0];
    const end = last.at(-1);
    if (!first || !end) throw new Error("empty line");

    expect(last).toHaveLength(3);
    expect(first.x).toBeCloseTo(width - LID - (end.x + end.width));
  });

  // Bug: no two bricks may overlap, or a tap hits the wrong one.
  it("never overlaps two bricks", () => {
    const { bricks } = pyramidBricks(family, six, "stacked");

    for (const [index, one] of bricks.entries()) {
      for (const other of bricks.slice(index + 1)) {
        const apartX = one.x + one.width <= other.x || other.x + other.width <= one.x;
        const apartY = one.y + one.height <= other.y || other.y + other.height <= one.y;
        expect(apartX || apartY, `${one.id} ${other.id}`).toBe(true);
      }
    }
  });

  // Bug: bricks too small for a finger: at the narrowest drawing they must stay >= 40px tall.
  it("keeps bricks at least 40px tall on a 320px drawing", () => {
    expect(BRICK_HEIGHT * (320 / STACKED_WIDTH)).toBeGreaterThanOrEqual(40);
  });

  // Bug: the phone mode changes the desktop pyramid.
  it("leaves the wide layout as it was: eleven packages on one line, 1000 wide", () => {
    const { bricks, width } = pyramidBricks(family, six);

    expect(width).toBe(1000);
    expect(
      new Set(bricks.filter(brick => brick.kind === "package").map(brick => brick.y)).size
    ).toBe(1);
    expect(new Set(bricks.filter(brick => brick.kind === "demo").map(brick => brick.y)).size).toBe(
      1
    );
  });
});
