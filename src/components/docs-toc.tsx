/**
 * @file The "On this page" column of a docs page, paired with the `toc-spy` island.
 */
import type { VNode } from "preact";
import { LINKS } from "../config";
import type { DocumentHeading } from "../plugins/docs/types";

/** Props of {@link DocumentationToc}. */
type DocumentationTocProperties = {
  /** h2/h3 headings of the page in document order. */
  headings: readonly DocumentHeading[];
  /** URL of the page's Markdown twin. */
  markdownUrl: string;
  /** "Edit on GitHub" link. */
  editUrl: string;
};

/**
 * The table of contents (B4): heading links, then the agent and edit links. The `toc-spy`
 * island marks the heading in view.
 *
 * @param props - Component props.
 * @returns The `<aside data-component="docs-toc">`.
 * @example
 * ```tsx
 * <DocumentationToc headings={view.page.headings} markdownUrl={view.page.markdownUrl} editUrl={view.page.editUrl} />
 * ```
 */
export function DocumentationToc(props: DocumentationTocProperties): VNode {
  return (
    <aside data-component="docs-toc" data-island="toc-spy" aria-label="On this page">
      {props.headings.length > 0 ? (
        <>
          <p data-part="title">On this page</p>
          <ul>
            {props.headings.map(heading => (
              <li key={heading.id} data-depth={heading.depth}>
                <a href={`#${heading.id}`}>{heading.text}</a>
              </li>
            ))}
          </ul>
        </>
      ) : undefined}
      <div data-part="meta">
        <a href={props.markdownUrl} target="_blank" rel="noopener">
          View as .md
        </a>
        <a href={LINKS.llms} target="_blank" rel="noopener">
          llms.txt
        </a>
        <a href={props.editUrl} target="_blank" rel="noopener">
          Edit on GitHub
        </a>
      </div>
    </aside>
  );
}
