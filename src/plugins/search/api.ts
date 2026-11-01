/**
 * @file API factory, index builder and shard writer of the search plugin.
 */
import { collectionPlugin } from "@moku-labs/web";
import { SITE } from "../../config";
import { demos } from "../../data/demos";
import { packages } from "../../data/packages";
import { resolvePackages } from "../../lib/packages";
import { docsPlugin } from "../docs";
import type { DocumentPage } from "../docs/types";
import type {
  SearchApi,
  SearchContext,
  SearchEntry,
  SearchIndexInput,
  SearchKind,
  SearchSources
} from "./types";

/** The site's own pages, always in the index. */
const FIXED_PAGES: readonly SearchEntry[] = [
  { kind: "Page", title: "Home", subtitle: SITE.description, href: "/", icon: "page" },
  {
    kind: "Page",
    title: "Docs",
    subtitle: "Packages, guides, plugins and concepts",
    href: "/docs/",
    icon: "page"
  },
  { kind: "Page", title: "Demos", subtitle: "Apps built on Moku", href: "/demos/", icon: "page" },
  { kind: "Page", title: "About", subtitle: "Who builds Moku", href: "/about/", icon: "page" }
];

/** Section folders and page names that decide a docs page's kind, checked in this order. */
const KIND_BY_SEGMENT: ReadonlyArray<readonly [string, SearchKind]> = [
  ["plugins", "Plugin"],
  ["api", "API"],
  ["guides", "Guide"]
];

/**
 * The packages and demos of `src/data/*`, versions resolved from `node_modules`.
 */
const defaultSources: SearchSources = {
  packages: () => resolvePackages(packages, "node_modules"),
  demos
};

/**
 * The kind of a docs page from its path: `/docs/concepts/…` is a Concept, `/docs/<pkg>/` a
 * Package, a path through `plugins`, `api` or `guides` a Plugin, API or Guide; the rest a Page.
 *
 * @param path - Docs URL path with a trailing slash.
 * @returns The kind.
 * @example
 * ```ts
 * kindOfPath("/docs/web/plugins/router/"); // "Plugin"
 * ```
 */
function kindOfPath(path: string): SearchKind {
  const [, pkg, ...rest] = path.split("/").filter(Boolean);
  if (pkg === "concepts") return "Concept";
  if (rest.length === 0) return "Package";
  return KIND_BY_SEGMENT.find(([segment]) => rest.includes(segment))?.[1] ?? "Page";
}

/**
 * The icon of a docs page: its package id, or `concept` for the concepts pages.
 *
 * @param page - A docs page.
 * @returns The icon id.
 */
function iconOf(page: DocumentPage): string {
  return page.pkg === "concepts" ? "concept" : page.pkg;
}

/**
 * The `Section` rows of a page: one per h2, linking to its anchor.
 *
 * @param page - A docs page.
 * @returns The rows in document order.
 */
function sectionsOf(page: DocumentPage): SearchEntry[] {
  return page.headings
    .filter(heading => heading.depth === 2)
    .map(heading => ({
      kind: "Section",
      title: heading.text,
      subtitle: page.title,
      href: `${page.path}#${heading.id}`,
      icon: iconOf(page)
    }));
}

/**
 * Build the ⌘K index: fixed pages, packages, docs pages, demos, then the docs sections. Each
 * `href` is kept once, first one wins, so a package's data entry replaces its docs index page.
 *
 * @param input - Docs pages, packages and demos.
 * @returns The index rows.
 */
export function buildSearchIndex(input: SearchIndexInput): SearchEntry[] {
  const rows: SearchEntry[] = [
    ...FIXED_PAGES,
    ...input.packages.map(
      (entry): SearchEntry => ({
        kind: "Package",
        title: entry.name,
        subtitle: entry.tagline,
        href: `/docs/${entry.id}/`,
        icon: entry.id
      })
    ),
    ...input.pages.map(
      (page): SearchEntry => ({
        kind: kindOfPath(page.path),
        title: page.title,
        subtitle: page.description,
        href: page.path,
        icon: iconOf(page)
      })
    ),
    ...input.demos.map(
      (demo): SearchEntry => ({
        kind: "Page",
        title: demo.name,
        subtitle: demo.description,
        href: `/demos/#${demo.id}`,
        icon: "demo"
      })
    ),
    ...input.pages.flatMap(page => sectionsOf(page))
  ];
  const byHref = new Map<string, SearchEntry>();
  for (const row of rows) if (!byHref.has(row.href)) byHref.set(row.href, row);
  return [...byHref.values()];
}

/**
 * Build the index from the docs plugin and the sources, and write it as one collection shard.
 *
 * @param ctx - Plugin context: config, and `require` for the docs and collection plugins.
 * @param outputDirectory - Build output directory the shard is written under.
 * @param sources - Packages and demos; defaults to `src/data/*`.
 * @returns How many rows were written.
 * @throws {Error} When the docs fail to load, a package is not installed, or the write fails.
 */
export async function writeSearchIndex(
  ctx: SearchContext,
  outputDirectory: string,
  sources: SearchSources = defaultSources
): Promise<{ count: number }> {
  const rows = await indexEntries(ctx, sources);
  await ctx
    .require(collectionPlugin)
    .write([{ collection: ctx.config.collection, shard: ctx.config.shard, data: rows }], {
      outDir: outputDirectory
    });
  return { count: rows.length };
}

/**
 * Build the index rows from the docs plugin's pages and the sources.
 *
 * @param ctx - Plugin context, for `require` of the docs plugin.
 * @param sources - Packages and demos.
 * @returns The index rows.
 */
async function indexEntries(ctx: SearchContext, sources: SearchSources): Promise<SearchEntry[]> {
  const pages = await ctx.require(docsPlugin).all();
  return buildSearchIndex({ pages, packages: sources.packages(), demos: sources.demos });
}

/**
 * Build the search API.
 *
 * @param ctx - Plugin context: config, and `require` for the docs and collection plugins.
 * @param sources - Packages and demos; defaults to `src/data/*`.
 * @returns The API mounted at `app.search`.
 */
export function createSearchApi(
  ctx: SearchContext,
  sources: SearchSources = defaultSources
): SearchApi {
  return {
    entries: () => indexEntries(ctx, sources),
    write: (outputDirectory = ctx.config.outDir) => writeSearchIndex(ctx, outputDirectory, sources)
  };
}
