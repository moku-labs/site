/**
 * @file The motion maths of the hero's kernel world: when a press becomes a drag, whether a drop
 * lands on the kernel, and the keyframes of a throw, a drop into a socket, a tumble off the edge
 * and the flight home. Pure; the `kernel-world` island measures the screen and plays the frames.
 */

/** A point on the screen, in CSS px. */
export type ScreenPoint = {
  /** Distance from the viewport's left edge. */
  x: number;
  /** Distance from the viewport's top edge. */
  y: number;
};

/** The edges of an element's box on the screen, as `getBoundingClientRect()` gives them. */
export type ScreenBox = {
  /** Left edge. */
  left: number;
  /** Right edge. */
  right: number;
  /** Top edge. */
  top: number;
  /** Bottom edge. */
  bottom: number;
};

/** One keyframe of the flyer: where it is, and on a tumble its opacity and timing offset. */
export type FlightFrame = {
  /** The CSS transform, from {@link placeAt}. */
  transform: string;
  /** Opacity at this frame. */
  opacity?: number;
  /** Position of the frame in the animation, 0 to 1. */
  offset?: number;
};

/** Pointer travel, in px, before a press becomes a drag. */
export const DRAG_THRESHOLD = 6;

/** How far around the kernel's box, in px, a drop still counts. */
export const KERNEL_REACH = 28;

/** Extra reach above the kernel, in px: the dragged cube hangs above the pointer. */
export const KERNEL_REACH_TOP_EXTRA = 20;

/** How far above the kernel's lid, in px, a thrown plugin stops before its verdict. */
export const ARC_HOVER_HEIGHT = 64;

/** How far the throw's peak rises, in px, above the higher of its two ends. */
export const ARC_PEAK_RISE = 70;

/** Length of the throw arc, in ms. */
export const ARC_DURATION = 560;

/** Length of the drop from above the kernel into a socket, in ms. */
export const DROP_DURATION = 230;

/** How far a refused plugin lifts, in px, before it falls. */
export const TUMBLE_LIFT = 34;

/** How far past the platform edge, in px, a refused plugin drifts sideways. */
export const TUMBLE_DRIFT = 50;

/** How far below the platform edge, in px, a refused plugin falls out of sight. */
export const TUMBLE_FALL = 300;

/** Rotation, in degrees, at the top of the lift. */
export const TUMBLE_LIFT_TURN = 25;

/** Rotation, in degrees, at the platform edge. */
export const TUMBLE_EDGE_TURN = 70;

/** Rotation, in degrees, when the plugin is gone. */
export const TUMBLE_GONE_TURN = 200;

/** Where in the tumble the lift peaks, 0 to 1. */
export const TUMBLE_LIFT_OFFSET = 0.3;

/** Where in the tumble the plugin crosses the platform edge, 0 to 1. */
export const TUMBLE_EDGE_OFFSET = 0.6;

/** Length of the tumble, in ms. */
export const TUMBLE_DURATION = 1050;

/** Length of the flight of a dropped ghost back to its tray button, in ms. */
export const RETURN_DURATION = 260;

/** Easing of the throw arc. */
export const EASE_THROW = "cubic-bezier(.45,.1,.3,1)";

/** Easing of the drop into a socket. */
export const EASE_DROP = "cubic-bezier(.6,0,.9,.4)";

/** Easing of the tumble off the edge. */
export const EASE_TUMBLE = "cubic-bezier(.3,.2,.6,1)";

/** Easing of the flight home. */
export const EASE_RETURN = "cubic-bezier(.3,.7,.3,1)";

/**
 * A CSS translate and rotation for a keyframe.
 *
 * @param point - Where the flyer is.
 * @param turn - Rotation in degrees.
 * @returns The transform value.
 * @example
 * ```ts
 * placeAt({ x: 120, y: 40 }, 25); // "translate(120px, 40px) rotate(25deg)"
 * ```
 */
export function placeAt(point: ScreenPoint, turn = 0): string {
  return `translate(${point.x}px, ${point.y}px) rotate(${turn}deg)`;
}

/**
 * Whether a screen point is on the kernel or near enough to count as a drop on it.
 *
 * @param point - The pointer.
 * @param kernel - The kernel's box on the screen.
 * @returns `true` inside the box grown by {@link KERNEL_REACH}, and above it by the extra reach.
 * @example
 * ```ts
 * const kernel = { left: 100, right: 200, top: 100, bottom: 180 };
 * isWithinReach({ x: 90, y: 60 }, kernel); // true: 10 px left, 40 px above
 * isWithinReach({ x: 150, y: 210 }, kernel); // false: 30 px below
 * ```
 */
export function isWithinReach(point: ScreenPoint, kernel: ScreenBox): boolean {
  const withinX = point.x > kernel.left - KERNEL_REACH && point.x < kernel.right + KERNEL_REACH;
  const withinY =
    point.y > kernel.top - KERNEL_REACH - KERNEL_REACH_TOP_EXTRA &&
    point.y < kernel.bottom + KERNEL_REACH;
  return withinX && withinY;
}

/**
 * Whether the pointer has travelled far enough from the press to start a drag.
 *
 * @param start - Where the press started.
 * @param point - Where the pointer is now.
 * @returns `true` from {@link DRAG_THRESHOLD} px on.
 * @example
 * ```ts
 * movedPastThreshold({ x: 0, y: 0 }, { x: 3, y: 4 }); // false: 5 px
 * movedPastThreshold({ x: 0, y: 0 }, { x: 6, y: 0 }); // true
 * ```
 */
export function movedPastThreshold(start: ScreenPoint, point: ScreenPoint): boolean {
  return Math.hypot(point.x - start.x, point.y - start.y) >= DRAG_THRESHOLD;
}

/**
 * The throw from a start point to the point above the kernel's lid, over a peak between them.
 *
 * @param from - Where the throw starts.
 * @param kernelLid - The kernel's lid on the screen.
 * @returns The keyframes, and the point above the kernel where the verdict falls.
 * @example
 * ```ts
 * const { above } = arcToKernel({ x: 0, y: 300 }, { x: 200, y: 200 });
 * above; // { x: 200, y: 136 }; the peak is at { x: 100, y: 66 }
 * ```
 */
export function arcToKernel(
  from: ScreenPoint,
  kernelLid: ScreenPoint
): { frames: FlightFrame[]; above: ScreenPoint } {
  const above = { x: kernelLid.x, y: kernelLid.y - ARC_HOVER_HEIGHT };
  const peak = { x: (from.x + above.x) / 2, y: Math.min(from.y, above.y) - ARC_PEAK_RISE };
  return {
    frames: [
      { transform: placeAt(from) },
      { transform: placeAt(peak) },
      { transform: placeAt(above) }
    ],
    above
  };
}

/**
 * A straight flight between two points: the drop into a socket and the flight home.
 *
 * @param from - Where it starts.
 * @param to - Where it ends.
 * @returns Two keyframes.
 * @example
 * ```ts
 * straightFlight({ x: 0, y: 0 }, { x: 10, y: 20 });
 * // [{ transform: "translate(0px, 0px) rotate(0deg)" },
 * //  { transform: "translate(10px, 20px) rotate(0deg)" }]
 * ```
 */
export function straightFlight(from: ScreenPoint, to: ScreenPoint): FlightFrame[] {
  return [{ transform: placeAt(from) }, { transform: placeAt(to) }];
}

/**
 * The side a refused plugin falls off: the edges alternate, the first refusal goes right.
 *
 * @param rejections - Refusals so far, this one included.
 * @returns `1` for the right edge, `-1` for the left.
 * @example
 * ```ts
 * tumbleDirection(1); // 1
 * tumbleDirection(2); // -1
 * ```
 */
export function tumbleDirection(rejections: number): 1 | -1 {
  return rejections % 2 === 1 ? 1 : -1;
}

/**
 * The tumble of a refused plugin: a small lift, a spin over the platform edge, then a fade as it
 * falls out of sight.
 *
 * @param above - Where it hangs above the kernel.
 * @param edge - The platform edge on the screen, on the side it falls.
 * @param direction - `1` to fall right, `-1` to fall left.
 * @returns Four keyframes with opacity and offsets.
 * @example
 * ```ts
 * const frames = tumbleFrames({ x: 0, y: 0 }, { x: 100, y: 50 }, 1);
 * frames[3]; // { transform: "translate(150px, 350px) rotate(200deg)", opacity: 0 }
 * ```
 */
export function tumbleFrames(
  above: ScreenPoint,
  edge: ScreenPoint,
  direction: 1 | -1
): FlightFrame[] {
  const lift = { x: (above.x + edge.x) / 2, y: above.y - TUMBLE_LIFT };
  const gone = { x: edge.x + direction * TUMBLE_DRIFT, y: edge.y + TUMBLE_FALL };
  return [
    { transform: placeAt(above), opacity: 1 },
    {
      transform: placeAt(lift, direction * TUMBLE_LIFT_TURN),
      opacity: 1,
      offset: TUMBLE_LIFT_OFFSET
    },
    {
      transform: placeAt(edge, direction * TUMBLE_EDGE_TURN),
      opacity: 1,
      offset: TUMBLE_EDGE_OFFSET
    },
    { transform: placeAt(gone, direction * TUMBLE_GONE_TURN), opacity: 0 }
  ];
}
