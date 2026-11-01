/**
 * @file Pure renderers for the `.md` pages, `llms.txt`, `llms-full.txt` and the per-package
 * `llms.txt` (llmstxt.org format).
 */
import { toAgentMarkdown } from "./markdown";
import type { LlmsDocument, LlmsFile, LlmsPackage, LlmsPage, LlmsSite } from "./types";

/** Everything `renderLlmsFiles` renders. */
export type RenderInput = {
  /** Site identity; `url` must be absolute. */
  site: LlmsSite;
  /** Docs pages in `docs.all()` order. */
  documents: readonly LlmsDocument[];
  /** Site pages: landing, demos, about. */
  pages: readonly LlmsPage[];
  /** Resolved packages by id; a page of a package missing here gets no release in `Source:`. */
  packages: ReadonlyMap<string, LlmsPackage>;
};

/**
 * Check the site URL and drop its trailing slash.
 *
 * @param url - The configured `siteUrl`.
 * @returns The URL without a trailing slash.
 * @throws {Error} When the URL is empty.
 * @example
 * ```ts
 * checkSiteUrl("https://moku-labs.com/"); // "https://moku-labs.com"
 * ```
 */
export function checkSiteUrl(url: string): string {
  if (url === "") {
    throw new Error("[llms] siteUrl is empty.\n  Set pluginConfigs.llms.siteUrl.");
  }
  return url.replace(/\/+$/, "");
}

/**
 * The `.md` file of a page: beside its HTML, so `/docs/web/` → `docs/web.md`.
 *
 * @param path - URL path of the HTML page, with a trailing slash.
 * @returns The file path relative to the output directory.
 * @example
 * ```ts
 * markdownPathOf("/docs/web/guides/routing/"); // "docs/web/guides/routing.md"
 * ```
 */
export function markdownPathOf(path: string): string {
  const trimmed = path.replaceAll(/^\/+|\/+$/g, "");
  return trimmed === "" ? "index.md" : `${trimmed}.md`;
}

/**
 * Join the non-empty blocks of a document with blank lines.
 *
 * @param parts - Markdown blocks; empty ones are skipped.
 * @returns The joined text.
 * @example
 * ```ts
 * blocks("# Title", "", "Body."); // "# Title\n\nBody."
 * ```
 */
export function blocks(...parts: string[]): string {
  return parts.filter(part => part !== "").join("\n\n");
}

/**
 * The `Source:` line of a page: its HTML URL and, for a docs page, the package release.
 *
 * @param url - Site URL without a trailing slash.
 * @param page - The page.
 * @param packages - Resolved packages by id.
 * @returns The line.
 */
function sourceLine(url: string, page: LlmsPage, packages: RenderInput["packages"]): string {
  const release = page.pkg === undefined ? undefined : packages.get(page.pkg)?.release;
  return release === undefined
    ? `Source: ${url}${page.path}`
    : `Source: ${url}${page.path} · ${release}`;
}

/**
 * The llmstxt.org link line of a page.
 *
 * @param url - Site URL without a trailing slash.
 * @param page - The page.
 * @returns `- [Title](url.md): description`.
 */
function linkLine(url: string, page: LlmsPage): string {
  return `- [${page.title}](${url}/${markdownPathOf(page.path)}): ${page.description}`;
}

/**
 * An llms.txt section: heading and link list.
 *
 * @param heading - Section heading.
 * @param lines - Link lines.
 * @returns The section.
 */
function section(heading: string, lines: readonly string[]): string {
  return `## ${heading}\n\n${lines.join("\n")}`;
}

/**
 * Docs pages grouped by package, in first-seen order.
 *
 * @param documents - Docs pages in nav order.
 * @returns Pages by package id.
 */
function byPackage(documents: readonly LlmsDocument[]): Map<string, LlmsPage[]> {
  const groups = new Map<string, LlmsPage[]>();
  for (const page of documents) {
    groups.set(page.pkg, [...(groups.get(page.pkg) ?? []), page]);
  }
  return groups;
}

/** A page with its Source line and converted body, computed once per page. */
type RenderedPage = {
  /** The page. */
  page: LlmsPage;
  /** Its `Source:` line. */
  source: string;
  /** Its body as agent Markdown. */
  body: string;
};

/** Shared inputs of the index renderers. */
type IndexContext = {
  /** Site identity. */
  site: LlmsSite;
  /** Site URL without a trailing slash. */
  url: string;
  /** Resolved packages by id. */
  packages: RenderInput["packages"];
};

/**
 * The llms.txt section heading of a package: its name, or its id when it is not resolved.
 *
 * @param context - Index inputs.
 * @param id - Package id.
 * @returns The heading.
 */
function packageName(context: IndexContext, id: string): string {
  return context.packages.get(id)?.name ?? id;
}

/**
 * The link to `llms-full.txt`, the one entry of every `## Optional` section.
 *
 * @param url - Site URL without a trailing slash.
 * @returns The link line.
 */
function fullTextLink(url: string): string {
  return `- [Full docs](${url}/llms-full.txt): Every docs page in one file, in sidebar order.`;
}

/**
 * The site's `llms.txt`: title, summary, one section per package, the site pages, Optional.
 *
 * @param context - Index inputs.
 * @param groups - Docs pages by package, in nav order.
 * @param pages - Site pages.
 * @returns The file content.
 */
function renderIndex(
  context: IndexContext,
  groups: ReadonlyMap<string, LlmsPage[]>,
  pages: readonly LlmsPage[]
): string {
  const links = (list: readonly LlmsPage[]): string[] =>
    list.map(page => linkLine(context.url, page));
  const packageSections = [...groups].map(([id, own]) =>
    section(packageName(context, id), links(own))
  );
  const siteSection = pages.length > 0 ? section("Site", links(pages)) : "";
  return blocks(
    `# ${context.site.name}`,
    `> ${context.site.description}`,
    ...packageSections,
    siteSection,
    section("Optional", [fullTextLink(context.url)])
  );
}

/**
 * The `docs/<pkg>/llms.txt` of one package: only its own pages.
 *
 * @param context - Index inputs.
 * @param id - Package id.
 * @param own - The package's pages in nav order.
 * @returns The file.
 */
function renderPackageIndex(context: IndexContext, id: string, own: readonly LlmsPage[]): LlmsFile {
  const name = packageName(context, id);
  const summary = context.packages.get(id)?.tagline || `${name} docs from ${context.site.name}.`;
  const content = blocks(
    `# ${name}`,
    `> ${summary}`,
    section(
      "Docs",
      own.map(page => linkLine(context.url, page))
    ),
    section("Optional", [fullTextLink(context.url)])
  );
  return { path: `docs/${id}/llms.txt`, content: `${content}\n` };
}

/**
 * Render every agent-facing file: one `.md` per page, `llms.txt`, `llms-full.txt` and one
 * `docs/<pkg>/llms.txt` per package.
 *
 * @param input - Site, pages in nav order and resolved packages.
 * @returns The files, page files first.
 * @throws {Error} When `site.url` is empty.
 * @example
 * ```ts
 * const site = { name: "Moku Labs", description: "Kernel family.", url: "https://moku-labs.com" };
 * renderLlmsFiles({ site, documents: [], pages: [], packages: new Map() }).map(file => file.path);
 * // ["llms.txt", "llms-full.txt"]
 * ```
 */
export function renderLlmsFiles(input: RenderInput): LlmsFile[] {
  const context: IndexContext = {
    site: input.site,
    url: checkSiteUrl(input.site.url),
    packages: input.packages
  };
  const rendered = (page: LlmsPage): RenderedPage => ({
    page,
    source: sourceLine(context.url, page, context.packages),
    body: toAgentMarkdown(page.markdown)
  });
  const documents = input.documents.map(page => rendered(page));
  const pageFiles = [...documents, ...input.pages.map(page => rendered(page))].map(
    ({ page, source, body }) => ({
      path: markdownPathOf(page.path),
      content: `${blocks(`# ${page.title}`, `> ${page.description}`, body, source)}\n`
    })
  );
  const full = documents
    .map(({ page, source, body }) =>
      blocks(`# ${page.title}`, source, `> ${page.description}`, body)
    )
    .join("\n\n");
  const groups = byPackage(input.documents);
  return [
    ...pageFiles,
    { path: "llms.txt", content: `${renderIndex(context, groups, input.pages)}\n` },
    { path: "llms-full.txt", content: `${full}\n` },
    ...[...groups].map(([id, own]) => renderPackageIndex(context, id, own))
  ];
}
