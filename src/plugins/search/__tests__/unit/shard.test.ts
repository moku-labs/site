import { describe, expect, it } from "vitest";
import type { DocumentHeading, DocumentPage } from "../../../docs/types";
import { buildSearchShard } from "../../shard";
import type { SearchEntry, SearchShard } from "../../types";

function page(path: string, markdown: string, headings: DocumentHeading[] = []): DocumentPage {
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
    headings,
    file: "content/docs/web/page.md"
  };
}

const guide = (title: string, subtitle: string, href: string): SearchEntry => ({
  kind: "Guide",
  title,
  subtitle,
  href,
  icon: "web"
});

const section = (title: string, href: string): SearchEntry => ({
  kind: "Section",
  title,
  subtitle: "Page title",
  href,
  icon: "web"
});

/**
 * The weights of a term per entry index.
 *
 * @param shard - The shard.
 * @param term - The term.
 * @returns `[entryIndex, weight]` pairs; empty when the term is absent.
 */
function postingsOf(shard: SearchShard, term: string): [number, number][] {
  const flat = shard.postings[shard.terms.indexOf(term)] ?? [];
  const pairs: [number, number][] = [];
  let entry = 0;
  for (let at = 0; at < flat.length; at += 2) {
    entry += flat[at] ?? 0;
    pairs.push([entry, flat[at + 1] ?? 0]);
  }
  return pairs;
}

const HEADING_ONE: DocumentHeading = { id: "one", text: "One", depth: 2 };
const HEADING_TWO: DocumentHeading = { id: "two", text: "Two", depth: 3 };

describe("buildSearchShard", () => {
  // Bug: the binary search of the browser needs sorted terms, and postings drift off their terms.
  it("sorts the terms and keeps the postings parallel", () => {
    const shard = buildSearchShard(
      [guide("zebra", "", "/z/"), guide("apple", "", "/a/"), guide("Zebra mango", "", "/m/")],
      []
    );

    expect(shard.terms).toEqual(["apple", "mango", "zebra"]);
    expect(shard.postings).toEqual([
      [1, 8],
      [2, 8],
      [0, 8, 2, 8]
    ]);
  });

  // Bug: entry indices are stored whole, so a long list of large numbers costs the bytes the delta saves.
  it("stores each posting as the distance from the one before", () => {
    const shard = buildSearchShard(
      [
        guide("Word", "", "/a/"),
        guide("Other", "", "/b/"),
        guide("Word", "", "/c/"),
        guide("Word", "", "/d/")
      ],
      []
    );

    expect(shard.postings[shard.terms.indexOf("word")]).toEqual([0, 8, 2, 8, 1, 8]);
  });

  // Bug: a word in hundreds of page bodies keeps them all, and the shard passes its size budget.
  it("keeps the earliest 60 body-only postings of a term", () => {
    const rows = Array.from({ length: 62 }, (_, index) => guide("", "", `/${index}/`));
    const shard = buildSearchShard(
      rows,
      rows.map(row => page(row.href, "common"))
    );

    expect(postingsOf(shard, "common").map(([entry]) => entry)).toEqual(
      Array.from({ length: 60 }, (_, index) => index)
    );
  });

  // Bug: the cap counts every posting, so a late title match is dropped and its page is unreachable.
  it("keeps every posting above weight 1, also after 60 body-only ones", () => {
    const bodies = Array.from({ length: 61 }, (_, index) => guide("", "", `/${index}/`));
    const rows = [...bodies, guide("Common", "", "/title/"), guide("", "Common", "/subtitle/")];
    const shard = buildSearchShard(
      rows,
      bodies.map(row => page(row.href, "common"))
    );

    expect(postingsOf(shard, "common").slice(-2)).toEqual([
      [61, 8],
      [62, 3]
    ]);
    expect(postingsOf(shard, "common")).toHaveLength(62);
  });

  // Bug: title, subtitle and heading weigh the same, so the ranking has nothing to work with.
  it("weighs title 8, subtitle 3, heading 8 and body 1", () => {
    const shard = buildSearchShard(
      [guide("Title word", "Subtitle word", "/a/"), section("Heading", "/a/#heading")],
      [
        page("/a/", "Body before.\n\n## Heading\n\nSection text.", [
          { id: "heading", text: "Heading", depth: 2 }
        ])
      ]
    );

    expect(postingsOf(shard, "title")).toEqual([[0, 8]]);
    expect(postingsOf(shard, "subtitle")).toEqual([[0, 3]]);
    expect(postingsOf(shard, "heading")).toEqual([[1, 8]]);
    expect(postingsOf(shard, "before")).toEqual([[0, 1]]);
    expect(postingsOf(shard, "text")).toEqual([[1, 1]]);
  });

  // Bug: the later, lower weight overwrites the title weight of the same word.
  it("keeps the highest weight of a term per entry", () => {
    const shard = buildSearchShard(
      [guide("Effects", "Effects", "/a/")],
      [page("/a/", "Effects in the body.")]
    );

    expect(postingsOf(shard, "effects")).toEqual([[0, 8]]);
  });

  // Bug: a Section row indexes its subtitle, so every section of a page answers the page's title.
  it("does not index the page title on its Section rows", () => {
    const shard = buildSearchShard([section("Heading", "/a/#heading")], []);

    expect(shard.terms).toEqual(["heading"]);
  });

  // Bug: positions drift when a section is skipped, so text lands on the wrong anchor.
  it("gives each section its own text, matched by position", () => {
    const shard = buildSearchShard(
      [section("One", "/a/#one"), section("Two", "/a/#two")],
      [page("/a/", "## One\n\nfirstword\n\n### Two\n\nsecondword", [HEADING_ONE, HEADING_TWO])]
    );

    expect(postingsOf(shard, "firstword")).toEqual([[0, 1]]);
    expect(postingsOf(shard, "secondword")).toEqual([[1, 1]]);
  });

  // Bug: page text is keyed by the page's own row, so the Package row of a docs home gets nothing.
  it("resolves page text against the rows by href", () => {
    const shard = buildSearchShard(
      [{ kind: "Package", title: "@moku-labs/web", subtitle: "", href: "/docs/web/", icon: "web" }],
      [page("/docs/web/", "Homepage intro.")]
    );

    expect(postingsOf(shard, "homepage")).toEqual([[0, 1]]);
  });

  // Bug: a heading inside a fence starts a section, or fence bodies are dropped from the index.
  it("keeps a fenced heading and the fence body in the current section", () => {
    const shard = buildSearchShard(
      [section("One", "/a/#one")],
      [page("/a/", "## One\n\n```md\n## fenced\ncreateApp()\n```", [HEADING_ONE])]
    );

    expect(postingsOf(shard, "fenced")).toEqual([[0, 1]]);
    expect(postingsOf(shard, "createapp")).toEqual([[0, 1]]);
  });

  // Bug: an inner fence of another kind closes the block, so its code is read as prose headings.
  it("closes a fence only with the same mark at the same length or longer", () => {
    const markdown = "## One\n\n````md\n```ts\n## inner\n```\n````\n\n## Two\n\nend";
    const shard = buildSearchShard(
      [section("One", "/a/#one"), section("Two", "/a/#two")],
      [page("/a/", markdown, [HEADING_ONE, { ...HEADING_TWO, depth: 2 }])]
    );

    expect(postingsOf(shard, "inner")).toEqual([[0, 1]]);
    expect(postingsOf(shard, "end")).toEqual([[1, 1]]);
  });

  // Bug: tables fill with Markdown syntax: fence meta, directive attributes, link targets, comments.
  it("leaves Markdown syntax out of the terms", () => {
    const markdown = [
      "Before.",
      "<!-- hiddencomment",
      "still hidden -->",
      ':::callout{tone="warn"}',
      "Inside.",
      ":::",
      '::diagram[Figurelabel]{name="pipeline"}',
      "> [!note] Noted.",
      "See [linked](/docs/hiddenpath/) here.",
      '```ts file="hiddenmeta.ts" hl="1"',
      "code(); // [!note] Explained.",
      "```"
    ].join("\n");
    const shard = buildSearchShard([guide("", "", "/a/")], [page("/a/", markdown)]);

    expect(shard.terms).toEqual(
      ["before", "code", "explained", "here", "inside", "linked", "noted", "see"].toSorted()
    );
  });

  // Bug: a page whose fence logic drifts from extractHeadings puts text on the wrong anchors.
  it("throws when the section count differs from the headings", () => {
    expect(() =>
      buildSearchShard([guide("A", "", "/a/")], [page("/a/", "No heading.", [HEADING_ONE])])
    ).toThrow(
      "[site] Section count differs from headings for content/docs/web/page.md.\n  Check fenced headings."
    );
  });
});
