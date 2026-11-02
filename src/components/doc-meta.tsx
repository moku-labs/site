/**
 * @file The meta row under a docs title: Copy as Markdown, the `.md` twin, llms.txt, sync badge.
 */
import type { VNode } from "preact";
import { LINKS } from "../config";
import { PageSyncBadge } from "./sync-badge";

/** Props of {@link DocumentMeta}. */
type DocumentMetaProperties = {
  /** URL of the page's Markdown twin. */
  markdownUrl: string;
  /** The release the page is checked against. */
  release: string;
  /** Check date. */
  checked: string;
  /** Drift note of the page, or `undefined` when in sync. */
  drift: string | undefined;
};

/**
 * The meta row of a docs page. "Copy as Markdown" is the `copy-page` island; the agent files
 * open in a new tab because they are plain text, not pages.
 *
 * @param props - Component props.
 * @returns The `<div data-component="doc-meta">`.
 * @example
 * ```tsx
 * <DocumentMeta markdownUrl="/docs/web/guides/routing.md" release="@moku-labs/web@2.4.11" checked="2026-11-02" drift={undefined} />
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
      <PageSyncBadge release={props.release} checked={props.checked} drift={props.drift} />
    </div>
  );
}
