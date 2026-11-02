/**
 * @file The site chrome around every page: skip link, header, the swap region and footer.
 */
import type { ComponentChildren, VNode } from "preact";
import type { UrlBuilder } from "../lib/url-builder";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Props of {@link SiteLayout}. */
type SiteLayoutProperties = {
  /** `meta.nav` of the route, or `undefined`. */
  nav: string | undefined;
  /** Route link builder. */
  url: UrlBuilder;
  /** The page, rendered into the swap region. */
  children: ComponentChildren;
};

/** The part of the route context the layout reads; the framework's layout context fits it. */
type LayoutContext = {
  /** The route's `.meta()` bag; `nav` names the active header link. */
  meta: Record<string, unknown>;
  /** Route link builder. */
  url: UrlBuilder;
};

/**
 * The chrome of every page. The SPA swaps `main > section`, so the page goes inside that
 * section and the header and footer persist across navigation.
 *
 * @param props - Component props.
 * @returns The skip link, header, `<main>` and footer.
 * @example
 * ```tsx
 * <SiteLayout nav="docs" url={ctx.url}>
 *   <DocumentationPage view={ctx.data} url={ctx.url} />
 * </SiteLayout>
 * ```
 */
export function SiteLayout(props: SiteLayoutProperties): VNode {
  return (
    <>
      <a data-component="skip-link" href="#content">
        Skip to content
      </a>
      <SiteHeader active={props.nav} url={props.url} />
      <main id="content" tabIndex={-1}>
        <section>{props.children}</section>
      </main>
      <SiteFooter url={props.url} />
    </>
  );
}

/**
 * The route `.layout()` of every page: {@link SiteLayout} with the route's `meta.nav`.
 *
 * @param ctx - The route's layout context.
 * @param children - The rendered page.
 * @returns The page in the site chrome.
 * @example
 * ```tsx
 * route("/about/").layout(siteLayout).render(() => <AboutPage />).meta({ nav: "about" });
 * ```
 */
export function siteLayout(ctx: LayoutContext, children: ComponentChildren): VNode {
  const nav = typeof ctx.meta.nav === "string" ? ctx.meta.nav : undefined;
  return (
    <SiteLayout nav={nav} url={ctx.url}>
      {children}
    </SiteLayout>
  );
}
