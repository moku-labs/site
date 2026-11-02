import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DocumentationSources } from "../../../src/lib/docs-data";
import {
  docsPathOf,
  installedSources,
  loadDocumentationHub,
  loadDocumentationPage
} from "../../../src/lib/docs-data";
import type { ResolvedPackage } from "../../../src/lib/packages";
import type { DocumentationApi, DocumentPage } from "../../../src/plugins/docs/types";

/** A docs page with the fields the loaders read; the rest is filler. */
function page(overrides: Partial<DocumentPage> & Pick<DocumentPage, "path" | "pkg" | "slug">) {
  const base: DocumentPage = {
    path: overrides.path,
    pkg: overrides.pkg,
    section: undefined,
    slug: overrides.slug,
    title: overrides.slug,
    description: `About ${overrides.slug}.`,
    order: 0,
    group: "Get started",
    drift: undefined,
    full: false,
    markdown: "## Hi",
    html: '<h2 id="hi">Hi</h2>',
    headings: [{ id: "hi", text: "Hi", depth: 2 }],
    file: `content/docs${overrides.path.replace(/\/$/, "")}.md`
  };
  return { ...base, ...overrides };
}

const pages: DocumentPage[] = [
  page({
    path: "/docs/concepts/three-layers/",
    pkg: "concepts",
    slug: "three-layers",
    group: "Concepts"
  }),
  page({
    path: "/docs/concepts/kernel-checks/",
    pkg: "concepts",
    slug: "kernel-checks",
    title: "What the kernel checks",
    group: "Concepts",
    full: true
  }),
  page({
    path: "/docs/web/guides/routing/",
    pkg: "web",
    section: "guides",
    slug: "routing",
    title: "Routing",
    group: "Guides",
    file: "content/docs/web/guides/routing.md"
  }),
  // The index comes after another web page here: the home is still the index.
  page({ path: "/docs/web/", pkg: "web", slug: "index", title: "@moku-labs/web" }),
  page({
    path: "/docs/room/quick-start/",
    pkg: "room",
    slug: "quick-start",
    drift: "1 example out of date"
  }),
  page({ path: "/docs/room/api/", pkg: "room", slug: "api", drift: "a later note" })
];

/** A docs API over a fixed page list, in the order the plugin would return it. */
function fakeDocs(list: readonly DocumentPage[]): DocumentationApi {
  return {
    all: async () => [...list],
    get: async path => list.find(entry => entry.path === path),
    byPackage: async pkg => list.filter(entry => entry.pkg === pkg),
    nav: async pkg => [
      {
        label: "Pages",
        pages: list.filter(entry => entry.pkg === pkg).map(({ path, title }) => ({ path, title }))
      }
    ],
    neighbours: async path =>
      path === "/docs/web/guides/routing/"
        ? { prev: { path: "/docs/web/", title: "@moku-labs/web" } }
        : {},
    params: async () => []
  };
}

/** Resolve one family member for the sources. */
function resolved(entry: Omit<ResolvedPackage, "tagline">): ResolvedPackage {
  return { ...entry, tagline: `${entry.name} tagline` };
}

const sources: DocumentationSources = {
  packages: [
    // oxlint-disable-next-line unicorn/no-null -- PackageEntry marks "not on npm" with null.
    resolved({ id: "claude", name: "Claude plugin", npm: null, version: "0.85.6", group: "Start" }),
    resolved({
      id: "core",
      name: "@moku-labs/core",
      npm: "@moku-labs/core",
      version: "1.7.6",
      group: "Core"
    }),
    resolved({
      id: "web",
      name: "@moku-labs/web",
      npm: "@moku-labs/web",
      version: "2.4.11",
      group: "Frameworks"
    }),
    resolved({
      id: "room",
      name: "@moku-labs/room",
      npm: "@moku-labs/room",
      version: "0.8.9",
      group: "Frameworks"
    })
  ],
  today: "2026-11-02"
};

describe("docsPathOf", () => {
  // Bug: the loader asks the docs plugin for a path it never produced, so the page is missing.
  it("maps each route depth to the docs plugin's page path", () => {
    expect(docsPathOf({ pkg: "web" })).toBe("/docs/web/");
    expect(docsPathOf({ pkg: "web", page: "quick-start" })).toBe("/docs/web/quick-start/");
    expect(docsPathOf({ pkg: "web", section: "guides", page: "routing" })).toBe(
      "/docs/web/guides/routing/"
    );
  });
});

describe("loadDocumentationHub", () => {
  // Bugs: groups shuffled or split, a package linked though it has no pages (a 404), the drift
  // badge on the wrong package, a concepts card for a package page.
  it("lists the family by group with releases, homes and drift", async () => {
    const hub = await loadDocumentationHub(fakeDocs(pages), sources);

    expect(hub.concepts.map(card => [card.slug, card.full])).toEqual([
      ["three-layers", false],
      ["kernel-checks", true]
    ]);
    expect(hub.groups.map(group => [group.label, group.packages.map(entry => entry.id)])).toEqual([
      ["Start", ["claude"]],
      ["Core", ["core"]],
      ["Frameworks", ["web", "room"]]
    ]);
    const frameworks = hub.groups[2];
    expect(frameworks?.packages).toEqual([
      expect.objectContaining({ id: "web", home: "/docs/web/", release: "@moku-labs/web@2.4.11" }),
      expect.objectContaining({
        id: "room",
        home: "/docs/room/quick-start/",
        drift: "1 example out of date"
      })
    ]);
    expect(hub.groups[0]?.packages[0]).not.toHaveProperty("home");
    expect(hub.groups[0]?.packages[0]?.release).toBe("Claude plugin@0.85.6");
    expect(hub.drifts.map(entry => entry.id)).toEqual(["room"]);
    expect(hub).toMatchObject({ packageCount: 4, checked: "2026-11-02" });
  });
});

describe("loadDocumentationPage", () => {
  // Bugs: the .md link or the edit link points at the wrong file; the sync badge names the
  // wrong release; prev/next or the kernel-checks link is lost.
  it("loads a page with its Markdown twin, edit link, release and neighbours", async () => {
    const view = await loadDocumentationPage(
      fakeDocs(pages),
      { pkg: "web", section: "guides", page: "routing" },
      sources
    );

    expect(view.page).toMatchObject({
      title: "Routing",
      section: "guides",
      markdownUrl: "/docs/web/guides/routing.md",
      editUrl: "https://github.com/moku-labs/site/edit/main/content/docs/web/guides/routing.md"
    });
    expect(view.page).not.toHaveProperty("markdown");
    expect(view.headTitle).toBe("Routing · @moku-labs/web");
    expect(view.package.release).toBe("@moku-labs/web@2.4.11");
    expect(view.prev).toEqual({ path: "/docs/web/", title: "@moku-labs/web" });
    expect(view).not.toHaveProperty("next");
    expect(view.kernelChecks).toEqual({
      path: "/docs/concepts/kernel-checks/",
      title: "What the kernel checks"
    });
    expect(view.packages.map(entry => entry.id)).toEqual(["claude", "core", "web", "room"]);
  });

  // Bug: a package index links its .md as /docs/web/.md, which the llms plugin never writes.
  it("puts a package home's Markdown twin beside its folder", async () => {
    const view = await loadDocumentationPage(fakeDocs(pages), { pkg: "web" }, sources);

    expect(view.page.markdownUrl).toBe("/docs/web.md");
  });

  // Bug: the concepts pages show no release, or core's drift note leaks onto them.
  it("checks the concepts pages against the core release under their own name", async () => {
    const view = await loadDocumentationPage(
      fakeDocs([
        ...pages,
        page({ path: "/docs/core/", pkg: "core", slug: "index", drift: "core drift" })
      ]),
      { pkg: "concepts", page: "three-layers" },
      sources
    );

    expect(view.package).toEqual({
      id: "concepts",
      name: "Concepts",
      version: "1.7.6",
      release: "@moku-labs/core@1.7.6",
      tagline: "",
      group: "Core",
      icon: "core"
    });
    expect(view.headTitle).toBe("three-layers");
  });

  // Bug: a route whose params match no page renders an empty page instead of failing the build.
  // Bug: the how-it-works page ships the empty diagram frame instead of the pipeline drawing.
  it("draws the named diagram into its figure", async () => {
    const withDiagram = page({
      path: "/docs/web/how-it-works/",
      pkg: "web",
      slug: "how-it-works",
      html: '<figure data-component="diagram" data-diagram="pipeline"><figcaption>Build to SPA</figcaption></figure>'
    });
    const view = await loadDocumentationPage(
      fakeDocs([...pages, withDiagram]),
      { pkg: "web", page: "how-it-works" },
      sources
    );

    expect(view.page.html).toMatch(
      /^<figure data-component="diagram" data-diagram="pipeline"><svg data-diagram-art="pipeline"[^>]*>.*<\/svg><figcaption>Build to SPA<\/figcaption><\/figure>$/s
    );
  });

  it("fails the build when no page maps to the params", async () => {
    await expect(
      loadDocumentationPage(fakeDocs(pages), { pkg: "web", page: "nope" }, sources)
    ).rejects.toThrow("No docs page at /docs/web/nope/");
  });

  // Bug: a docs folder for a package missing from the family crashes deep inside the render.
  it("fails the build when the page's package is not in the family", async () => {
    const stray = page({ path: "/docs/ghost/", pkg: "ghost", slug: "index" });

    await expect(
      loadDocumentationPage(fakeDocs([stray]), { pkg: "ghost" }, sources)
    ).rejects.toThrow('Docs package "ghost" is not in the family');
  });
});

describe("installedSources", () => {
  // Bug: a typed version or a timestamp instead of a date reaches the sync badge.
  it("reads versions from node_modules and dates the check", () => {
    const manifest = readFileSync("node_modules/@moku-labs/web/package.json", "utf8");
    const { version } = JSON.parse(manifest) as { version: string };
    const resolvedSources = installedSources("node_modules", new Date("2026-11-02T23:59:00Z"));

    expect(resolvedSources.packages.find(entry => entry.id === "web")?.version).toBe(version);
    expect(resolvedSources.today).toBe("2026-11-02");
  });
});
