/**
 * @file The landing, docs hub, demos and about pages as Markdown for agents, generated from
 * `src/data/*` and the docs pages.
 */
import type { PackageEntry } from "../../data/packages";
import { blocks, markdownPathOf } from "./render";
import type { LlmsDocument, LlmsPage, LlmsSite, SiteData } from "./types";

/** Package id of the core concepts pages. */
const CONCEPTS = "concepts";

/**
 * A section with a heading, or `""` when it has no body.
 *
 * @param heading - The h2 text.
 * @param body - The section body.
 * @returns The section, or `""`.
 */
function section(heading: string, body: string): string {
  return body === "" ? "" : `## ${heading}\n\n${body}`;
}

/**
 * The landing body: packages, then the Claude Code install commands and prompts.
 *
 * @param site - Site identity.
 * @param data - The site data.
 * @param documentPaths - URL paths of the docs pages, to link a package only to an index that exists.
 * @returns The Markdown body.
 */
function landing(site: LlmsSite, data: SiteData, documentPaths: ReadonlySet<string>): string {
  const packages = data.packages
    .map(entry =>
      documentPaths.has(`/docs/${entry.id}/`)
        ? `- [${entry.name}](${site.url}/docs/${entry.id}.md): ${entry.tagline}`
        : `- ${entry.name}: ${entry.tagline}`
    )
    .join("\n");
  const commands =
    data.installCommands.length > 0 ? `\`\`\`sh\n${data.installCommands.join("\n")}\n\`\`\`` : "";
  const prompts =
    data.prompts.length > 0
      ? `Example prompts:\n\n${data.prompts.map(prompt => `- ${prompt}`).join("\n")}`
      : "";
  return blocks(
    section("Packages", packages),
    section("Start with Claude Code", blocks(commands, prompts))
  );
}

/**
 * The demos body: one section per demo with its stack.
 *
 * @param data - The site data.
 * @returns The Markdown body.
 */
function demosBody(data: SiteData): string {
  return blocks(
    ...data.demos.map(demo =>
      section(demo.name, blocks(demo.description, `Built on: ${demo.stack.join(", ")}`))
    )
  );
}

/**
 * The about body: name, bio paragraphs and links.
 *
 * @param data - The site data.
 * @returns The Markdown body.
 */
function aboutBody(data: SiteData): string {
  const { name, bio, links } = data.about;
  const linkList = links.map(link => `- [${link.label}](${link.href})`).join("\n");
  return blocks(name === "" ? "" : `## ${name}`, ...bio, section("Links", linkList));
}

/**
 * The landing (`/`), demos (`/demos/`) and about (`/about/`) pages for agents. Sections whose
 * data is empty are left out, so the pages stay valid before the data wave.
 *
 * @param site - Site identity; `url` without a trailing slash.
 * @param data - Packages, demos, about, install commands and prompts.
 * @param documentPaths - URL paths of the docs pages.
 * @returns The three pages, in that order, with no package.
 * @example
 * ```ts
 * const site = { name: "Moku Labs", description: "Kernel family.", url: "https://moku-labs.com" };
 * const data = { packages: [], demos: [], about: { name: "", motto: "", bio: [], links: [] }, installCommands: [], prompts: [] };
 * renderSitePages(site, data, new Set()).map(page => page.path); // ["/", "/demos/", "/about/"]
 * ```
 */
export function renderSitePages(
  site: LlmsSite,
  data: SiteData,
  documentPaths: ReadonlySet<string>
): LlmsPage[] {
  return [
    {
      path: "/",
      title: site.name,
      description: site.description,
      markdown: landing(site, data, documentPaths),
      pkg: undefined
    },
    {
      path: "/demos/",
      title: "Demos",
      description: `Apps built on the ${site.name} packages.`,
      markdown: demosBody(data),
      pkg: undefined
    },
    {
      path: "/about/",
      title: "About",
      description: data.about.motto || `About ${site.name}.`,
      markdown: aboutBody(data),
      pkg: undefined
    }
  ];
}

/**
 * The docs home of each package: its index page, or its first page when it has none.
 *
 * @param documents - Docs pages in nav order.
 * @returns URL path of the home by package id.
 */
function documentHomes(documents: readonly LlmsDocument[]): Map<string, string> {
  const homes = new Map<string, string>();
  for (const page of documents) {
    const isIndex = page.path === `/docs/${page.pkg}/`;
    if (isIndex || !homes.has(page.pkg)) homes.set(page.pkg, page.path);
  }
  return homes;
}

/**
 * The packages section of the hub: one h3 per group in data order, a package linked to the
 * `.md` of its docs home when it has pages.
 *
 * @param url - Site URL without a trailing slash.
 * @param packages - The family in display order.
 * @param homes - Docs home path by package id.
 * @returns The Markdown section, or `""` without packages.
 */
function hubPackages(
  url: string,
  packages: readonly PackageEntry[],
  homes: ReadonlyMap<string, string>
): string {
  const groups = new Map<string, string[]>();
  for (const entry of packages) {
    const home = homes.get(entry.id);
    const line =
      home === undefined
        ? `- ${entry.name}: ${entry.tagline}`
        : `- [${entry.name}](${url}/${markdownPathOf(home)}): ${entry.tagline}`;
    groups.set(entry.group, [...(groups.get(entry.group) ?? []), line]);
  }
  const body = [...groups].map(([group, lines]) => `### ${group}\n\n${lines.join("\n")}`);
  return section("Packages", blocks(...body));
}

/**
 * The docs hub (`/docs/`) for agents: the concepts pages, then the family by group, each
 * package linked to its docs home. Written as `docs.md`, the hub's "View as .md".
 *
 * @param site - Site identity; `url` without a trailing slash.
 * @param packages - The family in display order.
 * @param documents - Docs pages in nav order.
 * @returns The hub page, with no package.
 * @example
 * ```ts
 * const site = { name: "Moku Labs", description: "Kernel family.", url: "https://moku-labs.com" };
 * renderDocumentationHub(site, [], []).path; // "/docs/"
 * ```
 */
export function renderDocumentationHub(
  site: LlmsSite,
  packages: readonly PackageEntry[],
  documents: readonly LlmsDocument[]
): LlmsPage {
  const concepts = documents
    .filter(page => page.pkg === CONCEPTS)
    .map(page => `- [${page.title}](${site.url}/${markdownPathOf(page.path)}): ${page.description}`)
    .join("\n");
  const conceptsBody =
    concepts === ""
      ? ""
      : blocks("How every Moku package works underneath. From @moku-labs/core.", concepts);
  return {
    path: "/docs/",
    title: "Docs",
    description: "Docs for every Moku package, checked against the published releases.",
    markdown: blocks(
      section("Concepts", conceptsBody),
      hubPackages(site.url, packages, documentHomes(documents))
    ),
    pkg: undefined
  };
}
