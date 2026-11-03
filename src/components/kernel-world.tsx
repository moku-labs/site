/**
 * @file The hero world (design §7): three stepped platforms (the kernel's ground, the framework's
 * middle ring, your app's outer ring), the pink kernel, the framework block with its standing
 * plugins, the sockets of a goal's pieces, the scenery, the brackets, the arcs and the labels.
 * Drawn at build in the first-paint state; the `kernel-world` island redraws the scene part from
 * the same nodes of `src/lib/hero-view.ts`.
 */
import type { ComponentChild, VNode } from "preact";
import { h } from "preact";
import { assemblyText } from "../data/assembly";
import type { SvgChild, SvgNode } from "../lib/hero-view";
import { KERNEL_GLOW_ID, platformNodes } from "../lib/hero-view";
import {
  ARC_STROKE,
  HOVER_LIFT,
  PHONE_ARC_STROKE,
  PHONE_WINDOW,
  WORLD_FRAME,
  WORLD_VIEW_BOX,
  windowFraming
} from "../lib/hero-world";

/** Props of {@link KernelWorld}. */
type KernelWorldProperties = {
  /** The scene of the first paint, from `worldScene`. */
  scene: readonly SvgNode[];
};

/**
 * One node of the drawing as a Preact element.
 *
 * @param child - An element node or a run of text.
 * @param key - Its index among its siblings.
 * @returns The element, or the text.
 * @example
 * ```tsx
 * <g data-part="scene">{scene.map((node, index) => svgVNode(node, index))}</g>
 * ```
 */
export function svgVNode(child: SvgChild, key: number): ComponentChild {
  if (typeof child === "string") return child;
  return h(
    child.tag,
    { ...child.attributes, key },
    ...child.children.map((node, index) => svgVNode(node, index))
  );
}

/**
 * The hero world SVG. It scales to its container's width; on a phone the CSS shows the
 * platform's width only (`--phone-width`, `--phone-shift`).
 *
 * @param props - Component props.
 * @param props.scene - The scene of the first paint, from `worldScene`; the island redraws it.
 * @returns The `<svg data-part="world">`.
 * @example
 * ```tsx
 * <KernelWorld scene={worldScene({ goal, state, versions, motion: { intro: true } })} />
 * ```
 */
export function KernelWorld(props: KernelWorldProperties): VNode {
  const framing = windowFraming(PHONE_WINDOW);
  return (
    // biome-ignore lint/a11y/useSemanticElements: an SVG drawing cannot be a fieldset; group names the set of focusable cubes
    <svg
      data-part="world"
      viewBox={WORLD_VIEW_BOX}
      style={{
        "--phone-width": `${framing.width}%`,
        "--phone-shift": `${framing.shift}%`,
        "--hover-lift": `${-HOVER_LIFT}px`,
        "--arc-stroke": ARC_STROKE,
        "--arc-stroke-phone": PHONE_ARC_STROKE,
        "--world-ratio": WORLD_FRAME.width / WORLD_FRAME.height
      }}
      role="group"
      aria-label={assemblyText.world}
    >
      <defs>
        <radialGradient id={KERNEL_GLOW_ID}>
          <stop data-part="glow-stop" offset="0" stop-opacity="0.32" />
          <stop data-part="glow-stop" offset="1" stop-opacity="0" />
        </radialGradient>
      </defs>
      <g data-part="platform">{platformNodes().map((node, index) => svgVNode(node, index))}</g>
      <g data-part="scene">{props.scene.map((node, index) => svgVNode(node, index))}</g>
    </svg>
  );
}
