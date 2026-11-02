import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkSnippets, type SnippetFailure, ungatedSnippets } from "../../../src/lib/snippets";

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

/**
 * One docs page as a snippet source.
 *
 * @param markdown - Raw Markdown of the page.
 * @returns The page, named `content/docs/a.md`.
 */
function page(markdown: string): { file: string; markdown: string }[] {
  return [{ file: "content/docs/a.md", markdown }];
}

describe("ungatedSnippets", () => {
  // Bug: a ts block with no marker passes, so a new example skips the compile gate.
  it("fails a ts block with neither check nor no-check", () => {
    expect(ungatedSnippets(page("```ts\nconst a = 1;\n```"))).toEqual([
      {
        file: "content/docs/a.md",
        index: 0,
        message: 'add check, or no-check="<reason>" when the block cannot compile on its own.'
      }
    ]);
  });

  // Bug: a bare or empty no-check opts out without saying why.
  it("fails a no-check without a reason", () => {
    const markdown = '```tsx no-check\nx\n```\n\n```ts no-check=" "\nx\n```';

    expect(ungatedSnippets(page(markdown)).map(failure => failure.index)).toEqual([0, 1]);
  });

  // Bug: a block marked both ways is read as checked or as skipped, depending on the reader.
  it("fails a block marked check and no-check", () => {
    expect(ungatedSnippets(page('```ts check no-check="x"\nx\n```'))[0]?.message).toBe(
      "a block is either check or no-check, not both."
    );
  });

  // Bug: a ts diff escapes the gate, or a non-ts block is wrongly demanded a marker.
  it("gates ts diffs and ignores other languages", () => {
    const markdown = "```diff lang=ts\n+x\n```\n\n```bash\nls\n```\n\n```diff\n+x\n```";

    expect(ungatedSnippets(page(markdown)).map(failure => failure.index)).toEqual([0]);
  });

  // Bug: a correctly marked block is reported.
  it("passes check and no-check with a reason", () => {
    const markdown = '```ts check\nx\n```\n\n```tsx file="a.tsx" no-check="imports ./a"\nx\n```';

    expect(ungatedSnippets(page(markdown))).toEqual([]);
  });
});

describe("checkSnippets projects", () => {
  let stubbed = "";

  // A project of its own with one stub: `src/site.ts` of the docs package `pkg`.
  beforeAll(async () => {
    stubbed = await mkdtemp(path.join(tmpdir(), "site-snippets-stubs-"));
    await symlink(path.join(repository, "node_modules"), path.join(stubbed, "node_modules"), "dir");
    await mkdir(path.join(stubbed, "content", "snippet-stubs", "pkg", "src"), { recursive: true });
    await writeFile(
      path.join(stubbed, "content", "snippet-stubs", "pkg", "src", "site.ts"),
      'export const site = { name: "Stub" };\n'
    );
  });

  afterAll(async () => {
    await rm(stubbed, { recursive: true, force: true });
  });

  /**
   * Check one page of the package `pkg` in the stubbed project.
   *
   * @param markdown - Raw Markdown of the page.
   * @returns The failures.
   */
  function checkPage(markdown: string): Promise<SnippetFailure[]> {
    return checkSnippets([{ file: "content/docs/pkg/page.md", markdown }], stubbed);
  }

  // Bug: blocks of one group are compiled apart, so `./routes` in app.ts is never found.
  it("resolves a relative import to a block of the same group", async () => {
    const markdown = [
      '```ts file="src/routes.ts" group="g" check',
      "export const routes = 1;",
      "```",
      '```ts file="src/app.ts" group="g" check',
      'import { routes } from "./routes";',
      "export const total: number = routes;",
      "```"
    ].join("\n");

    expect(await checkPage(markdown)).toEqual([]);
  }, 30_000);

  // Bug: a block of another group leaks in and satisfies the import, hiding a broken example.
  it("keeps groups apart", async () => {
    const markdown = [
      '```ts file="src/routes.ts" group="a" check',
      "export const routes = 1;",
      "```",
      '```ts file="src/app.ts" group="b" check',
      'import { routes } from "./routes";',
      "export const total: number = routes;",
      "```"
    ].join("\n");

    const [failure] = await checkPage(markdown);

    expect(failure?.message).toMatch(/TS2307: Cannot find module '\.\/routes'/);
  }, 30_000);

  // Bug: the page's own file blocks are not shared, so `../src/native` on the native page fails.
  it("lets ungrouped blocks with a file import each other", async () => {
    const markdown = [
      '```ts file="src/native.ts" check',
      "export const native = { start: () => 1 };",
      "```",
      '```ts file="scripts/build.ts" check',
      'import { native } from "../src/native";',
      "native.start();",
      "```"
    ].join("\n");

    expect(await checkPage(markdown)).toEqual([]);
  }, 30_000);

  // Bug: the package stubs are not copied, or a block cannot use them.
  it("resolves an import the group lacks to the package stub, typed", async () => {
    const markdown = [
      '```ts file="src/client.ts" check',
      'import { site } from "./site";',
      "export const name: number = site.name;",
      "```"
    ].join("\n");

    const [failure] = await checkPage(markdown);

    expect(failure?.message).toMatch(/TS2322: Type 'string' is not assignable to type 'number'/);
  }, 30_000);

  // Bug: an error inside a stub is dropped, so a stale stub passes every example that imports it.
  it("throws when a stub fails to compile", async () => {
    // A project of its own, so the broken stub never reaches the other tests.
    const broken = await mkdtemp(path.join(tmpdir(), "site-snippets-bad-stub-"));
    await symlink(path.join(repository, "node_modules"), path.join(broken, "node_modules"), "dir");
    await mkdir(path.join(broken, "content", "snippet-stubs", "pkg", "src"), { recursive: true });
    await writeFile(
      path.join(broken, "content", "snippet-stubs", "pkg", "src", "site.ts"),
      "export const site: number = 'x';\n"
    );
    const markdown = '```ts file="src/client.ts" check\nimport { site } from "./site";\nsite;\n```';

    try {
      await expect(
        checkSnippets([{ file: "content/docs/pkg/page.md", markdown }], broken)
      ).rejects.toThrow(/tsc failed outside the docs code blocks/);
    } finally {
      await rm(broken, { recursive: true, force: true });
    }
  }, 30_000);

  // Bug: a `file` with `..` writes the block outside the run directory, or a second block with
  // the same `file` overwrites the first, so the first is never compiled.
  it("keeps every block inside its project, one file each", async () => {
    const markdown = [
      '```ts file="../escape.ts" check',
      "export const escaped: number = 'x';",
      "```",
      '```ts file="src/a.ts" check',
      "export const first: number = 'x';",
      "```",
      '```ts file="src/a.ts" check',
      "export const second = 1;",
      "```"
    ].join("\n");
    const failures = await checkPage(markdown);

    expect(failures.map(failure => failure.index)).toEqual([0, 1]);
    expect(await readdir(path.join(stubbed, ".cache"))).toEqual(["snippets"]);
  }, 30_000);
});
