/**
 * @file Types of the docs plugin.
 */

/** Plugin config. */
export type DocumentationConfig = {
  /** Root directory of the docs Markdown, relative to the project root. */
  dir: string;
};

/** A heading of a docs page, used by the "On this page" TOC. */
export type DocumentHeading = {
  /** Anchor id, the same one the renderer puts on the heading. */
  id: string;
  /** Heading text. */
  text: string;
  /** Heading level. */
  depth: 2 | 3;
};

/** One rendered docs page. */
export type DocumentPage = {
  /** URL path with a trailing slash, e.g. `/docs/web/guides/routing/`. */
  path: string;
  /** Package id or `concepts`. */
  pkg: string;
  /** Section folder (`guides`, `plugins`), or `undefined` for top-level pages. */
  section: string | undefined;
  /** File name without extension; `index` for a package home. */
  slug: string;
  /** Page title from frontmatter. */
  title: string;
  /** Page description from frontmatter. */
  description: string;
  /** Sort key inside its nav group. */
  order: number;
  /** Nav group label. */
  group: string;
  /** Manual drift note, or `undefined` when the page is in sync. */
  drift: string | undefined;
  /** Whether the page is marked as a full reference page. */
  full: boolean;
  /** Raw Markdown body, kernel-errors marker expanded. */
  markdown: string;
  /** Rendered HTML. */
  html: string;
  /** h2/h3 headings in document order. */
  headings: readonly DocumentHeading[];
  /** Source file relative to the project root. */
  file: string;
};

/** A link to a docs page. */
export type DocumentLink = {
  /** URL path. */
  path: string;
  /** Page title. */
  title: string;
};

/** One group of the package sidebar. */
export type NavGroup = {
  /** Group label, e.g. `Guides`. */
  label: string;
  /** Pages in display order. */
  pages: readonly DocumentLink[];
};

/** Plugin state. */
export type DocumentationState = {
  /** Pages by path, loaded lazily on the first API call. */
  pages: Map<string, DocumentPage> | undefined;
};

/** Public API mounted at `app.docs`. */
export type DocumentationApi = {
  /**
   * Every docs page, sorted by package order, nav group, `order`, then title.
   *
   * @returns All pages.
   * @example
   * ```ts
   * const pages = await app.docs.all();
   * pages.filter(page => page.pkg === "web").length; // 24
   * ```
   */
  all: () => Promise<DocumentPage[]>;
  /**
   * One page by URL path.
   *
   * @param path - URL path with a trailing slash.
   * @returns The page, or `undefined` when no file maps to the path.
   * @example
   * ```ts
   * const page = await app.docs.get("/docs/web/guides/routing/");
   * page?.title; // "Routing"
   * ```
   */
  get: (path: string) => Promise<DocumentPage | undefined>;
  /**
   * Every page of one package.
   *
   * @param pkg - Package id or `concepts`.
   * @returns The package's pages in nav order.
   * @example
   * ```ts
   * const concepts = await app.docs.byPackage("concepts");
   * concepts.map(page => page.slug); // ["three-layers", "plugins", ...]
   * ```
   */
  byPackage: (pkg: string) => Promise<DocumentPage[]>;
  /**
   * Sidebar groups of one package.
   *
   * @param pkg - Package id or `concepts`.
   * @returns Groups in first-seen section order.
   * @example
   * ```ts
   * const groups = await app.docs.nav("web");
   * groups.map(group => group.label); // ["Get started", "Guides", "Plugins", "API reference"]
   * ```
   */
  nav: (pkg: string) => Promise<NavGroup[]>;
  /**
   * Previous and next pages; at a package's ends, the neighbouring package's home.
   *
   * @param path - URL path of the current page.
   * @returns The neighbours that exist.
   * @example
   * ```ts
   * const { next } = await app.docs.neighbours("/docs/web/api/");
   * next?.path; // "/docs/worker/"
   * ```
   */
  neighbours: (path: string) => Promise<{ prev?: DocumentLink; next?: DocumentLink }>;
  /**
   * Static params for the docs routes of one depth.
   *
   * @param depth - 1 for `/docs/{pkg}/`, 2 for `/docs/{pkg}/{page}/`, 3 for `/docs/{pkg}/{section}/{page}/`.
   * @returns One params object per page of that depth.
   * @example
   * ```ts
   * await app.docs.params(3); // [{ pkg: "web", section: "guides", page: "routing" }, ...]
   * ```
   */
  params: (depth: 1 | 2 | 3) => Promise<Record<string, string>[]>;
};
