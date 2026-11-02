import { describe, expect, it } from "vitest";
import { renderDocumentationHub, renderSitePages } from "../../site-pages";
import type { LlmsDocument, SiteData } from "../../types";

const site = { name: "Moku Labs", description: "A kernel family.", url: "https://moku-labs.com" };

const empty: SiteData = {
  packages: [],
  demos: [],
  about: { name: "", motto: "", bio: [], links: [] },
  installCommands: [],
  prompts: []
};

describe("renderSitePages", () => {
  // Bug: empty data (before the data wave) prints headings with nothing under them.
  it("renders the landing, demos and about pages with empty bodies while the data is empty", () => {
    const pages = renderSitePages(site, empty, new Set());
    expect(pages.map(page => [page.path, page.title, page.markdown])).toEqual([
      ["/", "Moku Labs", ""],
      ["/demos/", "Demos", ""],
      ["/about/", "About", ""]
    ]);
    expect(pages.every(page => page.pkg === undefined)).toBe(true);
    expect(pages[2]?.description).toBe("About Moku Labs.");
  });

  // Bug: the landing links a package to a docs .md that does not exist.
  it("links a package to its docs .md only when it has a docs index page", () => {
    const data: SiteData = {
      ...empty,
      packages: [
        {
          id: "web",
          name: "@moku-labs/web",
          npm: "@moku-labs/web",
          tagline: "Web.",
          group: "Frameworks"
        },
        { id: "claude", name: "Claude plugin", npm: "moku", tagline: "Agents.", group: "Start" }
      ],
      installCommands: ["/plugin install moku"],
      prompts: ["Build a blog"]
    };
    const [landing] = renderSitePages(site, data, new Set(["/docs/web/"]));
    expect(landing?.markdown).toBe(
      [
        "## Packages",
        "",
        "- [@moku-labs/web](https://moku-labs.com/docs/web.md): Web.",
        "- Claude plugin: Agents.",
        "",
        "## Start with Claude Code",
        "",
        "```sh",
        "/plugin install moku",
        "```",
        "",
        "Example prompts:",
        "",
        "- Build a blog"
      ].join("\n")
    );
  });

  // Bug: a demo's stack or an about link is lost in the agent version of the page.
  it("lists each demo with its stack and the about bio with its links", () => {
    const data: SiteData = {
      ...empty,
      demos: [{ id: "tracker", name: "Tracker", description: "Habits.", stack: ["web", "worker"] }],
      about: {
        name: "Alex",
        motto: "Small kernels.",
        bio: ["One.", "Two."],
        links: [{ label: "GitHub", href: "https://github.com/moku-labs" }]
      }
    };
    const [, demos, about] = renderSitePages(site, data, new Set());
    expect(demos?.markdown).toBe("## Tracker\n\nHabits.\n\nBuilt on: web, worker");
    expect(about?.description).toBe("Small kernels.");
    expect(about?.markdown).toBe(
      "## Alex\n\nOne.\n\nTwo.\n\n## Links\n\n- [GitHub](https://github.com/moku-labs)"
    );
  });
});

const hubDocument = (path: string, pkg: string, title: string): LlmsDocument => ({
  path,
  title,
  description: `${title} page.`,
  markdown: "",
  pkg
});

describe("renderDocumentationHub", () => {
  // Bug: /docs.md missing a concept or a package, a package linked to a page that does not exist,
  // a package without an index not linked to its first page, or the groups out of order.
  it("lists the concepts and the packages by group, linking each package to its docs home", () => {
    const hub = renderDocumentationHub(
      site,
      [
        // oxlint-disable-next-line unicorn/no-null -- PackageEntry marks "not on npm" with null.
        { id: "claude", name: "Claude plugin", npm: null, tagline: "Agents.", group: "Start" },
        { id: "core", name: "@moku-labs/core", npm: "c", tagline: "Kernel.", group: "Core" },
        { id: "common", name: "@moku-labs/common", npm: "m", tagline: "Shared.", group: "Core" },
        { id: "web", name: "@moku-labs/web", npm: "w", tagline: "Web.", group: "Frameworks" }
      ],
      [
        hubDocument("/docs/concepts/three-layers/", "concepts", "Three layers"),
        hubDocument("/docs/core/install/", "core", "Install"),
        hubDocument("/docs/core/", "core", "Core"),
        hubDocument("/docs/web/quick-start/", "web", "Quick start")
      ]
    );

    expect(hub.path).toBe("/docs/");
    expect(hub.title).toBe("Docs");
    expect(hub.pkg).toBeUndefined();
    expect(hub.markdown).toBe(
      [
        "## Concepts",
        "",
        "How every Moku package works underneath. From @moku-labs/core.",
        "",
        "- [Three layers](https://moku-labs.com/docs/concepts/three-layers.md): Three layers page.",
        "",
        "## Packages",
        "",
        "### Start",
        "",
        "- Claude plugin: Agents.",
        "",
        "### Core",
        "",
        "- [@moku-labs/core](https://moku-labs.com/docs/core.md): Kernel.",
        "- @moku-labs/common: Shared.",
        "",
        "### Frameworks",
        "",
        "- [@moku-labs/web](https://moku-labs.com/docs/web/quick-start.md): Web."
      ].join("\n")
    );
  });

  // Bug: an empty docs tree prints a Concepts heading with nothing under it.
  it("leaves out the concepts section when there are no concepts pages", () => {
    const hub = renderDocumentationHub(site, [], []);
    expect(hub.markdown).toBe("");
  });
});
