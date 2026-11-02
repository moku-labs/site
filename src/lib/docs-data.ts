/**
 * @file Build-time data of the docs hub and the docs pages.
 *
 * Node only: package versions come from `node_modules`. `routes.tsx` imports this module lazily
 * inside its loaders, which run only at build, so the client bundle never loads it. Everything a
 * page renders is in the returned view, which the build also writes as the page's data sidecar.
 */
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { PipelineDiagram } from "../components/pipeline-diagram";
import { LINKS } from "../config";
import type { PackageGroup } from "../data/packages";
import { packages } from "../data/packages";
import type {
  DocumentationApi,
  DocumentHeading,
  DocumentLink,
  DocumentPage,
  NavGroup
} from "../plugins/docs/types";
import { markdownPathOf } from "../plugins/llms/render";
import { expandDiagrams } from "./diagrams";
import type { ResolvedPackage } from "./packages";
import { resolvePackages } from "./packages";

/** Package id of the core concepts pages. They document the kernel, so `core` is their release. */
const CONCEPTS = "concepts";

/** Package whose release and icon the concepts pages show. */
const CONCEPTS_RELEASE = "core";

/** Path of the docs hub. */
const HUB_PATH = "/docs/";

/** Package id and file name of the "What the kernel checks" page, linked from every sidebar. */
const KERNEL_CHECKS_PATH = "/docs/concepts/kernel-checks/";

/** The drawings of the `::diagram{name}` figures, rendered once on first use. */
let drawings: Readonly<Record<string, string>> | undefined;

/**
 * The SVG markup of every docs diagram, by name.
 *
 * @returns The drawings.
 */
function diagramDrawings(): Readonly<Record<string, string>> {
  drawings ??= { pipeline: renderToString(h(PipelineDiagram, {})) };
  return drawings;
}

/** What the loaders read besides the docs plugin: the resolved family and the check date. */
export type DocumentationSources = {
  /** The package family in display order, each with its installed version. */
  packages: readonly ResolvedPackage[];
  /** Date of this build, `YYYY-MM-DD`: the snippet checks ran in the same CI run. */
  today: string;
};

/** A package as the docs show it. */
export type DocumentationPackage = {
  /** Package id, or `concepts`. */
  id: string;
  /** Display name, e.g. `@moku-labs/web`. */
  name: string;
  /** Installed version. */
  version: string;
  /** The version as the docs show it, e.g. `moku 0.85.6` or `2.4.11`. */
  versionLabel: string;
  /** `<npm> v<version>` (release name or display name off npm), checked against by the pages. */
  release: string;
  /** One-line tagline. */
  tagline: string;
  /** Docs group. */
  group: PackageGroup;
  /** Package id whose icon stands for this package. */
  icon: string;
  /** Path of the package's docs home, or `undefined` while it has no docs pages. */
  home?: string;
  /** Drift note of the first page of the package that has one. */
  drift?: string;
};

/** A concepts card of the docs hub. */
export type DocumentationConceptCard = {
  /** Page path. */
  path: string;
  /** File name without extension, picks the card glyph. */
  slug: string;
  /** Page title. */
  title: string;
  /** Page description. */
  description: string;
  /** Whether the page is a full reference page. */
  full: boolean;
};

/** One group card of the docs hub. */
export type DocumentationPackageGroup = {
  /** Group label. */
  label: PackageGroup;
  /** Packages of the group in family order. */
  packages: readonly DocumentationPackage[];
};

/** Everything the docs hub renders. */
export type DocumentationHubView = {
  /** The concepts pages in nav order. */
  concepts: readonly DocumentationConceptCard[];
  /** The family by group, in family order. */
  groups: readonly DocumentationPackageGroup[];
  /** Number of packages in the family. */
  packageCount: number;
  /** Packages that have a drift note. */
  drifts: readonly DocumentationPackage[];
  /** Check date. */
  checked: string;
  /** URL of the hub's Markdown twin, `/docs.md`. */
  markdownUrl: string;
};

/** The parts of a docs page its view renders. */
export type DocumentationPageContent = Pick<
  DocumentPage,
  "path" | "pkg" | "slug" | "title" | "description" | "group" | "html" | "full"
> & {
  /** Section folder, absent for top-level pages. */
  section?: string;
  /** h2/h3 headings for the TOC. */
  headings: readonly DocumentHeading[];
  /** Drift note, absent when the page is in sync. */
  drift?: string;
  /** URL of the page's Markdown twin, e.g. `/docs/web/guides/routing.md`. */
  markdownUrl: string;
  /** "Edit on GitHub" link to the source file. */
  editUrl: string;
};

/** Everything a docs page renders. */
export type DocumentationPageView = {
  /** The page. */
  page: DocumentationPageContent;
  /** `<title>` text before the site template. */
  headTitle: string;
  /** The package the page belongs to; `concepts` carries the core release. */
  package: DocumentationPackage;
  /** The family for the package switcher. */
  packages: readonly DocumentationPackage[];
  /** Sidebar groups of the package. */
  nav: readonly NavGroup[];
  /** Previous page, when there is one. */
  prev?: DocumentLink;
  /** Next page, when there is one. */
  next?: DocumentLink;
  /** The "What the kernel checks" page, when it exists. */
  kernelChecks?: DocumentLink;
  /** Check date. */
  checked: string;
};

/** Route params of the three docs routes. */
export type DocumentationParameters = {
  /** Package id or `concepts`. */
  pkg: string;
  /** Section folder (depth 3 only). */
  section?: string;
  /** Page file name (depth 2 and 3). */
  page?: string;
};

/**
 * The docs URL path of a docs route's params; the same mapping the docs plugin uses for files.
 *
 * @param params - Params of `/docs/{pkg}/`, `/docs/{pkg}/{page}/` or `/docs/{pkg}/{section}/{page}/`.
 * @returns The page path with a trailing slash.
 * @example
 * ```ts
 * docsPathOf({ pkg: "web", section: "guides", page: "routing" }); // "/docs/web/guides/routing/"
 * ```
 */
export function docsPathOf(params: DocumentationParameters): string {
  const segments = [params.pkg, params.section, params.page].filter(Boolean);
  return `/docs/${segments.join("/")}/`;
}

/**
 * The real sources: the family from `src/data/packages.ts` with versions from `node_modules`, and
 * today's date.
 *
 * @param nodeModulesDirectory - Directory holding the installed packages.
 * @param now - The build time.
 * @returns The sources for the loaders.
 * @throws {Error} When a package of the family is not installed.
 * @example
 * ```ts
 * const sources = installedSources();
 * sources.packages.find(entry => entry.id === "web")?.version; // "2.4.11"
 * ```
 */
export function installedSources(
  nodeModulesDirectory = "node_modules",
  now = new Date()
): DocumentationSources {
  return {
    packages: resolvePackages(packages, nodeModulesDirectory),
    today: now.toISOString().slice(0, 10)
  };
}

/**
 * The home page of each package: its index page, or its first page when it has none.
 *
 * @param pages - Every docs page in nav order.
 * @returns Home path by package id.
 */
function homesOf(pages: readonly DocumentPage[]): Map<string, string> {
  const homes = new Map<string, string>();
  for (const page of pages) {
    const isIndex = page.slug === "index" && page.section === undefined;
    if (isIndex || !homes.has(page.pkg)) homes.set(page.pkg, page.path);
  }
  return homes;
}

/**
 * The first drift note of each package.
 *
 * @param pages - Every docs page in nav order.
 * @returns Drift note by package id.
 */
function driftsOf(pages: readonly DocumentPage[]): Map<string, string> {
  const drifts = new Map<string, string>();
  for (const page of pages) {
    if (page.drift !== undefined && !drifts.has(page.pkg)) drifts.set(page.pkg, page.drift);
  }
  return drifts;
}

/**
 * Turn the resolved family into docs packages with their home and drift.
 *
 * @param sources - The resolved family.
 * @param pages - Every docs page in nav order.
 * @returns The docs packages in family order.
 */
function docsPackages(
  sources: DocumentationSources,
  pages: readonly DocumentPage[]
): DocumentationPackage[] {
  const homes = homesOf(pages);
  const drifts = driftsOf(pages);
  return sources.packages.map(entry => {
    const docsPackage: DocumentationPackage = {
      id: entry.id,
      name: entry.name,
      version: entry.version,
      versionLabel: entry.versionLabel,
      release: `${entry.releaseName ?? entry.npm ?? entry.name} v${entry.version}`,
      tagline: entry.tagline,
      group: entry.group,
      icon: entry.id
    };
    const home = homes.get(entry.id);
    const drift = drifts.get(entry.id);
    if (home !== undefined) docsPackage.home = home;
    if (drift !== undefined) docsPackage.drift = drift;
    return docsPackage;
  });
}

/**
 * The package a page belongs to. The concepts pages get the core release under their own name.
 *
 * @param family - The docs packages.
 * @param pkg - The page's package id.
 * @returns The package.
 * @throws {Error} When the id is neither `concepts` nor in the family.
 */
function packageOfPage(family: readonly DocumentationPackage[], pkg: string): DocumentationPackage {
  const own = family.find(entry => entry.id === (pkg === CONCEPTS ? CONCEPTS_RELEASE : pkg));
  if (own === undefined) {
    throw new Error(
      `[site] Docs package "${pkg}" is not in the family.\n  Add it to src/data/packages.ts.`
    );
  }
  if (pkg !== CONCEPTS) return own;
  const { version, versionLabel, release, group, icon } = own;
  return {
    id: CONCEPTS,
    name: "Concepts",
    version,
    versionLabel,
    release,
    tagline: "",
    group,
    icon
  };
}

/**
 * Group packages by their docs group, groups in the order they first appear.
 *
 * @param family - The docs packages in family order.
 * @returns The groups.
 */
function groupPackages(family: readonly DocumentationPackage[]): DocumentationPackageGroup[] {
  const groups = new Map<PackageGroup, DocumentationPackage[]>();
  for (const entry of family) {
    const members = groups.get(entry.group) ?? [];
    members.push(entry);
    groups.set(entry.group, members);
  }
  return [...groups].map(([label, members]) => ({ label, packages: members }));
}

/**
 * Load the docs hub: concepts cards, the family by group with versions, homes and drift.
 *
 * @param docs - The docs plugin API.
 * @param sources - The resolved family and the check date.
 * @returns The hub view.
 * @example
 * ```ts
 * // route("/docs/").load(async ctx => loadDocumentationHub(ctx.require(docsReference), installedSources()))
 * const hub = await loadDocumentationHub(app.docs, installedSources());
 * hub.groups.map(group => group.label); // ["Start", "Core", "Frameworks", "Native", "Game", "Tooling"]
 * ```
 */
export async function loadDocumentationHub(
  docs: DocumentationApi,
  sources: DocumentationSources
): Promise<DocumentationHubView> {
  const pages = await docs.all();
  const family = docsPackages(sources, pages);
  const concepts = pages
    .filter(page => page.pkg === CONCEPTS)
    .map(({ path, slug, title, description, full }) => ({ path, slug, title, description, full }));
  return {
    concepts,
    groups: groupPackages(family),
    packageCount: family.length,
    drifts: family.filter(entry => entry.drift !== undefined),
    checked: sources.today,
    markdownUrl: `/${markdownPathOf(HUB_PATH)}`
  };
}

/**
 * The view fields of a page: rendered parts with their diagrams drawn, Markdown twin and edit
 * link.
 *
 * @param page - The docs page.
 * @returns The page content of the view.
 */
function pageContent(page: DocumentPage): DocumentationPageContent {
  const { path, pkg, slug, title, description, group, html, full, headings, section, drift } = page;
  const content: DocumentationPageContent = {
    path,
    pkg,
    slug,
    title,
    description,
    group,
    html: expandDiagrams(html, diagramDrawings()),
    full,
    headings,
    markdownUrl: `/${markdownPathOf(path)}`,
    editUrl: `${LINKS.repository}/edit/main/${page.file}`
  };
  if (section !== undefined) content.section = section;
  if (drift !== undefined) content.drift = drift;
  return content;
}

/** Sidebar label of a package's index page; the page itself keeps the package name as title. */
const OVERVIEW_LABEL = "Overview";

/**
 * The sidebar groups with the package's index page labelled "Overview".
 *
 * @param nav - The sidebar groups from the docs plugin.
 * @param pkg - The package id.
 * @returns The groups, the index link relabelled.
 */
function sidebarNav(nav: readonly NavGroup[], pkg: string): NavGroup[] {
  const indexPath = docsPathOf({ pkg });
  return nav.map(group => ({
    label: group.label,
    pages: group.pages.map(link =>
      link.path === indexPath ? { ...link, title: OVERVIEW_LABEL } : link
    )
  }));
}

/**
 * The `<title>` text of a docs page before the site template. A package's index page is titled
 * with the package name, so it is not repeated; the concepts pages carry no package name.
 *
 * @param title - The page title.
 * @param pkg - The page's package id.
 * @param packageName - Display name of the page's package.
 * @returns `Routing · @moku-labs/web`, or the bare title.
 */
function headTitleOf(title: string, pkg: string, packageName: string): string {
  return pkg === CONCEPTS || title === packageName ? title : `${title} · ${packageName}`;
}

/**
 * Load one docs page with its sidebar, prev/next, package and the family for the switcher.
 *
 * @param docs - The docs plugin API.
 * @param params - The route params.
 * @param sources - The resolved family and the check date.
 * @returns The page view.
 * @throws {Error} When no docs page maps to the params.
 * @example
 * ```ts
 * // route("/docs/{pkg}/{page}/").load(async ctx => loadDocumentationPage(ctx.require(docsReference), ctx.params, installedSources()))
 * const view = await loadDocumentationPage(app.docs, { pkg: "web", page: "quick-start" }, installedSources());
 * view.package.release; // "@moku-labs/web v2.4.11"
 * ```
 */
export async function loadDocumentationPage(
  docs: DocumentationApi,
  params: DocumentationParameters,
  sources: DocumentationSources
): Promise<DocumentationPageView> {
  const path = docsPathOf(params);
  const [page, pages, kernelChecks] = await Promise.all([
    docs.get(path),
    docs.all(),
    docs.get(KERNEL_CHECKS_PATH)
  ]);
  if (page === undefined) {
    throw new Error(
      `[site] No docs page at ${path}.\n  Check that the docs route params come from docs.params().`
    );
  }
  const [nav, neighbours] = await Promise.all([docs.nav(page.pkg), docs.neighbours(path)]);
  const family = docsPackages(sources, pages);
  const own = packageOfPage(family, page.pkg);
  const view: DocumentationPageView = {
    page: pageContent(page),
    headTitle: headTitleOf(page.title, page.pkg, own.name),
    package: own,
    packages: family,
    nav: sidebarNav(nav, page.pkg),
    checked: sources.today
  };
  if (neighbours.prev) view.prev = neighbours.prev;
  if (neighbours.next) view.next = neighbours.next;
  if (kernelChecks) view.kernelChecks = { path: kernelChecks.path, title: kernelChecks.title };
  return view;
}
