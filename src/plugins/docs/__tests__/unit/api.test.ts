import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createDocumentationApi } from "../../api";
import { createDocumentationState } from "../../state";
import type { DocumentationContext } from "../../types";

const captureKernelErrors = vi.hoisted(() =>
  vi.fn(async () => [
    { id: "duplicate-name", when: "createApp", message: "[moku] Duplicate.", hint: "Rename." }
  ])
);
vi.mock("../../../../lib/kernel-errors", () => ({ captureKernelErrors }));

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

// `worker` has no pages: prev/next must skip it.
const PACKAGES = ["core", "worker", "web"];

function setup(name = "docs") {
  const renderMarkdown = vi.fn(async (md: string) => `<main>${md}</main>`);
  const ctx: DocumentationContext = {
    config: { dir: fixture(name) },
    state: createDocumentationState(),
    require: () => ({ renderMarkdown })
  };
  return { api: createDocumentationApi(ctx, PACKAGES), ctx, renderMarkdown };
}

describe("docs api: loading", () => {
  // Bug: every API call re-reads and re-renders the whole tree (a build renders it per route).
  it("loads once, shared by concurrent first calls, and stores the pages in state", async () => {
    const { api, ctx, renderMarkdown } = setup();
    await Promise.all([api.all(), api.get("/docs/core/")]);
    await api.nav("web");
    expect(renderMarkdown).toHaveBeenCalledTimes(10);
    expect(ctx.state.pages?.size).toBe(10);
  });

  // Bug: a page loses its rendered HTML, raw Markdown, TOC or frontmatter fields.
  it("get() returns the rendered page with headings and frontmatter fields", async () => {
    const page = await setup().api.get("/docs/web/guides/routing/");
    expect(page).toMatchObject({
      pkg: "web",
      section: "guides",
      slug: "routing",
      title: "Routing",
      group: "Guides",
      order: 10,
      drift: "Router 2.5 adds splats.",
      full: false,
      file: "src/plugins/docs/__tests__/fixtures/docs/web/guides/routing.md"
    });
    expect(page?.markdown.startsWith("## Define a route")).toBe(true);
    expect(page?.html).toBe(`<main>${page?.markdown}</main>`);
    expect(page?.headings.map(heading => heading.id)).toEqual([
      "define-a-route",
      "params",
      "params-2",
      "the-route-call"
    ]);
    expect(await setup().api.get("/docs/web/missing/")).toBeUndefined();
  });

  // Bug: a page without `section` lands in a group no sidebar expects.
  it("puts pages without a section in Concepts or Get started", async () => {
    const { api } = setup();
    const concept = await api.get("/docs/concepts/plugins/");
    const home = await api.get("/docs/core/");
    expect(concept?.group).toBe("Concepts");
    expect(home?.group).toBe("Get started");
  });

  // Bug: a depth-4 file is silently skipped and the build passes without the page.
  it("rejects a tree with a depth-4 file, naming the file", async () => {
    await expect(setup("too-deep").api.all()).rejects.toThrow(
      "too-deep/web/a/b/c.md is deeper than <pkg>/<section>/<page>."
    );
  });

  // Bug: an unknown package folder builds pages nothing links to.
  it("rejects a tree with an unknown package folder, naming the file", async () => {
    await expect(setup("unknown-package").api.all()).rejects.toThrow(
      /unknown-package\/nope\/index\.md is in the unknown package folder "nope"/
    );
  });

  // Bug: a wrong `dir` builds a site with no docs and no error.
  it("rejects when the docs directory cannot be read", async () => {
    await expect(setup("no-such-dir").api.all()).rejects.toThrow(
      /\[docs\] The docs directory ".*no-such-dir" cannot be read/
    );
  });

  // Bug: one failed render poisons the API, so a retry returns the same rejection forever.
  it("retries the load after a failure", async () => {
    const { api, renderMarkdown } = setup();
    renderMarkdown.mockRejectedValueOnce(new Error("shiki down"));
    await expect(api.all()).rejects.toThrow("shiki down");
    expect(await api.all()).toHaveLength(10);
  });

  // Bug: the "What the kernel checks" page ships with an empty list.
  it("expands the kernel-errors marker before rendering", async () => {
    const page = await setup("kernel").api.get("/docs/concepts/kernel-checks/");
    expect(page?.markdown).toContain("[moku] Duplicate.");
    expect(page?.html).toContain("[moku] Duplicate.");
    expect(captureKernelErrors).toHaveBeenCalledTimes(1);
  });
});

describe("docs api: order and navigation", () => {
  // Bug: pages come out in file-system order, or a group whose `order` values interleave with
  // another group's (Install 15 after Guides 10) is split, so prev/next bounces between groups.
  it("all() sorts by package order, group, order, then title", async () => {
    const pages = await setup().api.all();
    const paths = pages.map(page => page.path);
    expect(paths).toEqual([
      "/docs/concepts/three-layers/",
      "/docs/concepts/plugins/",
      "/docs/core/",
      "/docs/web/",
      "/docs/web/quick-start/",
      "/docs/web/install/",
      "/docs/web/guides/islands/",
      "/docs/web/guides/routing/",
      "/docs/web/plugins/router/",
      "/docs/web/api/"
    ]);
  });

  // Bug: the sidebar groups appear alphabetically ("API reference" first) or pages shuffle.
  it("nav() returns groups in first-seen order, pages by order then title", async () => {
    expect(await setup().api.nav("web")).toEqual([
      {
        label: "Get started",
        pages: [
          { path: "/docs/web/", title: "Overview" },
          { path: "/docs/web/quick-start/", title: "Quick start" },
          { path: "/docs/web/install/", title: "Install" }
        ]
      },
      {
        label: "Guides",
        pages: [
          { path: "/docs/web/guides/islands/", title: "Islands" },
          { path: "/docs/web/guides/routing/", title: "Routing" }
        ]
      },
      { label: "Plugins", pages: [{ path: "/docs/web/plugins/router/", title: "router" }] },
      { label: "API reference", pages: [{ path: "/docs/web/api/", title: "API reference" }] }
    ]);
  });

  // Bug: byPackage leaks pages of another package into a package's page list.
  it("byPackage() returns only that package's pages", async () => {
    const pages = await setup().api.byPackage("concepts");
    expect(pages.map(page => page.slug)).toEqual(["three-layers", "plugins"]);
  });

  // Bug: "Next" is dead at a package's last page, or links into a package with no pages.
  it("neighbours() moves within a package and crosses to the neighbouring package home", async () => {
    const { api } = setup();
    expect(await api.neighbours("/docs/web/quick-start/")).toEqual({
      prev: { path: "/docs/web/", title: "Overview" },
      next: { path: "/docs/web/install/", title: "Install" }
    });
    expect(await api.neighbours("/docs/core/")).toEqual({
      prev: { path: "/docs/concepts/three-layers/", title: "Three layers" },
      next: { path: "/docs/web/", title: "Overview" }
    });
    expect(await api.neighbours("/docs/concepts/plugins/")).toEqual({
      prev: { path: "/docs/concepts/three-layers/", title: "Three layers" },
      next: { path: "/docs/core/", title: "Core" }
    });
  });

  // Bug: the first and last pages get a link to nowhere; an unknown path throws.
  it("neighbours() omits links past the ends and returns {} for an unknown path", async () => {
    const { api } = setup();
    expect(await api.neighbours("/docs/concepts/three-layers/")).toEqual({
      next: { path: "/docs/concepts/plugins/", title: "Plugins" }
    });
    expect(await api.neighbours("/docs/web/api/")).toEqual({
      prev: { path: "/docs/web/plugins/router/", title: "router" }
    });
    expect(await api.neighbours("/docs/nope/")).toEqual({});
  });

  // Bug: a page is generated by the wrong route, or by none, and 404s on the live site.
  it("params() returns the route params of each depth", async () => {
    const { api } = setup();
    expect(await api.params(1)).toEqual([{ pkg: "core" }, { pkg: "web" }]);
    expect(await api.params(2)).toEqual([
      { pkg: "concepts", page: "three-layers" },
      { pkg: "concepts", page: "plugins" },
      { pkg: "web", page: "quick-start" },
      { pkg: "web", page: "install" },
      { pkg: "web", page: "api" }
    ]);
    expect(await api.params(3)).toEqual([
      { pkg: "web", section: "guides", page: "islands" },
      { pkg: "web", section: "guides", page: "routing" },
      { pkg: "web", section: "plugins", page: "router" }
    ]);
  });
});
