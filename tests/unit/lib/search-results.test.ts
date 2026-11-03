import { describe, expect, it } from "vitest";
import { isSearchShard, markMatch, searchResults } from "../../../src/lib/search-results";
import type { DocumentPage } from "../../../src/plugins/docs/types";
import { buildSearchShard } from "../../../src/plugins/search/shard";
import type { SearchEntry, SearchKind, SearchShard } from "../../../src/plugins/search/types";

const row = (kind: SearchKind, title: string, subtitle: string, href: string): SearchEntry => ({
  kind,
  title,
  subtitle,
  href,
  icon: "web"
});

/**
 * A docs page holding only what the shard reads.
 *
 * @param path - Its URL path.
 * @param markdown - Its body.
 * @param headings - Heading ids and text, in document order.
 * @returns The page.
 */
function page(path: string, markdown: string, headings: [string, string][] = []): DocumentPage {
  return {
    path,
    pkg: "web",
    section: undefined,
    slug: "page",
    title: "Page",
    description: "",
    order: 0,
    group: "Group",
    drift: undefined,
    full: false,
    markdown,
    html: "",
    headings: headings.map(([id, text]) => ({ id, text, depth: 2 })),
    file: `content${path}.md`
  };
}

const ENTRIES: SearchEntry[] = [
  row("Page", "Home", "Effects of a good start", "/"),
  row("Guide", "Routing", "One route table", "/docs/web/guides/routing/"),
  row("Guide", "Head", "Titles per route", "/docs/web/guides/head/"),
  row("Plugin", "router", "Matches paths", "/docs/web/plugins/router/"),
  row("Plugin", "effects", "Particles and filters", "/docs/game/plugins/effects/"),
  row("Plugin", "createApp notes", "Code", "/docs/web/plugins/noted/"),
  row("Guide", "Quick start", "Install it", "/docs/web/quick-start/"),
  row("Section", "Params", "Routing", "/docs/web/guides/routing/#params"),
  row("Section", "Effects", "Guide", "/docs/game/guides/#effects"),
  row("Section", "Nested", "Quick start", "/docs/web/quick-start/#nested")
];

const PAGES: DocumentPage[] = [
  page("/docs/web/guides/routing/", "Intro text.\n\n## Params\n\nThe wildcard form.", [
    ["params", "Params"]
  ]),
  page(
    "/docs/web/quick-start/",
    "Intro with effects in the body.\n\n## Nested\n\n```ts\ndefineGame();\n```\n\n",
    [["nested", "Nested"]]
  )
];

const SHARD: SearchShard = buildSearchShard(ENTRIES, PAGES);

const hrefs = (query: string): string[] =>
  searchResults(SHARD, query, []).map(result => result.href);

describe("searchResults", () => {
  // Bug: an empty query shows nothing, or the suggestions come out in index order.
  it("shows the suggested entries in their order when the query is empty", () => {
    const results = searchResults(SHARD, "  ", [
      "/docs/web/quick-start/",
      "/nope/",
      "/docs/web/guides/routing/"
    ]);

    expect(results.map(result => result.title)).toEqual(["Quick start", "Routing"]);
  });

  // Bug: with no suggestion in the index the palette opens empty.
  it("falls back to the first entries when no suggestion exists", () => {
    expect(searchResults(SHARD, "", ["/gone/"], 2).map(result => result.title)).toEqual([
      "Home",
      "Routing"
    ]);
  });

  // Bug: the alias table is not read, so `fx` finds nothing; or a body hit outranks the title.
  it("finds the effects page first through the alias fx", () => {
    expect(hrefs("fx")[0]).toBe("/docs/game/plugins/effects/");
  });

  // Bug: the binary search misses the first term of a prefix range, so `eff` finds nothing.
  it("finds the effects page first by the prefix eff", () => {
    expect(hrefs("eff")[0]).toBe("/docs/game/plugins/effects/");
  });

  // Bug: the edit distance rejects a dropped letter, so a typo ends in "Nothing matches".
  it("finds the effects page first through the typo efects", () => {
    expect(hrefs("efects")[0]).toBe("/docs/game/plugins/effects/");
  });

  // Bug: fence bodies are left out of the index, so `defineGame` finds nothing.
  it("finds a word that appears only in a code block", () => {
    expect(hrefs("defineGame")).toEqual(["/docs/web/quick-start/#nested"]);
  });

  // Bug: h3 sections or section text stay out of the rows, so the heading's anchor is unreachable.
  it("returns the anchor of the section a word appears in", () => {
    expect(hrefs("wildcard")).toEqual(["/docs/web/guides/routing/#params"]);
  });

  // Bug: several tokens are joined with OR, so `route head` lists every page with either word.
  it("returns only entries with all the words of the query", () => {
    expect(hrefs("route head")).toEqual(["/docs/web/guides/head/"]);
  });

  // Bug: weights are ignored, so index order puts a body hit above a page titled with the word.
  it("ranks a title match above a body match of the same word", () => {
    const found = hrefs("effects");

    expect(found.indexOf("/docs/game/plugins/effects/")).toBeLessThan(
      found.indexOf("/docs/web/quick-start/")
    );
    expect(found.indexOf("/docs/web/quick-start/")).toBeGreaterThan(-1);
  });

  // Bug: a prefix scores like an exact match, so `Routes` beats a page titled `Route` by index.
  it("ranks an exact term above a longer term with that prefix", () => {
    const shard = buildSearchShard(
      [row("Guide", "Routes", "", "/routes/"), row("Guide", "Route", "", "/route/")],
      []
    );

    expect(searchResults(shard, "route", []).map(result => result.href)).toEqual([
      "/route/",
      "/routes/"
    ]);
  });

  // Bug: the last candidate of a token overwrites the best one, so a title prefix loses to a body hit.
  it("keeps the best candidate of a token for an entry", () => {
    const shard = buildSearchShard(
      [row("Guide", "Other", "routes", "/subtitle/"), row("Guide", "Routes", "", "/title/")],
      [page("/title/", "route is in the body")]
    );

    expect(searchResults(shard, "route", []).map(result => result.href)).toEqual([
      "/title/",
      "/subtitle/"
    ]);
  });

  // Bug: a section listed before its page wins a tie, and the page row sinks below it.
  it("puts a page row before a section at equal score", () => {
    // Section: heading 8 + text 1 = 9. Guide: (subtitle 3 + subtitle 3) x 1.5 = 9.
    const shard = buildSearchShard(
      [row("Section", "Alpha part", "", "/a/#part"), row("Guide", "Other", "Alpha beta", "/b/")],
      [page("/a/", "## Alpha part\n\nbeta", [["part", "Alpha part"]])]
    );

    expect(searchResults(shard, "alpha beta", []).map(result => result.kind)).toEqual([
      "Guide",
      "Section"
    ]);
  });

  // Bug: every prefix scores the same, so index order puts a far longer word above a close one.
  it("ranks a closer prefix above a longer word", () => {
    const shard = buildSearchShard(
      [row("Guide", "Routines guide", "", "/far/"), row("Guide", "Router guide", "", "/close/")],
      []
    );

    expect(searchResults(shard, "rout", []).map(result => result.href)).toEqual([
      "/close/",
      "/far/"
    ]);
  });

  // Bug: a plural is only a prefix, so `island` ties with `islandy` and `box` with `boxed`.
  it("counts the token plus s or es above another word of that length", () => {
    const shard = buildSearchShard(
      [
        row("Guide", "Islandy guide", "", "/islandy/"),
        row("Guide", "Islands guide", "", "/islands/"),
        row("Guide", "Boxed guide", "", "/boxed/"),
        row("Guide", "Boxes guide", "", "/boxes/")
      ],
      []
    );

    expect(searchResults(shard, "island", []).map(result => result.href)).toEqual([
      "/islands/",
      "/islandy/"
    ]);
    expect(searchResults(shard, "box", []).map(result => result.href)).toEqual([
      "/boxes/",
      "/boxed/"
    ]);
  });

  // Bug: a section with the exact word outranks the page about it, as `route` did on the real docs.
  it("multiplies a row that is not a section by 1.5", () => {
    const shard = buildSearchShard(
      [row("Section", "Route table", "", "/a/#table"), row("Plugin", "router guide", "", "/b/")],
      []
    );

    expect(searchResults(shard, "route", []).map(result => result.kind)).toEqual([
      "Plugin",
      "Section"
    ]);
  });

  // Bug: a title that only contains the word ties with the title that is the word.
  it("multiplies a row whose whole title is the query by 2", () => {
    const shard = buildSearchShard(
      [row("Guide", "Head and more", "", "/more/"), row("Guide", "Head", "", "/whole/")],
      []
    );

    expect(searchResults(shard, "head", []).map(result => result.href)).toEqual([
      "/whole/",
      "/more/"
    ]);
  });

  // Bug: whole-title folding is missing, so `island` puts "Island hopping" above the Islands guide.
  it("folds plurals when it compares the whole title", () => {
    const shard = buildSearchShard(
      [row("Guide", "Island hopping", "", "/hop/"), row("Guide", "Islands", "", "/islands/")],
      []
    );

    expect(searchResults(shard, "island", []).map(result => result.href)).toEqual([
      "/islands/",
      "/hop/"
    ]);
  });

  // Bug: only the typed tokens are compared, so `fx` does not lift the page titled effects.
  it("counts a whole title that equals an alias target", () => {
    const shard = buildSearchShard(
      [row("Guide", "Effects today", "", "/today/"), row("Guide", "Effects", "", "/effects/")],
      []
    );

    expect(searchResults(shard, "fx", []).map(result => result.href)).toEqual([
      "/effects/",
      "/today/"
    ]);
  });

  // Bug: the first posting reads right and the rest as whole indices, so a query lists wrong pages.
  it("decodes the postings of a term as distances", () => {
    const shard: SearchShard = {
      entries: [
        row("Guide", "Zero", "", "/0/"),
        row("Guide", "One", "", "/1/"),
        row("Guide", "Two", "", "/2/"),
        row("Guide", "Three", "", "/3/")
      ],
      terms: ["word"],
      postings: [[1, 8, 2, 3]],
      aliases: {}
    };

    expect(searchResults(shard, "word", []).map(result => result.href)).toEqual(["/1/", "/3/"]);
  });

  // Bug: a posting past the rows (a stale shard from another build) throws and the palette hangs.
  it("skips a posting that points past the rows", () => {
    const shard: SearchShard = {
      entries: [row("Guide", "Word", "", "/0/")],
      terms: ["word"],
      postings: [[0, 8, 5, 8]],
      aliases: {}
    };

    expect(searchResults(shard, "word", []).map(result => result.href)).toEqual(["/0/"]);
  });

  // Bug: ties are not broken by index, so the order of equal results changes between engines.
  it("keeps index order at equal score", () => {
    const shard = buildSearchShard(
      [row("Guide", "Effects one", "", "/1/"), row("Guide", "Effects two", "", "/2/")],
      []
    );

    expect(searchResults(shard, "effects", []).map(result => result.href)).toEqual(["/1/", "/2/"]);
  });

  // Bug: the typo step always runs, so an exact `mode` also lists every page about `node`.
  it("looks for typos only when nothing else matched", () => {
    const shard = buildSearchShard(
      [row("Guide", "Mode", "", "/mode/"), row("Guide", "Node", "", "/node/")],
      []
    );

    expect(searchResults(shard, "mode", []).map(result => result.href)).toEqual(["/mode/"]);
  });

  // Bug: the length guard is off by one, so a three-letter query matches any near word.
  it("looks for typos only from 4 characters", () => {
    const shard = buildSearchShard(
      [row("Guide", "Box", "", "/box/"), row("Guide", "Books", "", "/books/")],
      []
    );

    expect(searchResults(shard, "bax", [])).toEqual([]);
    expect(searchResults(shard, "boks", []).map(result => result.href)).toEqual(["/books/"]);
    expect(searchResults(shard, "boooks", []).map(result => result.href)).toEqual(["/books/"]);
    expect(searchResults(shard, "bouks", []).map(result => result.href)).toEqual(["/books/"]);
  });

  // Bug: two edits pass the check, so a query that is another word lists unrelated pages.
  it("does not accept two edits as a typo", () => {
    const shard = buildSearchShard([row("Guide", "Effects", "", "/effects/")], []);

    expect(searchResults(shard, "efcets", [])).toEqual([]);
    expect(searchResults(shard, "defects", [])).toEqual([]);
  });

  // Bug: a swap of two neighbouring letters counts as two edits, so `rotuer` ends in "Nothing matches".
  it("accepts one swap of adjacent letters as a typo", () => {
    const shard = buildSearchShard([row("Plugin", "router", "", "/router/")], []);

    expect(searchResults(shard, "rotuer", []).map(result => result.href)).toEqual(["/router/"]);
  });

  // Bug: only the swapped pair is compared, so a swap plus another wrong letter still matches.
  it("does not accept a swap with another wrong letter", () => {
    const shard = buildSearchShard([row("Plugin", "router", "", "/router/")], []);

    expect(searchResults(shard, "rotuor", [])).toEqual([]);
  });

  // Bug: a nonsense query shows unrelated rows instead of the status line.
  it("returns nothing for a nonsense query", () => {
    expect(hrefs("zzqxv")).toEqual([]);
  });

  // Bug: a query that leaves no token says "Nothing matches" while `the` is on its way to `theme`.
  it("looks up a query that leaves no token as one prefix", () => {
    const shard = buildSearchShard(
      [row("Guide", "Theme", "", "/theme/"), row("Guide", "Entry", "", "/entry/")],
      []
    );

    expect(searchResults(shard, "the", []).map(result => result.href)).toEqual(["/theme/"]);
    expect(searchResults(shard, " E ", []).map(result => result.href)).toEqual(["/entry/"]);
  });

  // Bug: a query with no word in it counts as empty and shows the suggestions as matches.
  it("returns nothing when the raw prefix of such a query matches nothing", () => {
    expect(searchResults(SHARD, "!!!", ["/docs/web/quick-start/"])).toEqual([]);
  });

  // Bug: `aliases.constructor` is the inherited Object function, and the palette throws on it.
  it("does not read inherited keys of the alias table", () => {
    expect(hrefs("constructor")).toEqual([]);
  });

  // Bug: a long result list spills past the palette.
  it("returns at most the limit", () => {
    expect(searchResults(SHARD, "routing", [], 1)).toHaveLength(1);
    const many = ["a", "b", "c"].map(name => row("Guide", "Effects", "", `/${name}/`));
    expect(searchResults(buildSearchShard(many, []), "effects", [], 2)).toHaveLength(2);
  });
});

describe("markMatch", () => {
  // Bug: the highlight lands on the wrong letters or changes their case.
  it("marks the first match and keeps the original case", () => {
    expect(markMatch("Guide to SEO and seo", "seo", SHARD)).toEqual([
      { text: "Guide to ", marked: false },
      { text: "SEO", marked: true },
      { text: " and seo", marked: false }
    ]);
  });

  // Bug: only the typed text is looked for, so `fx` finds Effects and highlights nothing.
  it("marks the alias target of a query token", () => {
    expect(markMatch("Effects", "fx", SHARD)).toEqual([{ text: "Effects", marked: true }]);
  });

  // Bug: a prefix match is not marked, or the whole word is.
  it("marks the typed part of a prefix match", () => {
    expect(markMatch("Effects", "eff", SHARD)).toEqual([
      { text: "Eff", marked: true },
      { text: "ects", marked: false }
    ]);
  });

  // Bug: `the` lists Theme through the raw prefix, and the row shows no highlight.
  it("marks the raw prefix of a query that leaves no token", () => {
    expect(markMatch("Theme", "the", SHARD)).toEqual([
      { text: "The", marked: true },
      { text: "me", marked: false }
    ]);
  });

  // Bug: a typo match gets a mark on letters that are not what the visitor typed.
  it("gives a typo match no mark", () => {
    expect(markMatch("Effects", "efects", SHARD)).toEqual([{ text: "Effects", marked: false }]);
  });

  // Bug: only the first query word is marked.
  it("marks each query token", () => {
    expect(markMatch("Route head", "head route", SHARD)).toEqual([
      { text: "Route", marked: true },
      { text: " ", marked: false },
      { text: "head", marked: true }
    ]);
  });

  // Bug: overlapping ranges of `createapp`, `create` and `app` print the letters twice.
  it("merges the overlapping marks of a camelCase query", () => {
    expect(markMatch("The createApp call", "createApp", SHARD)).toEqual([
      { text: "The ", marked: false },
      { text: "createApp", marked: true },
      { text: " call", marked: false }
    ]);
  });

  // Bug: a token is marked inside a word, so `ui` highlights the middle of "Build".
  it("marks a token only where a word starts", () => {
    expect(markMatch("Build UI", "ui", SHARD)).toEqual([
      { text: "Build ", marked: false },
      { text: "UI", marked: true }
    ]);
  });

  // Bug: word starts ignore camelCase, so `app` and `element` find the word and mark nothing.
  it("treats a camelCase part as a word start", () => {
    expect(markMatch("createApp", "app", SHARD)).toEqual([
      { text: "create", marked: false },
      { text: "App", marked: true }
    ]);
    expect(markMatch("HTMLElement", "element", SHARD)).toEqual([
      { text: "HTML", marked: false },
      { text: "Element", marked: true }
    ]);
  });

  // Bug: no match (or no query) drops the text; or `constructor` throws on the inherited key.
  it("returns the whole text unmarked when nothing matches", () => {
    expect(markMatch("Routing", "zzz", SHARD)).toEqual([{ text: "Routing", marked: false }]);
    expect(markMatch("Routing", "", SHARD)).toEqual([{ text: "Routing", marked: false }]);
    expect(markMatch("Routing", "constructor", SHARD)).toEqual([
      { text: "Routing", marked: false }
    ]);
  });
});

describe("isSearchShard", () => {
  // Bug: a cached array from before this format reaches the query code, which throws on `terms`.
  it("accepts the shard and refuses the old array and other JSON", () => {
    expect(isSearchShard(SHARD)).toBe(true);
    expect(isSearchShard([{ href: "/" }])).toBe(false);
    expect(isSearchShard({ entries: [], terms: [], postings: [] })).toBe(false);
    expect(isSearchShard(undefined)).toBe(false);
  });
});
