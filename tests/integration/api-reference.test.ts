import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const documentsDirectory = path.resolve(import.meta.dirname, "..", "..", "content", "docs");

/** An API reference page and the package entries its "Entries" table lists. */
type ReferencePage = {
  /** Path from `content/docs`, e.g. `web/api.md`. */
  file: string;
  /** Raw Markdown of the page. */
  markdown: string;
  /** Import paths from the table, e.g. `@moku-labs/web/browser`. */
  entries: string[];
};

const ENTRY_ROW = /^\| `(@moku-labs\/[\w/-]+)` \|/gm;
const SIGNATURE_BLOCK = /^```ts [^\n]*no-check="[^"]+"[^\n]*\n([\s\S]*?)^```$/gm;
const DECLARATION = /^(?:function|const|class) (\w+)/gm;

/**
 * Every `api.md` under `content/docs`, with the entries its table lists.
 *
 * @returns The reference pages.
 */
async function readReferencePages(): Promise<ReferencePage[]> {
  const entries = await readdir(documentsDirectory, { recursive: true });
  const files = entries.filter(entry => path.basename(entry) === "api.md").toSorted();
  return Promise.all(
    files.map(async file => {
      const markdown = await readFile(path.join(documentsDirectory, file), "utf8");
      return {
        file,
        markdown,
        entries: [...markdown.matchAll(ENTRY_ROW)].map(row => row[1] ?? "")
      };
    })
  );
}

/**
 * Whether the page names an export: in backticks, called, or declared in a signature block.
 *
 * @param markdown - Raw Markdown of the page.
 * @param name - The export name.
 * @returns `true` when the page documents it.
 */
function documents(markdown: string, name: string): boolean {
  const escaped = name.replaceAll("$", String.raw`\$`);
  return new RegExp(`\`${escaped}[\`(]|^(?:function|const|class) ${escaped}\\b`, "m").test(
    markdown
  );
}

/**
 * The names the page's signature blocks declare with `function`, `const` or `class`.
 *
 * @param markdown - Raw Markdown of the page.
 * @returns The declared names.
 */
function declaredNames(markdown: string): string[] {
  return [...markdown.matchAll(SIGNATURE_BLOCK)].flatMap(block =>
    [...(block[1] ?? "").matchAll(DECLARATION)].map(match => match[1] ?? "")
  );
}

describe("API reference pages", async () => {
  const pages = await readReferencePages();

  // Bug: the reference loses its entry table, so the checks below pass on an empty list.
  it("each list the package entries they document", () => {
    expect(pages.map(page => page.file)).toContain("web/api.md");
    for (const page of pages) expect(page.entries, page.file).not.toEqual([]);
  });

  // Bug: a package release adds an export and the reference never mentions it.
  it("name every runtime export of every entry", async () => {
    const missing: string[] = [];
    for (const page of pages) {
      for (const entry of page.entries) {
        const exported = Object.keys(await import(entry));
        for (const name of exported) {
          if (!documents(page.markdown, name))
            missing.push(`${page.file}: ${entry} exports ${name}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  // Bug: a package release removes or renames an export and the reference still shows its signature.
  it("declare only names the package exports", async () => {
    const stale: string[] = [];
    for (const page of pages) {
      const modules = await Promise.all(page.entries.map(entry => import(entry)));
      const exported = new Set(modules.flatMap(module => Object.keys(module)));
      for (const name of declaredNames(page.markdown)) {
        if (!exported.has(name)) stale.push(`${page.file}: ${name} is not exported`);
      }
    }

    expect(stale).toEqual([]);
  });
});
