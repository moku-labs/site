/**
 * @file The tooltip of the hero world and the pyramid (D1): name, version, tagline, action.
 */
import type { VNode } from "preact";

/**
 * An empty, hidden tooltip. The island of its section fills it from the hovered element's
 * `data-tip-*` attributes and places it above that element.
 *
 * @param props - Component props.
 * @param props.withArt - Leave room for a small art image (the pyramid shows package and demo art).
 * @returns The `<div role="tooltip">`.
 * @example
 * ```tsx
 * <WorldTip withArt />
 * ```
 */
export function WorldTip(props: { withArt?: boolean }): VNode {
  return (
    <div data-component="world-tip" role="tooltip" hidden>
      {props.withArt ? <img data-part="art" alt="" width={56} height={56} hidden /> : undefined}
      <div>
        <b data-part="title" />
        <span data-part="version" />
        <p data-part="text" />
        <em data-part="action" />
      </div>
    </div>
  );
}
