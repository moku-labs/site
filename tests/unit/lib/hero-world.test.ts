import { describe, expect, it } from "vitest";
import {
  fallPoint,
  KERNEL_BOX,
  kernelTop,
  socketCentre,
  terraceLevel,
  WORLD_SIZE,
  world,
  worldItems
} from "../../../src/lib/hero-world";

/** A short key of a drawn item, for order checks. */
function key(item: ReturnType<typeof worldItems>[number]): string {
  if (item.kind === "terrace") return `terrace ${item.x},${item.y}`;
  if (item.kind === "socket") return `socket ${item.index}`;
  if (item.kind === "block") return `block ${item.id}`;
  return "kernel";
}

describe("terraceLevel", () => {
  // Bug: the rings swap and the outer terrace ends up lower than the middle one.
  it("raises the outer ring highest, the next ring half as high and the centre not at all", () => {
    expect(terraceLevel(0, 7)).toBe(1.6);
    expect(terraceLevel(4, 1)).toBe(0.8);
    expect(terraceLevel(5, 5)).toBe(0);
  });
});

describe("worldItems", () => {
  // Bug: a wrong painter's order draws a terrace over the block standing on it, or a block
  // behind the kernel it stands in front of.
  it("draws back to front, the kernel before the blocks level with it", () => {
    const order = worldItems(["web", "core"]).map(item => key(item));
    const at = (name: string): number => order.indexOf(name);

    expect(at("terrace 1,4")).toBeLessThan(at("block web"));
    expect(at("block web")).toBeLessThan(at("terrace 1,5"));
    expect(at("kernel")).toBeLessThan(at("block core"));
    expect(at("socket 4")).toBeGreaterThan(at("kernel"));
  });

  // Bug: a package without a place on the map crashes the render or lands at the origin.
  it("leaves out packages that have no place on the map", () => {
    const blocks = worldItems(["web", "claude", "nope"]).filter(item => item.kind === "block");

    expect(blocks.map(item => key(item))).toEqual(["block web"]);
  });
});

describe("socketCentre", () => {
  // Bug: the flying plugin lands beside the socket it locks into.
  it("returns the middle of the socket cell just above the ground", () => {
    const [x, y] = socketCentre(0);

    expect(x).toBe(-30);
    expect(y).toBeCloseTo(156.2);
  });
});

describe("kernelTop", () => {
  // Bug: the thrown plugin is judged beside the kernel instead of above its lid.
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

describe("fallPoint", () => {
  // Bug: a refused plugin lands on the platform, or always falls off the same side.
  it("lies past the front edge of the platform, on the side asked for", () => {
    const [rightX, rightY] = fallPoint(true);
    const [leftX, leftY] = fallPoint(false);
    // The two front edges run from the right corner and the left corner down to the front corner.
    const [frontX, frontY] = world.point(WORLD_SIZE, WORLD_SIZE, 0);
    const [cornerX, cornerY] = world.point(WORLD_SIZE, 0, 0);
    const edgeY = (x: number): number =>
      frontY + ((cornerY - frontY) * Math.abs(x - frontX)) / Math.abs(cornerX - frontX);

    expect(rightX).toBeGreaterThan(frontX);
    expect(leftX).toBeLessThan(frontX);
    expect(rightY).toBeGreaterThan(edgeY(rightX));
    expect(leftY).toBeGreaterThan(edgeY(leftX));
  });
});
