import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkSnippets, type SnippetFailure } from "../../../src/lib/snippets";

const fixtures = path.join(import.meta.dirname, "fixtures", "snippets");
const repository = path.resolve(import.meta.dirname, "..", "..", "..");
const pages = ["good.md", "bad.md", "diff.md", "other.md"];

let project = "";
let failures: SnippetFailure[] = [];

/**
 * Read the fixture pages as docs sources named `content/docs/<page>`.
 *
 * @param names - Fixture file names.
 * @returns The sources.
 */
function readPages(names: string[]): Promise<{ file: string; markdown: string }[]> {
  return Promise.all(
    names.map(async name => ({
      file: `content/docs/${name}`,
      markdown: await readFile(path.join(fixtures, name), "utf8")
    }))
  );
}

// One tsc run for every page: a project of its own, so its .cache is not shared with other tests,
// with the real node_modules linked in so @moku-labs/web 2.4.11 resolves.
beforeAll(async () => {
  project = await mkdtemp(path.join(tmpdir(), "site-snippets-"));
  await symlink(path.join(repository, "node_modules"), path.join(project, "node_modules"), "dir");
  failures = await checkSnippets(await readPages(pages), project);
}, 60_000);

afterAll(async () => {
  await rm(project, { recursive: true, force: true });
});

describe("checkSnippets", () => {
  // Bug: the checker passes everything, or attributes a failure to the wrong page or block.
  it("reports exactly the failing check blocks, each with its file and index", () => {
    expect(failures.map(({ file, index }) => ({ file, index }))).toEqual([
      { file: "content/docs/bad.md", index: 1 },
      { file: "content/docs/bad.md", index: 2 },
      { file: "content/docs/diff.md", index: 1 },
      { file: "content/docs/other.md", index: 0 },
      { file: "content/docs/other.md", index: 1 }
    ]);
  });

  // Bug: the message is the raw tsc line with the temp file name, or loses the error itself.
  it("gives the compiler error at the line and column inside the block", () => {
    expect(failures[0]?.message).toMatch(
      /^1:10 error TS2305: Module '"@moku-labs\/web"' has no exported member 'renderRoute'\.$/
    );
  });

  // Bug: the indented lines of a multi-line diagnostic are lost, or taken for setup errors.
  it("keeps the explanation lines of a diagnostic in the block's message", () => {
    expect(failures[1]?.message.split("\n")).toEqual([
      expect.stringMatching(/^1:21 error TS2352: /),
      "  Types of property 'value' are incompatible.",
      "    Type 'number' is not comparable to type 'string'."
    ]);
  });

  // Bug: blocks without `check` are compiled too (good.md has a broken sketch), or a valid
  // example against the installed @moku-labs/web fails.
  it("compiles only flagged blocks, and a correct example passes", () => {
    expect(failures.some(failure => failure.file === "content/docs/good.md")).toBe(false);
  });

  // Bug: a diff block is compiled as written (signs and removed lines) instead of its result;
  // line 3 proves the removed line is gone.
  it("checks a diff block as its resulting code", () => {
    const diff = failures.filter(failure => failure.file === "content/docs/diff.md");

    expect(diff).toHaveLength(1);
    expect(diff[0]?.message).toMatch(/^3:27 error TS2345: /);
  });

  // Bug: `check` on a language tsc cannot compile, or on a diff without lang=ts, is skipped silently.
  it("fails a check block in a language other than ts or tsx", () => {
    expect(failures.slice(-2).map(failure => failure.message)).toEqual([
      'check works on ts and tsx blocks, not on "js".',
      'check works on ts and tsx blocks, not on "diff".'
    ]);
  });

  // Bug: temp projects pile up under .cache/snippets.
  it("removes the temp project after the run", async () => {
    expect(await readdir(path.join(project, ".cache", "snippets"))).toEqual([]);
  });

  // Bug: a page with no check blocks starts tsc on an empty file list, which fails the build.
  it("returns no failures without running tsc when no block has check", async () => {
    const sources = [
      { file: "content/docs/plain.md", markdown: "```ts\nconst a: number = 'x';\n```" }
    ];

    expect(await checkSnippets(sources, path.join(project, "no-such-project"))).toEqual([]);
  });

  // Bug: a broken setup (here no @types/bun) is blamed on no block and reported as "all compile".
  it("throws when tsc fails outside the blocks", async () => {
    // Not under `project`: its linked node_modules/@types would be found by walking up.
    const broken = await mkdtemp(path.join(tmpdir(), "site-snippets-broken-"));
    const compiler = await realpath(path.join(repository, "node_modules", ".bin", "tsc"));
    await mkdir(path.join(broken, "node_modules", ".bin"), { recursive: true });
    await symlink(compiler, path.join(broken, "node_modules", ".bin", "tsc"));
    const sources = [
      { file: "content/docs/a.md", markdown: "```ts check\nexport const a = 1;\n```" }
    ];

    try {
      await expect(checkSnippets(sources, broken)).rejects.toThrow(
        /^\[site\] tsc failed outside the docs code blocks:\n.*TS2688/
      );
    } finally {
      await rm(broken, { recursive: true, force: true });
    }
  });
});
