import { describe, expect, it } from "vitest";
import { createProjection, formatPoints } from "../../../src/lib/iso";

const projection = createProjection({ tileWidth: 60, tileHeight: 30, levelHeight: 34 });

describe("createProjection", () => {
  // Bug: x and y swapped or z added instead of lifted: every block lands on the wrong cell.
  it("puts +x to the lower right, +y to the lower left and +z straight up", () => {
    expect(projection.point(0, 0, 0)).toEqual([0, 0]);
    expect(projection.point(1, 0, 0)).toEqual([30, 15]);
    expect(projection.point(0, 1, 0)).toEqual([-30, 15]);
    expect(projection.point(0, 0, 1)).toEqual([0, -34]);
  });

  // Bug: a face built from the wrong corners draws the cube inside out.
  it("builds the top, left and right faces of a box from its corners", () => {
    const faces = projection.box({ x: 4, y: 4, z: 0, width: 2, depth: 2, height: 2 });

    expect(faces.top).toBe("0,52 60,82 0,112 -60,82");
    expect(faces.left).toBe("-60,82 0,112 0,180 -60,150");
    expect(faces.right).toBe("60,82 0,112 0,180 60,150");
  });

  // Bug: the glyph matrix ignores the face size or origin, so the glyph floats off the top face.
  it("maps a 100-unit drawing onto the top face of a box", () => {
    expect(projection.topFaceTransform(4, 4, 2, 2, 2)).toBe("matrix(0.6 0.3 -0.6 0.3 0 52)");
  });
});

describe("formatPoints", () => {
  // Bug: "-0.0" or long floats in the markup make SSR and the island disagree.
  it("joins points with one decimal and no negative zero", () => {
    expect(
      formatPoints([
        [-0.04, 1.26],
        [10, 2.5]
      ])
    ).toBe("0,1.3 10,2.5");
  });
});
