/**
 * @file Compiles the docs code blocks tagged `check` against the installed packages.
 *
 * Build-time only. This is the anti-drift gate: a docs example that stops compiling
 * after a package update fails the test run.
 */

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
  /** Zero-based index of the block among the page's `check` blocks. */
  index: number;
  /** Compiler output for the block. */
  message: string;
};

/**
 * Compile every `check` block of the given pages and return the failures.
 *
 * @param _sources - Docs pages to scan.
 * @param _projectDirectory - Project root whose `node_modules` the blocks compile against.
 * @throws {Error} Not implemented yet.
 */
export function checkSnippets(
  _sources: readonly SnippetSource[],
  _projectDirectory: string
): Promise<SnippetFailure[]> {
  throw new Error("not implemented");
}
