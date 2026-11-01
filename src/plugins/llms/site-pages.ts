/**
 * @file The landing, demos and about pages as Markdown for agents, generated from `src/data/*`.
 */
import { blocks } from "./render";
import type { LlmsPage, LlmsSite, SiteData } from "./types";

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
