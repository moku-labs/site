/**
 * @file Types of the docs plugin.
 */
import type { contentPlugin } from "@moku-labs/web";

/** Plugin config. */
export type DocumentationConfig = {
  /** Root directory of the docs Markdown, relative to the project root. */
  dir: string;
};

/** Runtime tag of a plugin page: `node` runs only on Node, `optional` is opt-in. */
export type DocumentKind = "node" | "optional";

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
  /** Runtime tag of a plugin page; absent for a default plugin and every other page. */
  kind?: DocumentKind;
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
  /** Runtime tag of the page, shown in the sidebar; absent when the page has none. */
  kind?: DocumentKind;
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

/** The part of the content plugin API the docs plugin uses. */
export type MarkdownRenderer = {
  /** Render Markdown to HTML through the content pipeline (Shiki, sanitizing, rehype plugins). */
  renderMarkdown: (md: string) => Promise<string>;
};

/** The plugin context fields the docs API reads; the framework's `ctx` satisfies it structurally. */
export type DocumentationContext = {
  /** Resolved plugin config. */
  readonly config: Readonly<DocumentationConfig>;
  /** Mutable plugin state. */
  readonly state: DocumentationState;
  /** Resolve the content plugin to its API. */
  readonly require: (plugin: typeof contentPlugin) => MarkdownRenderer;
};

/**
 * Public API mounted at `app.docs`. Pages load once, lazily, on the first call. Package order is
 * `concepts` first, then the family in `src/data/packages.ts` order. A page without a `section`
 * field is grouped under `Concepts` (concepts) or `Get started` (a package).
 */
export type DocumentationApi = {
  /**
   * Every docs page, sorted by package order, nav group, `order`, then title. A group sits where
   * its first page falls when the package is sorted by `order`.
   *
   * @returns All pages.
   * @throws {Error} When a file is deeper than `<pkg>/<section>/<page>`, sits in an unknown package folder, or lacks `title`/`description`; the message names the file.
   * @example
   * ```ts
   * // The llms plugin writes one .md file per page, in sidebar order.
   * const pages = await ctx.require(docsPlugin).all();
   * pages.map(page => page.path); // ["/docs/concepts/three-layers/", ..., "/docs/web/", ...]
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
   * // The deep docs route loads its page from the URL.
   * const page = await ctx.require(docsPlugin).get("/docs/web/guides/routing/");
   * page?.section; // "guides" (from content/docs/web/guides/routing.md)
   * ```
   */
  get: (path: string) => Promise<DocumentPage | undefined>;
  /**
   * Every page of one package.
   *
   * @param pkg - Package id or `concepts`.
   * @returns The package's pages in nav order; `[]` for a package without pages.
   * @example
   * ```ts
   * // The docs hub lists the concepts cards.
   * const concepts = await app.docs.byPackage("concepts");
   * concepts.every(page => page.pkg === "concepts"); // true
   * ```
   */
  byPackage: (pkg: string) => Promise<DocumentPage[]>;
  /**
   * Sidebar groups of one package.
   *
   * @param pkg - Package id or `concepts`.
   * @returns Groups in first-seen order, pages by `order` then title; `[]` for an unknown package.
   * @example
   * ```ts
   * // The docs layout renders the sidebar of the current package.
   * const groups = await app.docs.nav("web");
   * groups.map(group => group.label); // ["Get started", "Guides", "Plugins", "API reference"]
   * ```
   */
  nav: (pkg: string) => Promise<NavGroup[]>;
  /**
   * Previous and next pages within the package. At a package's ends, the nearest neighbouring
   * package with pages: its index page, or its first page when it has none.
   *
   * @param path - URL path of the current page.
   * @returns The neighbours that exist; `{}` for an unknown path.
   * @example
   * ```ts
   * // The last web page links on to the next package in the family order.
   * const { next } = await app.docs.neighbours("/docs/web/api/");
   * next?.path; // "/docs/worker/"
   * ```
   */
  neighbours: (path: string) => Promise<{ prev?: DocumentLink; next?: DocumentLink }>;
  /**
   * Static params for the docs routes of one depth.
   *
   * @param depth - 1 for `/docs/{pkg}/`, 2 for `/docs/{pkg}/{page}/`, 3 for `/docs/{pkg}/{section}/{page}/`.
   * @returns One params object per page of that depth, in `all()` order.
   * @example
   * ```ts
   * // route("/docs/{pkg}/{section}/{page}/").generate(ctx => ctx.require(docsPlugin).params(3))
   * await app.docs.params(3); // [{ pkg: "web", section: "guides", page: "routing" }, ...]
   * ```
   */
  params: (depth: 1 | 2 | 3) => Promise<Record<string, string>[]>;
};
