import { describe, expect, it } from "vitest";
import {
  arcToTarget,
  DRAG_THRESHOLD,
  FLIGHT_LANDING_SCALE,
  FLIGHT_PEAK_RISE,
  isWithinReach,
  KERNEL_REACH,
  KERNEL_REACH_TOP_EXTRA,
  movedPastThreshold,
  placeAt,
  straightFlight
} from "../../../src/lib/kernel-flight";

const kernel = { left: 100, right: 200, top: 100, bottom: 180 };

describe("placeAt", () => {
  // Bug: the axes swap or the unit is dropped, and the flyer lands in the wrong spot.
  it("writes the translate in px, x first", () => {
    expect(placeAt({ x: 12, y: -4 })).toBe("translate(12px, -4px)");
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

describe("arcToTarget", () => {
  // Bug: the piece lands beside its socket, flies under a socket that is higher than the start,
  // or keeps its tray size as it lands in the world.
  it("rises half way across over the higher end and lands on the socket, shrunk", () => {
    const frames = arcToTarget({ x: 0, y: 300 }, { x: 200, y: 200 });

    expect(frames).toEqual([
      { transform: placeAt({ x: 0, y: 300 }) },
      { transform: placeAt({ x: 100, y: 200 - FLIGHT_PEAK_RISE }), offset: 0.5 },
      { transform: `${placeAt({ x: 200, y: 200 })} scale(${FLIGHT_LANDING_SCALE})` }
    ]);
  });
});

describe("straightFlight", () => {
  // Bug: the frames run backwards and the piece flies away from its tray card.
  it("goes from the start to the end", () => {
    expect(straightFlight({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual([
      { transform: placeAt({ x: 1, y: 2 }) },
      { transform: placeAt({ x: 3, y: 4 }) }
    ]);
  });
});
