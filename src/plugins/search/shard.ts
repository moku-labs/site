/**
 * @file The lookup tables of the ⌘K index: splits docs pages into the text of their sections,
 * tokenizes every row and page text, and builds the `SearchShard` the browser queries.
 */
import { searchAliases } from "../../data/search-aliases";
import { tokenize } from "../../lib/search-tokens";
import { FENCE, HEADING } from "../docs/markdown";
import type { DocumentHeading, DocumentPage } from "../docs/types";
import type { SearchEntry, SearchField, SearchShard } from "./types";

/** The weight of a token per place it was found. */
const WEIGHT: Readonly<Record<SearchField | "subtitle", number>> = {
  title: 8,
  subtitle: 3,
  heading: 8,
  body: 1
};

/**
 * The body-only postings a term keeps, the earliest in `entries` order. The palette shows 8 results,
 * so a word in 400 page bodies gains nothing from the rest, and the shard has a size budget.
 */
const MAX_BODY_POSTINGS = 60;

/** Term to its weight per entry index. */
type TermTable = Map<string, Map<number, number>>;

/** The text of a page, split where its headings start. */
type PageText = {
  /** Text before the first heading. */
  intro: string;
  /** Text of each heading, in document order. */
  sections: string[];
};

/**
 * Markdown that is no words of the page: comments, directive lines and link targets. The tokenizer
 * splits on the rest of the syntax (`#`, backticks, `*`, `_`, brackets).
 *
 * @param prose - Lines outside fences, joined.
 * @returns The text with that syntax gone.
 */
function stripProse(prose: string): string {
  return prose
    .replaceAll(/<!--[\s\S]*?-->/g, " ")
    .replaceAll(/^[ \t]*:{2,}.*$/gm, " ")
    .replaceAll(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
}

/**
 * One text buffer: prose and code apart, because a comment or a directive inside a fence is code.
 *
 * @param prose - Lines outside fences.
 * @param code - Lines inside fences.
 * @returns The text to tokenize; a `[!note]` code annotation keeps its words, not its marker.
 */
function joinText(prose: readonly string[], code: readonly string[]): string {
  return `${stripProse(prose.join("\n"))}\n${code.join("\n")}`.replaceAll(/\[![a-z]+\]/gi, " ");
}

/**
 * The open fence after a fence line: the line opens one when none is open, and closes the open one
 * with the same mark, at least as long. Any other fence line changes nothing.
 *
 * @param fence - The marks that opened the current fence, if any.
 * @param marks - The marks of the fence line.
 * @returns The marks of the fence now open, if any.
 */
function nextFence(fence: string | undefined, marks: string): string | undefined {
  if (fence === undefined) return marks;
  return marks[0] === fence[0] && marks.length >= fence.length ? undefined : fence;
}

/**
 * Split a Markdown body at its out-of-fence headings. Fence lines (with their meta) are dropped;
 * fence bodies join the current section.
 *
 * @param markdown - Page body.
 * @returns The intro and one text per heading.
 */
function splitPage(markdown: string): PageText {
  const texts: string[] = [];
  let prose: string[] = [];
  let code: string[] = [];
  let fence: string | undefined;
  for (const line of markdown.split("\n")) {
    // A fence line opens or closes a block, and is dropped with its meta.
    const marks = FENCE.exec(line)?.[1];
    if (marks !== undefined) {
      fence = nextFence(fence, marks);
      continue;
    }

    // Inside a fence every line is code, also one that looks like a heading.
    if (fence !== undefined) {
      code.push(line);
      continue;
    }

    // A heading ends the current text and starts the next one.
    if (HEADING.test(line)) {
      texts.push(joinText(prose, code));
      prose = [];
      code = [];
      continue;
    }

    prose.push(line);
  }

  // The last text has no heading after it to end it.
  texts.push(joinText(prose, code));
  const [intro = "", ...sections] = texts;
  return { intro, sections };
}

/**
 * The anchor link of a heading.
 *
 * @param page - Its docs page.
 * @param heading - The heading.
 * @returns The page path with the heading's fragment.
 * @example
 * ```ts
 * sectionHref(page, { id: "params", text: "Params", depth: 3 }); // "/docs/web/guides/routing/#params"
 * ```
 */
export function sectionHref(page: DocumentPage, heading: DocumentHeading): string {
  return `${page.path}#${heading.id}`;
}

/**
 * The body text of every docs page and section, by the `href` of the row it belongs to.
 *
 * @param pages - The docs pages.
 * @returns Text per `href`.
 * @throws {Error} When a page's sections and its headings differ in number.
 */
function bodyTexts(pages: readonly DocumentPage[]): Map<string, string> {
  const bodies = new Map<string, string>();
  for (const page of pages) {
    // Split the page, and refuse a split that does not line up with its headings: text would land
    // on the wrong anchors.
    const { intro, sections } = splitPage(page.markdown);
    if (sections.length !== page.headings.length) {
      throw new Error(
        `[site] Section count differs from headings for ${page.file}.\n  Check fenced headings.`
      );
    }

    // The intro belongs to the page's row, each section to its heading's row.
    bodies.set(page.path, intro);
    for (const [position, heading] of page.headings.entries()) {
      bodies.set(sectionHref(page, heading), sections[position] ?? "");
    }
  }
  return bodies;
}

/**
 * Record the tokens of a text for an entry, keeping the highest weight per term.
 *
 * @param table - The table being built.
 * @param text - The text.
 * @param entryIndex - The row it belongs to.
 * @param weight - The weight of the place it was found.
 */
function addText(table: TermTable, text: string, entryIndex: number, weight: number): void {
  for (const token of tokenize(text)) {
    const weights = table.get(token) ?? new Map<number, number>();
    weights.set(entryIndex, Math.max(weight, weights.get(entryIndex) ?? 0));
    table.set(token, weights);
  }
}

/**
 * The posting list of a term: every posting above body weight and the earliest body-only ones, flat
 * `[entryDelta, weight, ...]` with entry indices ascending. The first delta counts from 0.
 *
 * @param weights - The term's weight per entry index.
 * @returns The encoded postings.
 */
function encodePostings(weights: ReadonlyMap<number, number>): number[] {
  const flat: number[] = [];
  let previous = 0;
  let bodyPostings = 0;
  for (const [entry, weight] of [...weights].toSorted(([first], [second]) => first - second)) {
    if (weight === WEIGHT.body) bodyPostings += 1;
    const isKept = weight > WEIGHT.body || bodyPostings <= MAX_BODY_POSTINGS;
    if (isKept) {
      flat.push(entry - previous, weight);
      previous = entry;
    }
  }
  return flat;
}

/**
 * Build the shard: rows, sorted terms, parallel postings and the alias table. A row carries the
 * text of its own `href`, so a package's docs home lands on its `Package` row.
 *
 * @param entries - The deduplicated index rows.
 * @param pages - The docs pages, for the text of their rows.
 * @returns The shard, plain JSON.
 * @throws {Error} When a page's sections and its headings differ in number.
 * @example
 * ```ts
 * buildSearchShard([{ kind: "Page", title: "Effects", subtitle: "", href: "/a/", icon: "page" }], []).terms; // ["effects"]
 * ```
 */
export function buildSearchShard(
  entries: readonly SearchEntry[],
  pages: readonly DocumentPage[]
): SearchShard {
  // Gather the text of every docs page and section.
  const bodies = bodyTexts(pages);

  // Weight each row's own words, then its text.
  const table: TermTable = new Map();
  for (const [index, entry] of entries.entries()) {
    if (entry.kind === "Section") {
      addText(table, entry.title, index, WEIGHT.heading);
    } else {
      addText(table, entry.title, index, WEIGHT.title);
      addText(table, entry.subtitle, index, WEIGHT.subtitle);
    }
    addText(table, bodies.get(entry.href) ?? "", index, WEIGHT.body);
  }

  // Assemble the plain JSON the browser reads.
  const terms = [...table.keys()].toSorted();
  return {
    entries: [...entries],
    terms,
    postings: terms.map(term => encodePostings(table.get(term) ?? new Map<number, number>())),
    aliases: Object.fromEntries(
      Object.entries(searchAliases).map(([alias, targets]) => [alias, [...targets]])
    )
  };
}
