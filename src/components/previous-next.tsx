/**
 * @file The previous / next cards at the end of a docs page.
 */
import type { VNode } from "preact";
import type { DocumentLink } from "../plugins/docs/types";

/** Props of {@link PreviousNext}. */
type PreviousNextProperties = {
  /** The previous page, or `undefined` at the start. */
  previous: DocumentLink | undefined;
  /** The next page, or `undefined` at the end. */
  next: DocumentLink | undefined;
};

/**
 * Two cards linking the neighbouring pages; a missing side keeps its grid cell empty.
 *
 * @param props - Component props.
 * @returns The `<nav data-component="previous-next">`.
 * @example
 * ```tsx
 * <PreviousNext previous={{ path: "/docs/web/quick-start/", title: "Quick start" }} next={undefined} />
 * ```
 */
export function PreviousNext(props: PreviousNextProperties): VNode {
  const { previous, next } = props;
  return (
    <nav data-component="previous-next" aria-label="Previous and next">
      {previous ? (
        <a href={previous.path} data-direction="previous">
          <small>Previous</small>← {previous.title}
        </a>
      ) : (
        <span data-part="empty" />
      )}
      {next ? (
        <a href={next.path} data-direction="next">
          <small>Next</small>
          {next.title} →
        </a>
      ) : (
        <span data-part="empty" />
      )}
    </nav>
  );
}
