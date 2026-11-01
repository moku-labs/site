import { describe, expect, it } from "vitest";
import { renderSitePages } from "../../site-pages";
import type { SiteData } from "../../types";

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
