/**
 * @file The screen inventory, derived from the frozen corpus (`content/docs/**` frontmatter, read
 * with a tiny independent parser) plus the fixed site pages. Specs loop over it, so a new docs page
 * is covered (boot guard, baseline, a11y, SEO, build output, mobile) without touching a spec.
 */
import { readdirSync, readFileSync } from "node:fs";
import nodePath from "node:path";

const DOCS_DIR = nodePath.join(import.meta.dirname, "../../content/docs");

/** One screen of the site. */
export type Screen = {
  /** Stable name, used for goldens. */
  name: string;
  /** URL path. */
  path: string;
  /** Visible page title (the h1). */
  title: string;
  /** The page ships no client bundle (the 404 page). */
  static?: boolean;
  /** A docs page (sidebar, TOC, meta row, prev/next). */
  doc?: boolean;
  /** URL of the page's Markdown twin. */
  markdown?: string;
};

/** The path the preview answers with the 404 page. */
export const NOT_FOUND_PATH = "/no-such-page/";

/**
 * Minimal frontmatter reader: `key: value` lines between the first two `---` fences.
 *
 * @param source - Markdown file text.
 * @returns The frontmatter fields.
 */
function frontmatter(source: string): Record<string, string> {
  const block = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? "";
  const fields: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = /^(\w+):\s*(.*)$/.exec(line);
    if (match?.[1] && match[2] !== undefined) fields[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return fields;
}

/**
 * Every Markdown file under a directory.
 *
 * @param dir - Directory to walk.
 * @returns Absolute file paths.
 */
function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = nodePath.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

/** Every docs page, from the corpus. */
export const DOC_SCREENS: Screen[] = markdownFiles(DOCS_DIR)
  .map(file => {
    const parts = nodePath.relative(DOCS_DIR, file).replace(/\.md$/, "").split("/");
    if (parts.at(-1) === "index") parts.pop();
    const path = `/docs/${parts.join("/")}/`;
    return {
      name: `docs-${parts.join("-")}`,
      path,
      title: frontmatter(readFileSync(file, "utf8")).title ?? "",
      doc: true,
      markdown: `${path.slice(0, -1)}.md`
    };
  })
  .toSorted((a, b) => a.path.localeCompare(b.path));

/** Package ids that have a docs home (`content/docs/<pkg>/index.md`). */
export const PACKAGE_IDS: string[] = DOC_SCREENS.filter(s => s.path.split("/").length === 4).map(
  s => s.path.split("/")[2] ?? ""
);

/** The site pages outside the docs tree. */
export const SITE_SCREENS: Screen[] = [
  {
    name: "home",
    path: "/",
    title: "Slop doesn't spread.",
    markdown: "/index.md"
  },
  { name: "docs-hub", path: "/docs/", title: "Docs", markdown: "/docs.md" },
  { name: "demos", path: "/demos/", title: "Demos", markdown: "/demos.md" },
  { name: "about", path: "/about/", title: "Alex Kucherenko", markdown: "/about.md" },
  { name: "not-found", path: NOT_FOUND_PATH, title: "404", static: true }
];

/** Every screen. */
export const SCREENS: Screen[] = [...SITE_SCREENS, ...DOC_SCREENS];

/** A docs page that has every docs feature (code group, notes, TOC, prev/next). */
export const RICH_DOC = "/docs/web/guides/routing/";
