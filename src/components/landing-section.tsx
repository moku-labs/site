/**
 * @file The shell of a landing section: a rule on top, a big heading and a lede.
 */
import type { ComponentChildren, VNode } from "preact";

/** Props of {@link LandingSection}. */
type LandingSectionProperties = {
  /** Anchor id, e.g. `packages` for `/#packages`. */
  id: string;
  /** The section heading. */
  title: string;
  /** The line under the heading. */
  lede: ComponentChildren;
  /** The section body. */
  children: ComponentChildren;
  /** A second column beside the heading (the Claude section's prompts). */
  aside?: ComponentChildren;
};

/**
 * A landing section (A1): 104px of air, a hairline on top, the content width of the site. With
 * an `aside`, the heading column and the aside sit side by side.
 *
 * @param props - Component props.
 * @returns The `<section data-component="landing-section">`.
 * @example
 * ```tsx
 * <LandingSection id="checks" title="The kernel says no before your users do." lede="…">…</LandingSection>
 * ```
 */
export function LandingSection(props: LandingSectionProperties): VNode {
  return (
    <section data-component="landing-section" id={props.id} aria-labelledby={`${props.id}-title`}>
      <div data-wrap data-split={props.aside === undefined ? undefined : ""}>
        <div>
          <h2 id={`${props.id}-title`}>{props.title}</h2>
          <p data-part="lede">{props.lede}</p>
          {props.children}
        </div>
        {props.aside === undefined ? undefined : <div data-part="aside">{props.aside}</div>}
      </div>
    </section>
  );
}
