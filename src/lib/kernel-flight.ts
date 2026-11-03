/**
 * @file The motion maths of the hero's kernel world: when a press becomes a drag, whether a drop
 * lands on the kernel, the keyframes of a piece's flight to its socket and of the flight home.
 * Pure; the `kernel-world` island measures the screen and plays the frames.
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

/** One keyframe of the flyer: where it is, its opacity, and its timing offset when not even. */
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

/** How far a flight's peak rises, in px, above the higher of its two ends. */
export const FLIGHT_PEAK_RISE = 110;

/** Where in the flight the peak is, 0 to 1. */
export const FLIGHT_PEAK_OFFSET = 0.5;

/** How small the piece is when it lands, as it shrinks into the world. */
export const FLIGHT_LANDING_SCALE = 0.55;

/** Length of the flight to a socket, in ms. */
export const FLIGHT_DURATION = 560;

/** Easing of the flight to a socket. */
export const EASE_FLIGHT = "cubic-bezier(.3,.6,.4,1)";

/** Length of the flight of a let-go piece back to its tray card, in ms. */
export const RETURN_DURATION = 260;

/** Easing of the flight home. */
export const EASE_RETURN = "cubic-bezier(.3,.7,.3,1)";

/**
 * A CSS translate for a keyframe.
 *
 * @param point - Where the flyer is.
 * @returns The transform value.
 * @example
 * ```ts
 * placeAt({ x: 120, y: 40 }); // "translate(120px, 40px)"
 * ```
 */
export function placeAt(point: ScreenPoint): string {
  return `translate(${point.x}px, ${point.y}px)`;
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
 * The flight of a dropped or tapped piece to its socket: up over a peak half way across, then down
 * into the socket, shrinking as it lands in the world.
 *
 * @param from - Where the flight starts: the drop point or the tray card.
 * @param target - The piece's socket on the screen.
 * @returns Three keyframes.
 * @example
 * ```ts
 * const frames = arcToTarget({ x: 0, y: 300 }, { x: 200, y: 200 });
 * frames[1]; // { transform: "translate(100px, 90px)", offset: 0.5 }: the peak
 * frames[2]?.transform; // "translate(200px, 200px) scale(0.55)"
 * ```
 */
export function arcToTarget(from: ScreenPoint, target: ScreenPoint): FlightFrame[] {
  const peak = { x: (from.x + target.x) / 2, y: Math.min(from.y, target.y) - FLIGHT_PEAK_RISE };
  return [
    { transform: placeAt(from) },
    { transform: placeAt(peak), offset: FLIGHT_PEAK_OFFSET },
    { transform: `${placeAt(target)} scale(${FLIGHT_LANDING_SCALE})` }
  ];
}

/**
 * A straight flight between two points: a dragged piece let go away from the kernel flies home
 * to its tray card.
 *
 * @param from - Where it starts.
 * @param to - Where it ends.
 * @returns Two keyframes.
 * @example
 * ```ts
 * straightFlight({ x: 0, y: 0 }, { x: 10, y: 20 });
 * // [{ transform: "translate(0px, 0px)" }, { transform: "translate(10px, 20px)" }]
 * ```
 */
export function straightFlight(from: ScreenPoint, to: ScreenPoint): FlightFrame[] {
  return [{ transform: placeAt(from) }, { transform: placeAt(to) }];
}
