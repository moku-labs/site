/**
 * @file The meta row under a docs title: Copy as Markdown and the sync badges.
 */
import type { ComponentChildren, VNode } from "preact";

/** Props of {@link DocumentMeta}. */
type DocumentMetaProperties = {
  /** URL of the page's Markdown twin. */
  markdownUrl: string;
  /** The sync badges after the button. */
  children: ComponentChildren;
};

/**
 * The meta row of a docs page or the docs hub. "Copy as Markdown" is the `copy-page` island.
 *
 * @param props - Component props.
 * @returns The `<div data-component="doc-meta">`.
 * @example
 * ```tsx
 * <DocumentMeta markdownUrl="/docs/web/guides/routing.md">
 *   <PageSyncBadge release="@moku-labs/web v2.4.11" checked="2026-11-02" drift={undefined} />
 * </DocumentMeta>
 * ```
 */
export function DocumentMeta(props: DocumentMetaProperties): VNode {
  return (
    <div data-component="doc-meta">
      <div data-part="actions">
        <button
          type="button"
          data-island="copy-page"
          data-part="action"
          data-markdown-url={props.markdownUrl}
        >
          Copy as Markdown
        </button>
      </div>
      {props.children}
    </div>
  );
}
