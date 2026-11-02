/**
 * @file The docs sheet: a 1400px surface with side rules and three columns.
 */
import type { ComponentChildren, VNode } from "preact";

/** Props of {@link DocumentationLayout}. */
type DocumentationLayoutProperties = {
  /** Left column, 268px: the sidebar. */
  sidebar: ComponentChildren;
  /** Right column, 220px: the table of contents. */
  toc: ComponentChildren;
  /** Middle column: the article. */
  children: ComponentChildren;
};

/**
 * The docs page grid: nav / content (max 880px) / TOC. The TOC hides under 1200px; under 860px
 * the page is one column with the sidebar collapsed on top.
 *
 * It is part of the page, inside the swap region, so a client navigation between docs pages
 * updates the sidebar and the TOC with the article.
 *
 * @param props - Component props.
 * @returns The `<div data-component="docs-layout">`.
 * @example
 * ```tsx
 * <DocumentationLayout sidebar={<DocumentationSidebar {...sidebar} />} toc={<DocumentationToc {...toc} />}>
 *   <article>…</article>
 * </DocumentationLayout>
 * ```
 */
export function DocumentationLayout(props: DocumentationLayoutProperties): VNode {
  return (
    <div data-component="docs-layout">
      {props.sidebar}
      {props.children}
      {props.toc}
    </div>
  );
}
