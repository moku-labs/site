import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkSnippets } from "../../src/lib/snippets";

const repository = path.resolve(import.meta.dirname, "..", "..");
const documentsDirectory = path.join(repository, "content", "docs");

/**
 * Every Markdown file under `content/docs`, read from disk, so no page can skip the gate.
 *
 * @returns The pages as snippet sources, named by their path from the repository root.
 */
async function readDocuments(): Promise<{ file: string; markdown: string }[]> {
  const entries = await readdir(documentsDirectory, { recursive: true });
  const files = entries.filter(entry => entry.endsWith(".md")).toSorted();
  return Promise.all(
    files.map(async entry => ({
      file: path.posix.join("content/docs", entry.split(path.sep).join("/")),
      markdown: await readFile(path.join(documentsDirectory, entry), "utf8")
    }))
  );
}

describe("docs code blocks", () => {
  // Bug: a package update renames or removes an API a docs example uses, or an author adds a
  // `check` block that never compiled. The failure names the file and the block.
  it("every `check` block in content/docs compiles against the installed packages", async () => {
    const failures = await checkSnippets(await readDocuments(), repository);

    expect(failures).toEqual([]);
  }, 120_000);
});
