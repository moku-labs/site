import { describe, expect, it } from "vitest";
import { markMatch, searchResults } from "../../../src/lib/search-results";
import type { SearchEntry } from "../../../src/plugins/search/types";

const entry = (title: string, subtitle: string, href: string): SearchEntry => ({
  kind: "Guide",
  title,
  subtitle,
  href,
  icon: "web"
});

const entries: SearchEntry[] = [
  entry("Islands", "Interactive parts on static HTML", "/docs/web/guides/islands/"),
  entry("Routing", "One route table for build and browser", "/docs/web/guides/routing/"),
  entry("The router plugin", "Matches paths and builds links", "/docs/web/plugins/router/"),
  entry("Quick start", "From an empty folder to a deployed site", "/docs/web/quick-start/"),
  entry("Head & SEO", "Titles, meta and Open Graph per route", "/docs/web/guides/head/")
];

describe("searchResults", () => {
  // Bug: an empty query shows nothing, or the suggestions come out in index order.
  it("shows the suggested entries in their order when the query is empty", () => {
    const results = searchResults(entries, "  ", [
      "/docs/web/quick-start/",
      "/nope/",
      "/docs/web/guides/routing/"
    ]);

    expect(results.map(result => result.title)).toEqual(["Quick start", "Routing"]);
  });

  // Bug: with no suggestion in the index the palette opens empty.
  it("falls back to the first entries when no suggestion exists", () => {
    expect(searchResults(entries, "", ["/gone/"], 2).map(result => result.title)).toEqual([
      "Islands",
      "Routing"
    ]);
  });

  // Bug: matching is case-sensitive, or a subtitle hit outranks a title that starts with the query.
  it("ranks a title that starts with the query first, then a title hit, then a subtitle hit", () => {
    const results = searchResults(entries, "ROUT", []);

    expect(results.map(result => result.title)).toEqual([
      "Routing",
      "The router plugin",
      "Head & SEO"
    ]);
  });

  // Bug: a long result list spills past the palette.
  it("returns at most the limit", () => {
    expect(searchResults(entries, "e", [], 3)).toHaveLength(3);
  });
});

describe("markMatch", () => {
  // Bug: the highlight lands on the wrong letters or changes their case.
  it("marks the first match and keeps the original case", () => {
    expect(markMatch("Head & SEO", "seo")).toEqual([
      { text: "Head & ", marked: false },
      { text: "SEO", marked: true }
    ]);
  });

  // Bug: no match (or no query) drops the text.
  it("returns the whole text unmarked when nothing matches", () => {
    expect(markMatch("Routing", "zzz")).toEqual([{ text: "Routing", marked: false }]);
    expect(markMatch("Routing", "")).toEqual([{ text: "Routing", marked: false }]);
  });
});
