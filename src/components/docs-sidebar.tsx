/**
 * @file The docs sidebar: package switcher, the package's page groups and "Elsewhere" links.
 */
import type { VNode } from "preact";
import type { DocumentationPackage } from "../lib/docs-data";
import type { UrlBuilder } from "../lib/url-builder";
import type { DocumentLink, NavGroup } from "../plugins/docs/types";
import { ChevronIcon, PackageIcon } from "./icons";

/** Props of {@link DocumentationSidebar}. */
type DocumentationSidebarProperties = {
  /** Path of the current page, marked with `aria-current`. */
  current: string;
  /** The package of the current page. */
  package: DocumentationPackage;
  /** The family for the switcher. */
  packages: readonly DocumentationPackage[];
  /** The package's page groups. */
  nav: readonly NavGroup[];
  /** The "What the kernel checks" page, when it exists. */
  kernelChecks: DocumentLink | undefined;
  /** Route link builder. */
  url: UrlBuilder;
};

/**
 * The package switcher (D3): a disclosure listing the family with icons.
 *
 * @param props - Component props.
 * @param props.current - The current package.
 * @param props.packages - The family.
 * @returns The `<details data-part="switcher">`.
 */
function PackageSwitcher(props: {
  current: DocumentationPackage;
  packages: readonly DocumentationPackage[];
}): VNode {
  const { current } = props;
  return (
    <details data-part="switcher">
      <summary>
        <PackageIcon id={current.icon} size={30} />
        <span>
          <b>{current.name}</b>
          <small>{current.version}</small>
        </span>
        <ChevronIcon />
      </summary>
      <ul>
        {props.packages.map(entry => (
          <li key={entry.id}>
            {entry.home === undefined ? (
              <span data-part="muted">
                <PackageIcon id={entry.icon} size={22} />
                {entry.name}
              </span>
            ) : (
              <a href={entry.home} aria-current={entry.id === current.id ? "true" : undefined}>
                <PackageIcon id={entry.icon} size={22} />
                {entry.name}
              </a>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * A list of page links with the current one marked.
 *
 * @param props - Component props.
 * @param props.links - The links.
 * @param props.current - Path of the current page.
 * @returns The `<ul>`.
 */
function PageList(props: { links: readonly DocumentLink[]; current: string }): VNode {
  return (
    <ul>
      {props.links.map(link => (
        <li key={link.path}>
          <a href={link.path} aria-current={link.path === props.current ? "page" : undefined}>
            {link.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The docs sidebar (B3). Under 860px it collapses into a "<package> pages" disclosure (C2);
 * wider, the sheet keeps the disclosure content always visible.
 *
 * @param props - Component props.
 * @returns The `<details data-component="docs-sidebar">`.
 * @example
 * ```tsx
 * <DocumentationSidebar current={view.page.path} package={view.package} packages={view.packages} nav={view.nav} kernelChecks={view.kernelChecks} url={url} />
 * ```
 */
export function DocumentationSidebar(props: DocumentationSidebarProperties): VNode {
  const elsewhere: DocumentLink[] = [{ path: props.url("docsHub"), title: "Docs home" }];
  // The concepts sidebar already lists the kernel-checks page.
  if (props.kernelChecks && props.package.id !== "concepts") elsewhere.push(props.kernelChecks);
  return (
    <details data-component="docs-sidebar">
      <summary>
        {props.package.name} pages
        <ChevronIcon />
      </summary>
      <nav aria-label={`${props.package.name} pages`}>
        <PackageSwitcher current={props.package} packages={props.packages} />
        {props.nav.map(group => (
          <div key={group.label} data-part="group">
            <h2>{group.label}</h2>
            <PageList links={group.pages} current={props.current} />
          </div>
        ))}
        <div data-part="group">
          <h2>Elsewhere</h2>
          <PageList links={elsewhere} current={props.current} />
        </div>
      </nav>
    </details>
  );
}
