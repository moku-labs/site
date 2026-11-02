import type { Collection } from "@moku-labs/web";
import { describe, expect, it, vi } from "vitest";
import { docsPlugin } from "../../../docs";
import type { DocumentationApi, DocumentHeading, DocumentPage } from "../../../docs/types";
import { buildSearchIndex, createSearchApi } from "../../api";
import { createSearchState } from "../../state";
import type { SearchContext, SearchEntry, SearchSources } from "../../types";

function page(path: string, title: string, headings: DocumentHeading[] = []): DocumentPage {
  const [, pkg = "", ...rest] = path.split("/").filter(Boolean);
  return {
    path,
    pkg,
    section: rest.length === 2 ? rest[0] : undefined,
    slug: rest.at(-1) ?? "index",
    title,
    description: `${title} description.`,
    order: 0,
    group: "Group",
    drift: undefined,
    full: false,
    markdown: "",
    html: "",
    headings,
    file: `content${path}.md`
  };
}

const WEB = { id: "web", name: "@moku-labs/web", tagline: "Web framework." };
const DEMO = {
  id: "timber-town",
  name: "Timber Town",
  description: "A city game.",
  stack: ["game"]
};

const kindOf = (rows: readonly SearchEntry[], href: string) =>
  rows.filter(row => row.href === href).map(row => row.kind);

describe("buildSearchIndex", () => {
  // Bug: a result is mislabelled (a plugin page shown as a guide, a package home as a page).
  it("derives the kind of a docs page from its path", () => {
    const rows = buildSearchIndex({
      pages: [
        page("/docs/concepts/plugins/", "Plugins"),
        page("/docs/web/", "Overview"),
        page("/docs/web/install/", "Install"),
        page("/docs/web/guides/routing/", "Routing"),
        page("/docs/web/plugins/router/", "router"),
        page("/docs/web/api/", "API reference")
      ],
      packages: [],
      demos: []
    });
    expect(kindOf(rows, "/docs/concepts/plugins/")).toEqual(["Concept"]);
    expect(kindOf(rows, "/docs/web/")).toEqual(["Package"]);
    expect(kindOf(rows, "/docs/web/install/")).toEqual(["Page"]);
    expect(kindOf(rows, "/docs/web/guides/routing/")).toEqual(["Guide"]);
    expect(kindOf(rows, "/docs/web/plugins/router/")).toEqual(["Plugin"]);
    expect(kindOf(rows, "/docs/web/api/")).toEqual(["API"]);
    expect(rows.find(row => row.href === "/docs/concepts/plugins/")).toEqual({
      kind: "Concept",
      title: "Plugins",
      subtitle: "Plugins description.",
      href: "/docs/concepts/plugins/",
      icon: "concept"
    });
    expect(rows.find(row => row.href === "/docs/web/install/")?.icon).toBe("web");
  });

  // Bug: a section links to a dead anchor, or h3 headings flood the palette.
  it("turns every h2 of a page into a Section with the page path and the heading id", () => {
    const rows = buildSearchIndex({
      pages: [
        page("/docs/web/guides/routing/", "Routing", [
          { id: "define-a-route", text: "Define a route", depth: 2 },
          { id: "params", text: "Params", depth: 3 },
          { id: "params-2", text: "Params", depth: 2 }
        ])
      ],
      packages: [],
      demos: []
    });
    expect(rows.filter(row => row.kind === "Section")).toEqual([
      {
        kind: "Section",
        title: "Define a route",
        subtitle: "Routing",
        href: "/docs/web/guides/routing/#define-a-route",
        icon: "web"
      },
      {
        kind: "Section",
        title: "Params",
        subtitle: "Routing",
        href: "/docs/web/guides/routing/#params-2",
        icon: "web"
      }
    ]);
  });

  // Bug: a package shows twice (its data entry and its docs home), or demos and fixed pages are lost.
  it("lists each package, demo and fixed page once", () => {
    const rows = buildSearchIndex({
      pages: [page("/docs/web/", "Overview", [{ id: "features", text: "Features", depth: 2 }])],
      packages: [WEB, { id: "core", name: "@moku-labs/core", tagline: "The kernel." }],
      demos: [DEMO]
    });
    expect(rows.filter(row => row.href === "/docs/web/")).toEqual([
      {
        kind: "Package",
        title: "@moku-labs/web",
        subtitle: "Web framework.",
        href: "/docs/web/",
        icon: "web"
      }
    ]);
    expect(kindOf(rows, "/docs/core/")).toEqual(["Package"]);
    expect(kindOf(rows, "/docs/web/#features")).toEqual(["Section"]);
    expect(rows.filter(row => row.href === "/demos/#timber-town")).toEqual([
      {
        kind: "Page",
        title: "Timber Town",
        subtitle: "A city game.",
        href: "/demos/#timber-town",
        icon: "demo"
      }
    ]);
    expect(rows.filter(row => row.icon === "page").map(row => [row.title, row.href])).toEqual([
      ["Home", "/"],
      ["Docs", "/docs/"],
      ["Demos", "/demos/"],
      ["About", "/about/"]
    ]);
    expect(new Set(rows.map(row => row.href)).size).toBe(rows.length);
  });
});

const PAGES = [
  page("/docs/web/guides/routing/", "Routing", [{ id: "params", text: "Params", depth: 2 }])
];

function setup() {
  const sources: SearchSources = { packages: () => [WEB], demos: [DEMO] };
  const docs: Pick<DocumentationApi, "all"> = { all: vi.fn(async () => PAGES) };
  const collection: Pick<Collection.CollectionProvider, "write"> = {
    write: vi.fn(async () => ({ fileCount: 1, bytes: 10, files: ["search/en.json"] }))
  };
  const require = ((plugin: object) =>
    plugin === docsPlugin ? docs : collection) as unknown as SearchContext["require"];
  const ctx: SearchContext = {
    config: { collection: "search", shard: "en", outDir: "site-out" },
    state: createSearchState(),
    require,
    log: { error: vi.fn() }
  };
  return { api: createSearchApi(ctx, sources), ctx, docs, collection };
}

describe("search api", () => {
  // Bug: entries() ignores the docs pages or the injected packages and demos.
  it("entries() builds the index from the docs, packages and demos sources", async () => {
    const rows = await setup().api.entries();
    expect(kindOf(rows, "/docs/web/guides/routing/")).toEqual(["Guide"]);
    expect(kindOf(rows, "/docs/web/guides/routing/#params")).toEqual(["Section"]);
    expect(kindOf(rows, "/docs/web/")).toEqual(["Package"]);
    expect(kindOf(rows, "/demos/#timber-town")).toEqual(["Page"]);
  });

  // Bug: the shard lands under another collection/shard key, or the outDir argument is ignored.
  it("write() persists every row as the configured shard under the given or configured outDir", async () => {
    const { api, collection } = setup();
    const rows = await api.entries();

    expect(await api.write("preview")).toEqual({ count: rows.length });
    expect(collection.write).toHaveBeenLastCalledWith(
      [{ collection: "search", shard: "en", data: rows }],
      { outDir: "preview" }
    );

    await api.write();
    expect(collection.write).toHaveBeenLastCalledWith(expect.any(Array), { outDir: "site-out" });
  });
});
