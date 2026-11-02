/**
 * @file The meta row under a docs title: Copy as Markdown, the `.md` twin, llms.txt, sync badges.
 */
import type { ComponentChildren, VNode } from "preact";
import { LINKS } from "../config";

/** Props of {@link DocumentMeta}. */
type DocumentMetaProperties = {
  /** URL of the page's Markdown twin. */
  markdownUrl: string;
  /** The sync badges after the links. */
  children: ComponentChildren;
};

/**
 * The meta row of a docs page or the docs hub. "Copy as Markdown" is the `copy-page` island; the
 * agent files open in a new tab because they are plain text, not pages.
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
  const fileName = props.markdownUrl.split("/").at(-1);
  return (
    <div data-component="doc-meta">
      <button
        type="button"
        data-island="copy-page"
        data-part="action"
        data-markdown-url={props.markdownUrl}
      >
        Copy as Markdown
      </button>
      <a data-part="action" href={props.markdownUrl} target="_blank" rel="noopener">
        {fileName}
      </a>
      <a data-part="action" href={LINKS.llms} target="_blank" rel="noopener">
        llms.txt
      </a>
      {props.children}
    </div>
  );
}
