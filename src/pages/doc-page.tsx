/**
 * @file A docs page: sidebar, article (title, meta row, rendered Markdown, prev/next) and TOC.
 */
import type { VNode } from "preact";
import { CubeIcon, conceptGlyph } from "../components/cube-icon";
import { DocumentMeta } from "../components/doc-meta";
import { DocumentationLayout } from "../components/docs-layout";
import { DocumentationSidebar } from "../components/docs-sidebar";
import { DocumentationToc } from "../components/docs-toc";
import { PackageIcon } from "../components/icons";
import { PreviousNext } from "../components/previous-next";
import type { DocumentationPageView } from "../lib/docs-data";
import type { UrlBuilder } from "../lib/url-builder";

/** Props of {@link DocumentationPage}. */
type DocumentationPageProperties = {
  /** The page view loaded at build. */
  view: DocumentationPageView;
  /** Route link builder. */
  url: UrlBuilder;
};

/**
 * The breadcrumb trail: Docs / package / group. A package home stops at the package.
 *
 * @param props - Component props.
 * @returns The `<nav data-part="crumbs">`.
 */
function Breadcrumbs(props: DocumentationPageProperties): VNode {
  const { page, package: own } = props.view;
  const isHome = page.slug === "index" && page.section === undefined;
  return (
    <nav data-part="crumbs" aria-label="Breadcrumb">
      <a href={props.url("docsHub")}>Docs</a>
      {own.home === undefined || own.id === "concepts" ? (
        <span> / {own.name}</span>
      ) : (
        <>
          {" / "}
          <a href={own.home}>{own.name}</a>
        </>
      )}
      {isHome || own.id === "concepts" ? undefined : <span> / {page.group}</span>}
    </nav>
  );
}

/**
 * The art next to the title: the package cube on a package home, a glyph cube on a concept page.
 *
 * @param props - Component props.
 * @param props.view - The page view.
 * @returns The icon, or `undefined` for other pages.
 */
function TitleIcon(props: { view: DocumentationPageView }): VNode | undefined {
  const { page, package: own } = props.view;
  if (own.id === "concepts")
    return <CubeIcon tone="docs" glyph={conceptGlyph(page.slug)} size={40} />;
  if (page.slug === "index" && page.section === undefined) {
    return <PackageIcon id={own.icon} size={60} />;
  }
  return undefined;
}

/**
 * A docs page (A3–A10). The rendered Markdown is trusted HTML from the docs plugin; the
 * `code-block` island on the content root adds copy buttons, tabs and note markers.
 *
 * @param props - Component props.
 * @returns The page root, in docs mode.
 * @example
 * ```tsx
 * route("/docs/{pkg}/{page}/").render(ctx => <DocumentationPage view={ctx.data} url={ctx.url} />);
 * ```
 */
export function DocumentationPage(props: DocumentationPageProperties): VNode {
  const { view, url } = props;
  const { page } = view;
  return (
    <div data-page="doc" data-mode="docs">
      <DocumentationLayout
        sidebar={
          <DocumentationSidebar
            current={page.path}
            package={view.package}
            packages={view.packages}
            nav={view.nav}
            kernelChecks={view.kernelChecks}
            url={url}
          />
        }
        toc={
          <DocumentationToc
            headings={page.headings}
            markdownUrl={page.markdownUrl}
            editUrl={page.editUrl}
          />
        }
      >
        <article data-component="doc-article">
          <Breadcrumbs view={view} url={url} />
          <h1>
            <TitleIcon view={view} />
            <span>{page.title}</span>
          </h1>
          <p data-part="lead">{page.description}</p>
          <DocumentMeta
            markdownUrl={page.markdownUrl}
            release={view.package.release}
            checked={view.checked}
            drift={page.drift}
          />
          <div
            data-content
            data-island="code-block"
            dangerouslySetInnerHTML={{ __html: page.html }}
          />
          <PreviousNext previous={view.prev} next={view.next} />
        </article>
      </DocumentationLayout>
    </div>
  );
}
