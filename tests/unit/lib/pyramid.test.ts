import { describe, expect, it } from "vitest";
import { brickFaces, pyramidBricks, relatedBricks } from "../../../src/lib/pyramid";

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
