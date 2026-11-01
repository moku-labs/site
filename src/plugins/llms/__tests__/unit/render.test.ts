import { describe, expect, it } from "vitest";
import { markdownPathOf, renderLlmsFiles } from "../../render";
import type { LlmsDocument, LlmsPackage, LlmsPage } from "../../types";

const site = { name: "Moku Labs", description: "A kernel family.", url: "https://moku-labs.com/" };

const page = <Pkg extends string | undefined>(path: string, title: string, pkg: Pkg) => ({
  path,
  title,
  description: `About ${title}.`,
  markdown: `## ${title} body`,
  pkg
});

const documents: LlmsDocument[] = [
  page("/docs/concepts/three-layers/", "Three layers", "concepts"),
  page("/docs/web/", "Overview", "web"),
  page("/docs/web/guides/routing/", "Routing", "web"),
  page("/docs/core/", "Core", "core")
];
const pages: LlmsPage[] = [page("/", "Moku Labs", undefined), page("/demos/", "Demos", undefined)];
const packages = new Map<string, LlmsPackage>([
  ["concepts", { id: "concepts", name: "Concepts", tagline: "", release: "@moku-labs/core@1.7.6" }],
  ["web", { id: "web", name: "@moku-labs/web", tagline: "Web.", release: "@moku-labs/web@2.4.11" }]
]);

const render = () => renderLlmsFiles({ site, documents, pages, packages });
const fileAt = (path: string): string => {
  const found = render().find(file => file.path === path);
  if (!found) throw new Error(`no file ${path}`);
  return found.content;
};

describe("markdownPathOf", () => {
  // Bug: "View as .md" on a page 404s because the file sits elsewhere than the HTML path says.
  it("mirrors the HTML path: trailing slash becomes .md, the root becomes index.md", () => {
    expect(markdownPathOf("/docs/web/guides/routing/")).toBe("docs/web/guides/routing.md");
    expect(markdownPathOf("/docs/web/")).toBe("docs/web.md");
    expect(markdownPathOf("/demos/")).toBe("demos.md");
    expect(markdownPathOf("/")).toBe("index.md");
  });
});

describe("renderLlmsFiles", () => {
  // Bug: a page is written under another path than the one llms.txt links to.
  it("writes one .md per page at the mirrored path", () => {
    const paths = render().map(file => file.path);
    expect(paths).toEqual([
      "docs/concepts/three-layers.md",
      "docs/web.md",
      "docs/web/guides/routing.md",
      "docs/core.md",
      "index.md",
      "demos.md",
      "llms.txt",
      "llms-full.txt",
      "docs/concepts/llms.txt",
      "docs/web/llms.txt",
      "docs/core/llms.txt"
    ]);
  });

  // Bug: a relative or version-less Source line, or the directives reach the agent raw.
  it("renders a page as title, description, converted body and an absolute Source line", () => {
    expect(fileAt("docs/web/guides/routing.md")).toBe(
      [
        "# Routing",
        "",
        "> About Routing.",
        "",
        "## Routing body",
        "",
        "Source: https://moku-labs.com/docs/web/guides/routing/ · @moku-labs/web@2.4.11",
        ""
      ].join("\n")
    );
    const withDirective = renderLlmsFiles({
      site,
      documents: [
        { ...page("/docs/web/", "Overview", "web"), markdown: '::diagram{name="pipeline"}' }
      ],
      pages: [],
      packages
    });
    expect(withDirective[0]?.content).toContain("\n*Diagram: pipeline*\n");
  });

  // Bug: a page of a package without a resolved version prints "undefined@undefined".
  it("omits the release from the Source line when the package is unknown", () => {
    expect(fileAt("docs/core.md")).toContain("\nSource: https://moku-labs.com/docs/core/\n");
    expect(fileAt("index.md")).toContain("\nSource: https://moku-labs.com/\n");
  });

  // Bug: agents miss a docs page, or see one twice, in the index they start from.
  it("lists every docs page exactly once in llms.txt, grouped by package, with Optional last", () => {
    const index = fileAt("llms.txt");
    for (const entry of documents) {
      const link = `](https://moku-labs.com/${markdownPathOf(entry.path)}): ${entry.description}`;
      expect(index.split(link)).toHaveLength(2);
    }
    expect(index.startsWith("# Moku Labs\n\n> A kernel family.\n\n## Concepts\n\n- [Three")).toBe(
      true
    );
    expect(index.indexOf("## @moku-labs/web")).toBeLessThan(index.indexOf("## core"));
    expect(index).toContain("## Site\n\n- [Moku Labs](https://moku-labs.com/index.md)");
    expect(
      index.endsWith(
        "- [Full docs](https://moku-labs.com/llms-full.txt): Every docs page in one file, in sidebar order.\n"
      )
    ).toBe(true);
  });

  // Bug: llms-full.txt is in file-system order, so it reads differently from the sidebar.
  it("concatenates llms-full.txt in the given docs order, each page opening with title and Source", () => {
    const full = fileAt("llms-full.txt");
    const titles = [...full.matchAll(/^# (.+)$/gm)].map(match => match[1]);
    expect(titles).toEqual(["Three layers", "Overview", "Routing", "Core"]);
    expect(full).toContain(
      "# Routing\n\nSource: https://moku-labs.com/docs/web/guides/routing/ · @moku-labs/web@2.4.11\n\n> About Routing.\n\n## Routing body"
    );
    expect(full).not.toContain("Demos");
  });

  // Bug: a package's llms.txt lists the whole family instead of its own pages.
  it("writes a per-package llms.txt with only that package's pages", () => {
    const web = fileAt("docs/web/llms.txt");
    expect(web.startsWith("# @moku-labs/web\n\n> Web.\n\n## Docs\n\n")).toBe(true);
    expect(web).toContain("(https://moku-labs.com/docs/web/guides/routing.md)");
    expect(web).not.toContain("three-layers");
    expect(fileAt("docs/concepts/llms.txt")).toContain("> Concepts docs from Moku Labs.");
  });

  // Bug: an empty siteUrl ships relative Source lines and broken llms.txt links.
  it("throws on an empty siteUrl", () => {
    expect(() =>
      renderLlmsFiles({ site: { ...site, url: "" }, documents, pages, packages })
    ).toThrow("[llms] siteUrl is empty.\n  Set pluginConfigs.llms.siteUrl.");
  });
});
