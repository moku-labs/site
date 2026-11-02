/**
 * @file Compiles the docs code blocks tagged `check` against the installed packages.
 *
 * Build-time only. This is the anti-drift gate: a docs example that stops compiling
 * after a package update fails the test run.
 *
 * Rules:
 *
 * - A block is checked when its fence meta has the bare flag `check` (meta syntax: `parseFenceMeta`
 *   in `markdown/code-blocks.ts`).
 * - Languages `ts`, `typescript` and `tsx`. A `diff` block (language `diff` with `lang=ts|tsx`, or
 *   the flag `diff`) is checked as its result: `-` lines dropped, `+` and space signs stripped.
 *   `// [!note]` comments are removed first, as on the page. A `check` on any other language is a
 *   failure, so a typo never skips a block silently.
 * - Every ts or tsx block, diffs included, carries `check` or `no-check="<reason>"`. A block with
 *   neither, with both, or with an empty reason is a failure (`ungatedSnippets`), so no example
 *   escapes the gate by being left unmarked.
 * - Every block is checked as a full module (`moduleDetection: "force"`). There is no "fragment"
 *   mode: an author who adds `check` writes a complete example, imports included. A block that uses
 *   a name it does not define or import fails.
 * - Blocks share small projects. The `check` blocks of one page with the same `group` share one
 *   project; the page's other blocks with a `file` share the page's project; a block with neither
 *   is alone. A block with `file="src/app.ts"` sits at that path, so its relative imports
 *   (`./routes`, `../src/app`) find the other blocks of its project.
 * - A relative import the group does not hold resolves to a stub: every project starts as a copy
 *   of `<projectDirectory>/content/snippet-stubs/<package>/`, where `<package>` is the page's folder
 *   under `content/docs`. Blocks overwrite the stubs at the same path. A stub is real code against
 *   the installed packages; a stub that stops compiling fails the run as a setup error.
 * - The projects are written to `<projectDirectory>/.cache/snippets/run-*` with a generated strict
 *   `tsconfig.json`. The directory sits inside the project, so `@moku-labs/*` imports and
 *   `@types/bun` resolve from the project's `node_modules`. One `tsc -p` run checks all blocks; the
 *   directory is removed afterwards.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseFenceMeta, splitCodeLines } from "./markdown/code-blocks";
import type { FenceMeta } from "./markdown/types";

/** A docs page as the checker needs it. */
export type SnippetSource = {
  /** Source file, e.g. `content/docs/web/guides/routing.md`. */
  file: string;
  /** Raw Markdown of the page. */
  markdown: string;
};

/** One code block that failed to compile. */
export type SnippetFailure = {
  /** Source file of the block. */
  file: string;
  /**
   * Zero-based index of the block on its page: among the `check` blocks for `checkSnippets`,
   * among the ts and tsx blocks for `ungatedSnippets`.
   */
  index: number;
  /** Compiler output for the block. */
  message: string;
};

/** A fenced code block as written in the Markdown. */
type FencedBlock = {
  /** The first word of the info string. */
  language: string;
  /** The rest of the info string. */
  meta: string;
  /** The code lines, fence indent removed. */
  lines: string[];
};

/** A fence that is open while the scanner reads its lines. */
type OpenFence = FencedBlock & {
  /** The fence characters, e.g. three backticks. */
  fence: string;
  /** Spaces before the opening fence. */
  indent: number;
};

/** A `check` block of a page, in page order. */
type CheckedBlock = {
  /** Source file of the block. */
  file: string;
  /** Index among the page's `check` blocks. */
  index: number;
  /** Temp file path, e.g. `p3/src/app.ts`; empty when the block is not compiled. */
  name: string;
  /** Docs package of the page, e.g. `web`, whose stubs its project starts from. */
  packageId: string;
  /** The code tsc compiles. */
  code: string;
  /** Why the block fails without compiling, e.g. an unsupported language. */
  problem?: string;
};

/** The result of the one `tsc` run. */
type CompilerRun = {
  /** Process exit code. */
  code: number;
  /** stdout and stderr together. */
  output: string;
};

const FENCE_OPEN = /^( *)(`{3,}|~{3,})\s*(\S*)\s*(.*)$/;
const DIAGNOSTIC = /^(p\d+\/[^(]+\.tsx?)\((\d+),(\d+)\): (.*)$/;
const PACKAGE_SEGMENT = 2; // content / docs / <package> / ...
const FILE_PATH = /^[\w-]+(?:\/[\w.-]+)*\.tsx?$/;
const EXTENSIONS: ReadonlyMap<string, string> = new Map([
  ["ts", "ts"],
  ["typescript", "ts"],
  ["tsx", "tsx"]
]);
const COMPILER_OPTIONS = {
  strict: true,
  target: "ESNext",
  lib: ["ESNext", "DOM", "DOM.Iterable"],
  module: "ESNext",
  moduleResolution: "Bundler",
  moduleDetection: "force",
  jsx: "react-jsx",
  jsxImportSource: "preact",
  noEmit: true,
  skipLibCheck: true,
  types: ["bun"]
};

/**
 * Whether a line closes the open fence: the same character, at least as many, nothing else.
 *
 * @param line - A Markdown line.
 * @param fence - The opening fence characters.
 * @returns `true` for a closing fence.
 */
function closesFence(line: string, fence: string): boolean {
  const trimmed = line.trim();
  return trimmed.length >= fence.length && trimmed === fence.charAt(0).repeat(trimmed.length);
}

/**
 * Find the fenced code blocks of a Markdown page.
 *
 * @param markdown - Raw Markdown.
 * @returns The blocks in page order; an unclosed fence runs to the end of the page.
 */
function fencedBlocks(markdown: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  let open: OpenFence | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    // Outside a block: look for an opening fence.
    if (open === undefined) {
      const match = FENCE_OPEN.exec(line);
      if (match !== null) {
        const [, indent = "", fence = "", language = "", meta = ""] = match;
        open = { fence, indent: indent.length, language, meta, lines: [] };
      }
      continue;
    }

    // Inside a block: a closing fence ends it.
    if (closesFence(line, open.fence)) {
      blocks.push(open);
      open = undefined;
      continue;
    }

    // Any other line is code, with the fence's indent removed.
    const indent = Math.min(open.indent, line.length - line.trimStart().length);
    open.lines.push(line.slice(indent));
  }
  if (open !== undefined) blocks.push(open);
  return blocks;
}

/**
 * The code tsc compiles for a block: notes out, and for a diff the resulting code.
 *
 * @param lines - The block's lines.
 * @param diff - Whether lines carry `+` / `-` / space signs.
 * @returns The code with a final newline.
 */
function resultCode(lines: string[], diff: boolean): string {
  const kept = splitCodeLines(lines.join("\n"), diff).lines.filter(line => line.change !== "del");
  return `${kept.map(line => line.text).join("\n")}\n`;
}

/**
 * What tsc compiles for a `check` block, and the temp file extension of its language.
 *
 * @param block - A fenced block.
 * @param meta - Its parsed fence meta.
 * @returns The code, the language and the extension, `undefined` for a language tsc cannot check.
 */
function prepareBlock(
  block: FencedBlock,
  meta: FenceMeta
): { code: string; language: string; extension: string | undefined } {
  const isDiff = block.language === "diff";
  const language = isDiff ? (meta.attributes.lang ?? "diff") : block.language;
  const code = resultCode(block.lines, isDiff || meta.flags.has("diff"));
  return { code, language, extension: EXTENSIONS.get(language) };
}

/** A fenced block tagged `check`, with its parsed fence meta. */
type CheckFence = {
  /** The block as written. */
  block: FencedBlock;
  /** Its parsed fence meta. */
  meta: FenceMeta;
};

/**
 * The fenced blocks of a page tagged `check`, in page order.
 *
 * @param markdown - Raw Markdown of the page.
 * @returns The blocks with their parsed meta.
 */
function checkFences(markdown: string): CheckFence[] {
  return fencedBlocks(markdown)
    .map(block => ({ block, meta: parseFenceMeta(block.meta) }))
    .filter(({ meta }) => meta.flags.has("check"));
}

/**
 * The docs package of a page: its folder under `content/docs`.
 *
 * @param file - Source file, e.g. `content/docs/web/guides/routing.md`.
 * @returns The package id, e.g. `web`; empty for a page outside a package folder.
 */
function packageOf(file: string): string {
  const segments = file.split("/");
  return segments.length > PACKAGE_SEGMENT + 1 ? (segments[PACKAGE_SEGMENT] ?? "") : "";
}

/**
 * Where a block sits inside its project: its `file` path when that is a plain relative ts or tsx
 * path not taken yet, a numbered name otherwise.
 *
 * @param fence - The block and its meta.
 * @param index - Index of the block among the page's `check` blocks.
 * @param extension - The temp file extension of its language.
 * @param taken - Paths already used in the project.
 * @returns The path inside the project.
 */
function blockPath(
  fence: CheckFence,
  index: number,
  extension: string,
  taken: ReadonlySet<string>
): string {
  const file = fence.meta.attributes.file ?? "";
  const isUsable = FILE_PATH.test(file) && !file.split("/").includes("..") && !taken.has(file);
  return isUsable ? file : `snippet-${index}.${extension}`;
}

/**
 * Which project a block joins: its page and group, else its page when it names a file, else its
 * own.
 *
 * @param file - Source file of the page.
 * @param index - Index of the block among the page's `check` blocks.
 * @param meta - The block's parsed fence meta.
 * @returns The project key.
 */
function projectKey(file: string, index: number, meta: FenceMeta): string {
  const { group, file: blockFile } = meta.attributes;
  if (group !== undefined) return `${file}#group:${group}`;
  return blockFile === undefined ? `${file}#${index}` : `${file}#page`;
}

/** The projects of one run: a number per page and group, and the paths each one holds. */
type ProjectRegistry = {
  /** Project number by the key `projectKey` gives. */
  numbers: Map<string, number>;
  /** Paths used in each project, by project number. */
  paths: Map<number, Set<string>>;
};

/**
 * One `check` block as the checker runs it: a temp file path in its project when tsc can check its
 * language, a `problem` otherwise.
 *
 * @param file - Source file of the page.
 * @param index - Index of the block among the page's `check` blocks.
 * @param fence - The block and its meta.
 * @param projects - The projects of the run, updated with this block.
 * @returns The checked block.
 */
function toCheckedBlock(
  file: string,
  index: number,
  fence: CheckFence,
  projects: ProjectRegistry
): CheckedBlock {
  const packageId = packageOf(file);
  const { code, language, extension } = prepareBlock(fence.block, fence.meta);
  if (extension === undefined) {
    const problem = `check works on ts and tsx blocks, not on "${language}".`;
    return { file, index, name: "", packageId, code, problem };
  }

  // Find or open the block's project.
  const key = projectKey(file, index, fence.meta);
  const projectNumber = projects.numbers.get(key) ?? projects.numbers.size;
  projects.numbers.set(key, projectNumber);
  const taken = projects.paths.get(projectNumber) ?? new Set<string>();
  projects.paths.set(projectNumber, taken);

  // Claim a path inside that project.
  const inside = blockPath(fence, index, extension, taken);
  taken.add(inside);
  return { file, index, name: `p${projectNumber}/${inside}`, packageId, code };
}

/**
 * Collect the `check` blocks of every page, in page order. A block in a language tsc cannot check
 * carries a `problem` instead of a temp file path.
 *
 * @param sources - Docs pages.
 * @returns The `check` blocks.
 */
function collectBlocks(sources: readonly SnippetSource[]): CheckedBlock[] {
  const projects: ProjectRegistry = { numbers: new Map(), paths: new Map() };
  return sources.flatMap(({ file, markdown }) =>
    checkFences(markdown).map((fence, index) => toCheckedBlock(file, index, fence, projects))
  );
}

/**
 * Run the project's `tsc` on the temp project.
 *
 * @param projectDirectory - Project root with `node_modules/.bin/tsc`.
 * @param runDirectory - The temp project holding `tsconfig.json`.
 * @returns The exit code and the output.
 */
function runCompiler(projectDirectory: string, runDirectory: string): Promise<CompilerRun> {
  const compiler = path.join(projectDirectory, "node_modules", ".bin", "tsc");
  return new Promise((resolve, reject) => {
    const child = spawn(compiler, ["-p", "tsconfig.json", "--pretty", "false"], {
      cwd: runDirectory
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", code => resolve({ code: code ?? 1, output }));
  });
}

/**
 * Whether a compiler output line continues the message before it: indented, after a diagnostic.
 *
 * @param line - A line of tsc output.
 * @param current - The message lines of the last diagnostic, if one is open.
 * @returns `true` when the line belongs to the open message.
 */
function isContinuation(line: string, current: string[] | undefined): current is string[] {
  return current !== undefined && /^\s/.test(line);
}

/**
 * Group the compiler output by temp file: one message per block, lines as `line:column text`.
 *
 * @param output - tsc output with `--pretty false`.
 * @returns The messages by temp file name, and the lines that belong to no block.
 */
function parseDiagnostics(output: string): { messages: Map<string, string[]>; stray: string[] } {
  const messages = new Map<string, string[]>();
  const stray: string[] = [];
  let current: string[] | undefined;
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === "") continue;

    // A diagnostic opens a message for its temp file.
    const match = DIAGNOSTIC.exec(line);
    if (match !== null) {
      const [, name = "", row, column, text] = match;
      current = messages.get(name) ?? [];
      messages.set(name, current);
      current.push(`${row}:${column} ${text}`);
      continue;
    }

    // An indented line continues the open message; any other line belongs to no block.
    if (isContinuation(line, current)) {
      current.push(line);
      continue;
    }
    current = undefined;
    stray.push(line);
  }
  return { messages, stray };
}

/**
 * Write every project of the run: the stubs of its docs package first, then its blocks over them.
 *
 * @param blocks - The blocks to compile, each with a temp file path.
 * @param projectDirectory - Project root holding `content/snippet-stubs`.
 * @param runDirectory - The temp directory of this run.
 * @returns Resolves when every file is written.
 */
async function writeProjects(
  blocks: CheckedBlock[],
  projectDirectory: string,
  runDirectory: string
): Promise<void> {
  const stubsDirectory = path.join(projectDirectory, "content", "snippet-stubs");
  // Seed each project with the stubs of its docs package.
  const packageByProject = new Map(
    blocks.map(block => [block.name.split("/")[0] ?? "", block.packageId])
  );
  await Promise.all(
    [...packageByProject].map(async ([project, packageId]) => {
      const stubs = path.join(stubsDirectory, packageId);
      if (packageId === "" || !existsSync(stubs)) return;
      await cp(stubs, path.join(runDirectory, project), { recursive: true });
    })
  );

  // Write each block over the stubs at its own path.
  for (const block of blocks) {
    const target = path.join(runDirectory, block.name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, block.code);
  }
}

/**
 * Write the blocks and the tsconfig, run tsc once, and group its diagnostics by block.
 *
 * @param blocks - The blocks to compile, each with a temp file name.
 * @param projectDirectory - Project root.
 * @returns The compiler message of each failing block, by temp file name.
 * @throws {Error} When tsc fails with output that names no block, or fails in a stub (a broken setup, not a block).
 */
async function compileBlocks(
  blocks: CheckedBlock[],
  projectDirectory: string
): Promise<Map<string, string>> {
  const cacheDirectory = path.join(projectDirectory, ".cache", "snippets");
  await mkdir(cacheDirectory, { recursive: true });
  const runDirectory = await mkdtemp(path.join(cacheDirectory, "run-"));
  try {
    // Write the tsconfig and the project files, and compile them once.
    const tsconfig = { compilerOptions: COMPILER_OPTIONS, files: blocks.map(block => block.name) };
    await writeFile(path.join(runDirectory, "tsconfig.json"), JSON.stringify(tsconfig));
    await writeProjects(blocks, projectDirectory, runDirectory);
    const run = await runCompiler(projectDirectory, runDirectory);
    if (run.code === 0) return new Map();

    // Tell a failing block from a broken setup: a stub, or output that names no block.
    const { messages, stray } = parseDiagnostics(run.output);
    const names = new Set(blocks.map(block => block.name));
    const inStubs = [...messages.keys()].filter(name => !names.has(name));
    const isSetupFailure = stray.length > 0 || messages.size === 0 || inStubs.length > 0;
    if (isSetupFailure) {
      throw new Error(
        `[site] tsc failed outside the docs code blocks:\n${run.output.trim()}\n  Fix the snippet checker setup in src/lib/snippets.ts.`
      );
    }
    return new Map([...messages].map(([name, lines]) => [name, lines.join("\n")]));
  } finally {
    await rm(runDirectory, { recursive: true, force: true });
  }
}

/**
 * Compile every `check` block of the given pages and return the failures.
 *
 * @param sources - Docs pages to scan.
 * @param projectDirectory - Project root whose `node_modules` the blocks compile against.
 * @returns One failure per block that does not compile, in page order; empty when all compile.
 * @throws {Error} When tsc cannot run or fails outside the blocks.
 * @example
 * ```ts
 * const pages = await app.docs.all();
 * const failures = await checkSnippets(pages, process.cwd());
 * // [{ file: "content/docs/web/guides/routing.md", index: 1, message: "2:10 error TS2305: …" }]
 * ```
 */
export async function checkSnippets(
  sources: readonly SnippetSource[],
  projectDirectory: string
): Promise<SnippetFailure[]> {
  const blocks = collectBlocks(sources);
  const compilable = blocks.filter(block => block.problem === undefined);
  const messages =
    compilable.length === 0
      ? new Map<string, string>()
      : await compileBlocks(compilable, projectDirectory);
  return blocks.flatMap(({ file, index, name, problem }) => {
    const message = problem ?? messages.get(name);
    return message === undefined ? [] : [{ file, index, message }];
  });
}

/**
 * Why a TypeScript block's gate is wrong, `undefined` when it is set right.
 *
 * @param meta - The block's parsed fence meta.
 * @returns The problem, in words.
 */
function gateProblem(meta: FenceMeta): string | undefined {
  const reason = meta.attributes["no-check"];
  const isChecked = meta.flags.has("check");
  const isOptedOut = reason !== undefined || meta.flags.has("no-check");

  // Exactly one gate per block: check, or no-check with a reason.
  if (isChecked && isOptedOut) return "a block is either check or no-check, not both.";
  if (isChecked) return undefined;
  if (!isOptedOut) {
    return 'add check, or no-check="<reason>" when the block cannot compile on its own.';
  }
  if ((reason ?? "").trim() === "") return 'no-check needs a reason: no-check="<reason>".';
  return undefined;
}

/**
 * The gate failures of one page.
 *
 * @param file - Source file of the page.
 * @param markdown - Raw Markdown of the page.
 * @returns One failure per ts or tsx block whose gate is wrong.
 */
function pageGateFailures(file: string, markdown: string): SnippetFailure[] {
  // Keep the ts and tsx blocks, number them, and report each one whose gate is wrong.
  const typescriptFences = fencedBlocks(markdown)
    .map(block => ({ block, meta: parseFenceMeta(block.meta) }))
    .filter(fence => prepareBlock(fence.block, fence.meta).extension !== undefined);
  return typescriptFences.flatMap((fence, index) => {
    const message = gateProblem(fence.meta);
    return message === undefined ? [] : [{ file, index, message }];
  });
}

/**
 * Find the ts and tsx blocks that are neither `check` nor `no-check` with a reason.
 *
 * @param sources - Docs pages to scan.
 * @returns One failure per ungated block, in page order; `index` counts the page's ts and tsx blocks.
 * @example
 * ```ts
 * ungatedSnippets([{ file: "content/docs/a.md", markdown: "```ts\nconst a = 1;\n```" }]);
 * // [{ file: "content/docs/a.md", index: 0, message: "add check, or no-check=…" }]
 * ```
 */
export function ungatedSnippets(sources: readonly SnippetSource[]): SnippetFailure[] {
  return sources.flatMap(({ file, markdown }) => pageGateFailures(file, markdown));
}
