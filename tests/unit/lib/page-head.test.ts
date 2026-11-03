import { describe, expect, it } from "vitest";
import { SITE } from "../../../src/config";
import { documentationHead, homeHead, sitePageHead } from "../../../src/lib/page-head";

type Crumb = { position: number; name: string; item: string };
type LinkedData = { "@type": string; itemListElement?: Crumb[]; image?: string; url?: string };
type Head = ReturnType<typeof homeHead>;

/**
 * The JSON-LD objects of a head.
 *
 * @param head - The head fields.
 * @returns The parsed objects, in order.
 */
function linkedData(head: Head): LinkedData[] {
  return (head.elements ?? [])
    .filter(element => element.tag === "script")
    .map(element => JSON.parse(element.children ?? "") as LinkedData);
}

/**
 * The content of one meta element of a head.
 *
 * @param head - The head fields.
 * @param name - The `property` or `name` of the element.
 * @returns Its content, or `undefined` when the head has none.
 */
function metaContent(head: Head, name: string): string | undefined {
  const found = (head.elements ?? []).find(
    element => element.attrs?.property === name || element.attrs?.name === name
  );
  return found?.attrs?.content;
}

/**
 * The breadcrumb names of a head.
 *
 * @param head - The head fields.
 * @returns The names, in order.
 */
function crumbs(head: Head): (string | undefined)[] {
  const list = linkedData(head).find(item => item["@type"] === "BreadcrumbList");
  return (list?.itemListElement ?? []).map(crumb => crumb.name);
}

const view = {
  headTitle: "Routing · @moku-labs/web",
  page: {
    path: "/docs/web/guides/routing/",
    title: "Routing",
    description: "One typed builder."
  },
  package: { name: "@moku-labs/web", home: "/docs/web/" }
};

describe("homeHead", () => {
  // Bug: the keyed title is lost, and the tab reads "Moku Labs — Moku Labs" again.
  it("pins the title past the template and points at the home card", () => {
    const head = homeHead();

    expect(head.elements?.find(element => element.key === "title")?.children).toBe(SITE.name);
    expect(head.image).toBe("/og/home.png");
  });

  // Bug: the home page claims a breadcrumb or misses the site and organisation data search reads.
  it("describes the site and the organisation as a website", () => {
    const head = homeHead();

    expect(linkedData(head).map(item => item["@type"])).toEqual(["WebSite", "Organization"]);
    expect(metaContent(head, "og:type")).toBe("website");
  });
});

describe("sitePageHead", () => {
  // Bug: a site page shares the home card, or is typed as an article.
  it("uses the page's own card, typed as a website, with a crumb back home", () => {
    const head = sitePageHead({ path: "/demos/", title: "Demos", description: "Six apps." });

    expect(head.image).toBe("/og/demos.png");
    expect(metaContent(head, "og:type")).toBe("website");
    expect(crumbs(head)).toEqual([SITE.name, "Demos"]);
    expect(linkedData(head).map(item => item["@type"])).toEqual(["BreadcrumbList"]);
  });

  // Bug: only part of the card tags ship, and a sharing target guesses the image size.
  it("carries the size, the alt text and the site name of the card", () => {
    const head = sitePageHead({ path: "/about/", title: "About", description: "Who." });

    expect(metaContent(head, "og:site_name")).toBe(SITE.name);
    expect(metaContent(head, "og:image:width")).toBe("1200");
    expect(metaContent(head, "og:image:height")).toBe("630");
    expect(metaContent(head, "og:image:alt")).toContain("About");
    expect(metaContent(head, "twitter:image:alt")).toBe(metaContent(head, "og:image:alt"));
  });
});

describe("documentationHead", () => {
  // Bug: the head title loses the package name, so pages with one title clash in search results.
  it("keeps the head title and the full description", () => {
    const head = documentationHead(view);

    expect(head.title).toBe(view.headTitle);
    expect(head.description).toBe(view.page.description);
  });

  // Bug: a docs page is typed as a website, or its article data points at another page's card.
  it("describes a docs page as an article with its own card", () => {
    const head = documentationHead(view);
    const article = linkedData(head).find(item => item["@type"] === "TechArticle");

    expect(head.image).toBe("/og/docs/web/guides/routing.png");
    expect(metaContent(head, "og:type")).toBe("article");
    expect(article?.image).toBe(`${SITE.url}/og/docs/web/guides/routing.png`);
    expect(article?.url).toBe(`${SITE.url}/docs/web/guides/routing/`);
  });

  // Bug: a crumb is missing or misnumbered, and the last crumb is not the page itself.
  it("walks home, docs, package, page with numbered absolute links", () => {
    const list = linkedData(documentationHead(view)).find(
      item => item["@type"] === "BreadcrumbList"
    );

    expect(list?.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: SITE.name, item: SITE.url },
      { "@type": "ListItem", position: 2, name: "Docs", item: `${SITE.url}/docs/` },
      { "@type": "ListItem", position: 3, name: "@moku-labs/web", item: `${SITE.url}/docs/web/` },
      {
        "@type": "ListItem",
        position: 4,
        name: "Routing",
        item: `${SITE.url}/docs/web/guides/routing/`
      }
    ]);
  });

  // Bug: a package's home lists itself twice in its own breadcrumb.
  it("does not repeat the package on its own home page", () => {
    const home = {
      ...view,
      page: { ...view.page, path: "/docs/web/", title: "@moku-labs/web" }
    };

    expect(crumbs(documentationHead(home))).toEqual([SITE.name, "Docs", "@moku-labs/web"]);
  });

  // Bug: a concepts page links a package home that does not exist: `/docs/concepts/` is no page.
  it("skips the package crumb when the package has no home", () => {
    const concept = {
      headTitle: "Three layers",
      page: { path: "/docs/concepts/three-layers/", title: "Three layers", description: "Who." },
      package: { name: "Concepts" }
    };

    expect(crumbs(documentationHead(concept))).toEqual([SITE.name, "Docs", "Three layers"]);
  });
});
