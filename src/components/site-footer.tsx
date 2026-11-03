/**
 * @file The site footer: identity line, link columns and the bottom line.
 */
import type { VNode } from "preact";
import { LINKS, SITE } from "../config";
import type { UrlBuilder } from "../lib/url-builder";
import { CubeIcon } from "./cube-icon";

/** One footer link. */
type FooterLink = {
  /** Visible label. */
  label: string;
  /** Target URL. */
  href: string;
  /** Opens in a new tab. */
  external?: boolean;
};

/** One footer column. */
type FooterColumn = {
  /** Column heading. */
  title: string;
  /** Links in display order. */
  links: readonly FooterLink[];
};

/**
 * The footer columns.
 *
 * @param url - Route link builder.
 * @returns Site, For agents and Elsewhere.
 */
function footerColumns(url: UrlBuilder): FooterColumn[] {
  return [
    {
      title: "Site",
      links: [
        { label: "Docs", href: url("docsHub") },
        { label: "Packages", href: `${url("home")}#packages` },
        { label: "Demos", href: url("demos") },
        { label: "About", href: url("about") }
      ]
    },
    {
      title: "For agents",
      links: [
        { label: "llms.txt", href: LINKS.llms, external: true },
        { label: "llms-full.txt", href: LINKS.llmsFull, external: true }
      ]
    },
    {
      title: "Elsewhere",
      links: [
        { label: "GitHub", href: LINKS.github, external: true },
        { label: new URL(LINKS.blog).host, href: LINKS.blog, external: true }
      ]
    }
  ];
}

/**
 * The site footer. Docs pages give it the docs surface (see the sheet).
 *
 * @param props - Component props.
 * @param props.url - Route link builder.
 * @returns The `<footer>`.
 * @example
 * ```tsx
 * <SiteFooter url={ctx.url} />
 * ```
 */
export function SiteFooter(props: { url: UrlBuilder }): VNode {
  return (
    <footer data-component="site-footer">
      <div data-part="inner">
        <div data-part="columns">
          <div data-part="brand">
            <a data-part="logo" href={props.url("home")}>
              <CubeIcon tone="kernel" size={26} />
              <span>Moku</span>
            </a>
            <p>
              Moku Labs builds Moku, an agentic TypeScript framework for reliable software written
              with LLMs.
            </p>
          </div>
          {footerColumns(props.url).map(column => (
            <div key={column.title}>
              <h2>{column.title}</h2>
              <ul>
                {column.links.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener" : undefined}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div data-part="bottom">
          <span>
            © {new Date().getFullYear()} {SITE.name}
          </span>
          <span>Built with @moku-labs/web.</span>
        </div>
      </div>
    </footer>
  );
}
