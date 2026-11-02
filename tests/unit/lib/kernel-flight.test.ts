import { describe, expect, it } from "vitest";
import {
  ARC_HOVER_HEIGHT,
  ARC_PEAK_RISE,
  arcToKernel,
  DRAG_THRESHOLD,
  isWithinReach,
  KERNEL_REACH,
  KERNEL_REACH_TOP_EXTRA,
  movedPastThreshold,
  placeAt,
  straightFlight,
  TUMBLE_DRIFT,
  TUMBLE_EDGE_OFFSET,
  TUMBLE_FALL,
  TUMBLE_LIFT,
  TUMBLE_LIFT_OFFSET,
  tumbleDirection,
  tumbleFrames
} from "../../../src/lib/kernel-flight";

const kernel = { left: 100, right: 200, top: 100, bottom: 180 };

describe("placeAt", () => {
  // Bug: the rotation is dropped or the axes swap, and the flyer lands in the wrong spot.
  it("writes the translate in px and the turn in degrees", () => {
    expect(placeAt({ x: 12, y: -4 }, 25)).toBe("translate(12px, -4px) rotate(25deg)");
    expect(placeAt({ x: 1, y: 2 })).toBe("translate(1px, 2px) rotate(0deg)");
  });
});

describe("isWithinReach", () => {
  // Bug: the reach is not added, so a drop just beside the kernel flies home instead.
  it("counts a drop just outside the box on every side", () => {
    const inside = KERNEL_REACH - 1;
    expect(isWithinReach({ x: kernel.left - inside, y: 140 }, kernel)).toBe(true);
    expect(isWithinReach({ x: kernel.right + inside, y: 140 }, kernel)).toBe(true);
    expect(isWithinReach({ x: 150, y: kernel.bottom + inside }, kernel)).toBe(true);
  });

  // Bug: the extra reach above the lid is lost, so a cube held over the kernel misses it.
  it("reaches further above the kernel than below it", () => {
    const aboveReach = KERNEL_REACH + KERNEL_REACH_TOP_EXTRA - 1;
    expect(isWithinReach({ x: 150, y: kernel.top - aboveReach }, kernel)).toBe(true);
    expect(isWithinReach({ x: 150, y: kernel.bottom + aboveReach }, kernel)).toBe(false);
  });

  // Bug: one axis is enough, so a drop level with the kernel but far left still plugs.
  it("needs both axes in reach", () => {
    expect(isWithinReach({ x: kernel.left - KERNEL_REACH - 1, y: 140 }, kernel)).toBe(false);
    expect(isWithinReach({ x: 150, y: kernel.bottom + KERNEL_REACH }, kernel)).toBe(false);
  });
});

describe("movedPastThreshold", () => {
  // Bug: a jittery click becomes a drag, or the distance ignores one axis.
  it("starts a drag at the threshold distance, measured on both axes", () => {
    expect(movedPastThreshold({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false);
    expect(movedPastThreshold({ x: 0, y: 0 }, { x: 0, y: DRAG_THRESHOLD })).toBe(true);
    expect(movedPastThreshold({ x: 10, y: 10 }, { x: 14, y: 15 })).toBe(true);
  });
});

describe("arcToKernel", () => {
  // Bug: the verdict falls on the lid itself, or the arc peaks below a throw from high up.
  it("stops above the lid and peaks above the higher end, half way across", () => {
    const { frames, above } = arcToKernel({ x: 0, y: 300 }, { x: 200, y: 200 });

    expect(above).toEqual({ x: 200, y: 200 - ARC_HOVER_HEIGHT });
    expect(frames).toEqual([
      { transform: placeAt({ x: 0, y: 300 }) },
      { transform: placeAt({ x: 100, y: above.y - ARC_PEAK_RISE }) },
      { transform: placeAt(above) }
    ]);
  });
});

describe("straightFlight", () => {
  // Bug: the frames run backwards and the ghost flies away from its tray button.
  it("goes from the start to the end", () => {
    expect(straightFlight({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual([
      { transform: placeAt({ x: 1, y: 2 }) },
      { transform: placeAt({ x: 3, y: 4 }) }
    ]);
  });
});

describe("tumbleDirection", () => {
  // Bug: every refusal falls off the same edge.
  it("alternates edges, the first refusal going right", () => {
    expect([1, 2, 3].map(rejections => tumbleDirection(rejections))).toEqual([1, -1, 1]);
  });
});

describe("tumbleFrames", () => {
  // Bug: a left tumble spins and drifts right, or the plugin never fades out.
  it("lifts, crosses the edge and falls away on the side it tumbles to", () => {
    const above = { x: 0, y: 0 };
    const edge = { x: -100, y: 50 };
    const frames = tumbleFrames(above, edge, -1);

    expect(frames.map(frame => frame.offset)).toEqual([
      undefined,
      TUMBLE_LIFT_OFFSET,
      TUMBLE_EDGE_OFFSET,
      undefined
    ]);
    expect(frames[1]?.transform).toBe(placeAt({ x: -50, y: -TUMBLE_LIFT }, -25));
    expect(frames[2]?.transform).toBe(placeAt(edge, -70));
    expect(frames[3]).toEqual({
      transform: placeAt({ x: -100 - TUMBLE_DRIFT, y: 50 + TUMBLE_FALL }, -200),
      opacity: 0
    });
  });
});
