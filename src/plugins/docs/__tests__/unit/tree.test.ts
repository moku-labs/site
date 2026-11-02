import { describe, expect, it } from "vitest";
import { locateDocument } from "../../tree";

const known = ["concepts", "web"];

describe("locateDocument", () => {
  // Bug: a package home lands on /docs/web/index/ instead of /docs/web/.
  it("maps <pkg>/index.md to the package home", () => {
    expect(locateDocument("web/index.md", known, "content/docs/web/index.md")).toEqual({
      path: "/docs/web/",
      pkg: "web",
      section: undefined,
      slug: "index"
    });
  });

  // Bug: a top-level page gets the wrong URL or a phantom section.
  it("maps <pkg>/<page>.md to a depth-2 path", () => {
    expect(locateDocument("web/quick-start.md", known, "x")).toEqual({
      path: "/docs/web/quick-start/",
      pkg: "web",
      section: undefined,
      slug: "quick-start"
    });
  });

  // Bug: the section folder is dropped from the URL.
  it("maps <pkg>/<section>/<page>.md to a depth-3 path", () => {
    expect(locateDocument("web/guides/routing.md", known, "x")).toEqual({
      path: "/docs/web/guides/routing/",
      pkg: "web",
      section: "guides",
      slug: "routing"
    });
  });

  // Bug: a depth-4 file is silently dropped, so a page vanishes from the site.
  it("throws on a file deeper than <pkg>/<section>/<page>, naming it", () => {
    expect(() => locateDocument("web/a/b/c.md", known, "content/docs/web/a/b/c.md")).toThrow(
      "[docs] content/docs/web/a/b/c.md is deeper than <pkg>/<section>/<page>."
    );
  });

  // Bug: a typo'd package folder publishes pages under a URL no nav links to.
  it("throws on an unknown package folder, naming the file", () => {
    expect(() => locateDocument("wbe/index.md", known, "content/docs/wbe/index.md")).toThrow(
      /content\/docs\/wbe\/index\.md is in the unknown package folder "wbe"/
    );
  });

  // Bug: a stray file at the docs root becomes a package called "notes.md".
  it("throws on a file at the docs root, naming it", () => {
    expect(() => locateDocument("notes.md", known, "content/docs/notes.md")).toThrow(
      /content\/docs\/notes\.md is not inside a package folder/
    );
  });
});
