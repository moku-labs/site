/** @file A skeleton page body, replaced screen by screen in the UI waves. */
import type { VNode } from "preact";

/**
 * A placeholder page body with a title, rendered into the layout's swap region.
 *
 * @param props - Component props.
 * @param props.name - Page name, also used as the `data-page` value.
 * @param props.title - Visible heading.
 * @returns The page markup.
 * @example
 * ```tsx
 * <PlaceholderPage name="demos" title="Demos" />
 * ```
 */
export function PlaceholderPage(props: { name: string; title: string }): VNode {
  return (
    <section data-page={props.name}>
      <h1>{props.title}</h1>
    </section>
  );
}
