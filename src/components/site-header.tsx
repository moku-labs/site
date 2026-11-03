/**
 * @file The sticky site header: logo, main links, search, theme and the mobile menu.
 */
import type { VNode } from "preact";
import { LINKS, SITE } from "../config";
import type { UrlBuilder } from "../lib/url-builder";
import { CubeIcon } from "./cube-icon";
import { SearchIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

/** One link of the main nav. */
type NavLink = {
  /** Matches the route's `meta.nav` for the active underline. */
  id: string;
  /** Visible label. */
  label: string;
  /** Target URL. */
  href: string;
  /** Opens in a new tab: an outbound link. */
  external?: boolean;
};

/** Props of {@link SiteHeader}. */
type SiteHeaderProperties = {
  /** `meta.nav` of the current route, or `undefined` for none. */
  active: string | undefined;
  /** Route link builder. */
  url: UrlBuilder;
};

/**
 * The main nav links in display order.
 *
 * @param url - Route link builder.
 * @returns The links.
 */
function navLinks(url: UrlBuilder): NavLink[] {
  return [
    { id: "docs", label: "Docs", href: url("docsHub") },
    { id: "packages", label: "Packages", href: `${url("home")}#packages` },
    { id: "demos", label: "Demos", href: url("demos") },
    { id: "about", label: "About", href: url("about") },
    { id: "github", label: "GitHub", href: LINKS.github, external: true }
  ];
}

/**
 * The site header. Persistent across SPA navigation: the `site-nav` island keeps the active link
 * and the mobile menu in sync.
 *
 * @param props - Component props.
 * @returns The `<header>`.
 * @example
 * ```tsx
 * <SiteHeader active="docs" url={ctx.url} />
 * ```
 */
export function SiteHeader(props: SiteHeaderProperties): VNode {
  const { url } = props;
  return (
    <header data-component="site-header" data-island="site-nav">
      <div data-part="bar">
        <a data-part="logo" href={url("home")} aria-label={`${SITE.name} home`}>
          <CubeIcon tone="kernel" size={28} />
          <span>Moku</span>
        </a>
        <nav aria-label="Main">
          {/* A manual popover: the burger's popovertarget opens and closes it before the island
              hydrates, with no light-dismiss race on the burger's own tap. */}
          <ul id="site-menu" data-part="links" popover="manual">
            {navLinks(url).map(link => (
              <li key={link.id}>
                <a
                  href={link.href}
                  data-nav={link.id}
                  aria-current={link.id === props.active ? "page" : undefined}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener" : undefined}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" data-part="search" data-search-open>
          <SearchIcon size={15} />
          <span data-part="label">Search docs</span>
          <kbd>⌘K</kbd>
        </button>
        <ThemeToggle />
        <button
          type="button"
          data-part="burger"
          popovertarget="site-menu"
          aria-controls="site-menu"
        >
          Menu
        </button>
      </div>
    </header>
  );
}
